create table if not exists public.commerce_webhook_events (
  provider text not null,
  event_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);

alter table public.physical_orders
  add column if not exists order_status text not null default 'paid',
  add column if not exists shipping_amount_cents integer not null default 0,
  add column if not exists tax_amount_cents integer not null default 0,
  add column if not exists total_amount_cents integer not null default 0,
  add column if not exists carrier text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists return_status text not null default 'none',
  add column if not exists claim_eligible boolean not null default false,
  add column if not exists claim_eligible_at timestamptz;

alter table public.physical_orders drop constraint if exists physical_orders_order_status_check;
alter table public.physical_orders add constraint physical_orders_order_status_check
  check (order_status in ('paid','fulfillment_pending','submitted','shipped','delivered','cancelled','refund_pending','refunded','failed'));
alter table public.physical_orders drop constraint if exists physical_orders_return_status_check;
alter table public.physical_orders add constraint physical_orders_return_status_check
  check (return_status in ('none','requested','approved','in_transit','received','refunded','rejected'));

create table if not exists public.physical_order_events (
  id uuid primary key default gen_random_uuid(),
  physical_order_id uuid not null references public.physical_orders(id) on delete cascade,
  event_id text unique not null,
  event_type text not null,
  public_message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.physical_order_events enable row level security;
create policy "buyers view own physical order events" on public.physical_order_events for select using (
  exists (select 1 from public.physical_orders o where o.id = physical_order_id and o.buyer_id = auth.uid())
);
create index if not exists physical_order_events_order_created_idx on public.physical_order_events(physical_order_id, created_at);
create index if not exists physical_orders_claim_eligible_idx on public.physical_orders(buyer_id, claim_eligible);

-- commerce_webhook_events has RLS enabled with no public policies. Only the
-- service-role webhook processor can read or write provider idempotency keys.
alter table public.commerce_webhook_events enable row level security;

create or replace function public.apply_fulfillment_event(
  p_order_id uuid,
  p_event_id text,
  p_status text,
  p_public_message text,
  p_tracking_number text default null,
  p_tracking_url text default null,
  p_carrier text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  existing_event uuid;
begin
  select id into existing_event from physical_order_events where event_id = p_event_id;
  if existing_event is not null then return jsonb_build_object('duplicate', true, 'status', p_status); end if;

  select order_status into current_status from physical_orders where id = p_order_id for update;
  if current_status is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if not (
    (current_status in ('paid','fulfillment_pending') and p_status in ('submitted','cancelled','failed')) or
    (current_status = 'submitted' and p_status in ('shipped','cancelled','failed')) or
    (current_status = 'shipped' and p_status in ('delivered','failed')) or
    (current_status = p_status)
  ) then raise exception 'INVALID_ORDER_TRANSITION:%->%', current_status, p_status; end if;

  update physical_orders set
    order_status = p_status,
    fulfillment_status = case when p_status in ('submitted','shipped','delivered','cancelled','failed') then p_status else fulfillment_status end,
    tracking_number = coalesce(p_tracking_number, tracking_number),
    tracking_url = coalesce(p_tracking_url, tracking_url),
    carrier = coalesce(p_carrier, carrier),
    shipped_at = case when p_status = 'shipped' then coalesce(shipped_at, now()) else shipped_at end,
    delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
    cancelled_at = case when p_status = 'cancelled' then coalesce(cancelled_at, now()) else cancelled_at end,
    claim_eligible = (p_status = 'delivered'),
    claim_eligible_at = case when p_status = 'delivered' then coalesce(claim_eligible_at, now()) else claim_eligible_at end,
    updated_at = now()
  where id = p_order_id;

  insert into physical_order_events(physical_order_id,event_id,event_type,public_message,metadata)
  values(p_order_id,p_event_id,p_status,p_public_message,p_metadata);
  return jsonb_build_object('duplicate', false, 'status', p_status, 'claimEligible', p_status = 'delivered');
end;
$$;
revoke all on function public.apply_fulfillment_event(uuid,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.apply_fulfillment_event(uuid,text,text,text,text,text,text,jsonb) to service_role;
