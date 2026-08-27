create extension if not exists pgcrypto;

create table if not exists public.vault_store_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  sku text not null,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text unique,
  currency text not null default 'usd' check (char_length(currency) = 3),
  amount_cents integer not null check (amount_cents > 0),
  processing_fee_cents integer check (processing_fee_cents is null or processing_fee_cents >= 0),
  refunded_amount_cents integer not null default 0 check (refunded_amount_cents >= 0),
  accounting_status text not null default 'gross_recorded' check (accounting_status in ('gross_recorded', 'fee_verified')),
  status text not null default 'paid' check (status in ('paid', 'partially_refunded', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (refunded_amount_cents <= amount_cents)
);

-- Keep this migration safe if an earlier preview already created the first draft.
alter table public.vault_store_orders add column if not exists processing_fee_cents integer;
alter table public.vault_store_orders add column if not exists refunded_amount_cents integer not null default 0;
alter table public.vault_store_orders add column if not exists accounting_status text not null default 'gross_recorded';
alter table public.vault_store_orders drop constraint if exists vault_store_orders_status_check;
alter table public.vault_store_orders add constraint vault_store_orders_status_check check (status in ('paid', 'partially_refunded', 'refunded'));
alter table public.vault_store_orders drop constraint if exists vault_store_orders_processing_fee_cents_check;
alter table public.vault_store_orders add constraint vault_store_orders_processing_fee_cents_check check (processing_fee_cents is null or processing_fee_cents >= 0);
alter table public.vault_store_orders drop constraint if exists vault_store_orders_refunded_amount_cents_check;
alter table public.vault_store_orders add constraint vault_store_orders_refunded_amount_cents_check check (refunded_amount_cents >= 0 and refunded_amount_cents <= amount_cents);
alter table public.vault_store_orders drop constraint if exists vault_store_orders_accounting_status_check;
alter table public.vault_store_orders add constraint vault_store_orders_accounting_status_check check (accounting_status in ('gross_recorded', 'fee_verified'));

create table if not exists public.vault_store_entitlements (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  sku text not null,
  order_id uuid not null references public.vault_store_orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (buyer_id, sku)
);

create table if not exists public.vault_store_journals (
  id uuid primary key default gen_random_uuid(),
  chain_seq bigint generated always as identity unique,
  source_ref text not null unique,
  event_type text not null check (event_type in ('sale_gross', 'processing_fee', 'refund')),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  balanced_amount_cents bigint not null check (balanced_amount_cents > 0),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  previous_hash text not null check (previous_hash ~ '^[0-9a-f]{64}$'),
  entry_hash text not null unique check (entry_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.vault_store_journal_lines (
  id bigint generated always as identity primary key,
  journal_id uuid not null references public.vault_store_journals(id) on delete restrict,
  line_no smallint not null check (line_no > 0),
  account_code text not null check (char_length(account_code) between 1 and 80),
  side text not null check (side in ('debit', 'credit')),
  amount_cents bigint not null check (amount_cents > 0),
  unique (journal_id, line_no)
);

alter table public.vault_store_orders enable row level security;
alter table public.vault_store_entitlements enable row level security;
alter table public.vault_store_journals enable row level security;
alter table public.vault_store_journal_lines enable row level security;

drop policy if exists "buyers view own vault store orders" on public.vault_store_orders;
create policy "buyers view own vault store orders"
  on public.vault_store_orders
  for select
  using (buyer_id = auth.uid());

drop policy if exists "buyers view own vault store entitlements" on public.vault_store_entitlements;
create policy "buyers view own vault store entitlements"
  on public.vault_store_entitlements
  for select
  using (buyer_id = auth.uid());

revoke all on table public.vault_store_journals from anon, authenticated;
revoke all on table public.vault_store_journal_lines from anon, authenticated;
grant select on table public.vault_store_journals to service_role;
grant select on table public.vault_store_journal_lines to service_role;

create index if not exists vault_store_orders_buyer_idx on public.vault_store_orders (buyer_id, created_at desc);
create index if not exists vault_store_orders_payment_intent_idx on public.vault_store_orders (stripe_payment_intent_id);
create index if not exists vault_store_entitlements_buyer_idx on public.vault_store_entitlements (buyer_id, sku) where revoked_at is null;
create index if not exists vault_store_journals_chain_idx on public.vault_store_journals (chain_seq);
create index if not exists vault_store_journals_payment_intent_idx on public.vault_store_journals (stripe_payment_intent_id);

create or replace function public.post_vault_store_journal(
  p_source_ref text,
  p_event_type text,
  p_currency text,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_lines jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_existing uuid;
  v_journal_id uuid := gen_random_uuid();
  v_previous_hash text;
  v_entry_hash text;
  v_canonical_lines text;
  v_payload text;
  v_debits bigint;
  v_credits bigint;
begin
  if nullif(trim(p_source_ref), '') is null then raise exception 'SOURCE_REF_REQUIRED'; end if;
  if p_event_type not in ('sale_gross', 'processing_fee', 'refund') then raise exception 'INVALID_EVENT_TYPE'; end if;
  p_currency := lower(trim(coalesce(p_currency, '')));
  if p_currency !~ '^[a-z]{3}$' then raise exception 'INVALID_CURRENCY'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'JOURNAL_LINES_REQUIRED';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) as entries(line)
    where nullif(trim(entries.line ->> 'account'), '') is null
       or lower(coalesce(entries.line ->> 'side', '')) not in ('debit', 'credit')
       or coalesce(entries.line ->> 'amount_cents', '') !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'INVALID_JOURNAL_LINE';
  end if;

  select
    coalesce(sum(case when lower(line ->> 'side') = 'debit' then (line ->> 'amount_cents')::bigint else 0 end), 0),
    coalesce(sum(case when lower(line ->> 'side') = 'credit' then (line ->> 'amount_cents')::bigint else 0 end), 0)
  into v_debits, v_credits
  from jsonb_array_elements(p_lines) as entries(line);

  if v_debits <= 0 or v_debits <> v_credits then raise exception 'UNBALANCED_JOURNAL'; end if;

  select string_agg(
    trim(line ->> 'account') || ':' || lower(line ->> 'side') || ':' || ((line ->> 'amount_cents')::bigint)::text,
    '|' order by ordinality
  ) into v_canonical_lines
  from jsonb_array_elements(p_lines) with ordinality as entries(line, ordinality);

  -- One serialized append point prevents two webhook workers from claiming the
  -- same previous hash. source_ref then makes Stripe retries idempotent.
  perform pg_advisory_xact_lock(hashtextextended('vault_store_journal_chain', 0));

  select id into v_existing from public.vault_store_journals where source_ref = trim(p_source_ref);
  if v_existing is not null then return v_existing; end if;

  select entry_hash into v_previous_hash
  from public.vault_store_journals
  order by chain_seq desc
  limit 1;
  v_previous_hash := coalesce(v_previous_hash, repeat('0', 64));

  v_payload := concat_ws('|',
    trim(p_source_ref),
    p_event_type,
    p_currency,
    coalesce(p_checkout_session_id, ''),
    coalesce(p_payment_intent_id, ''),
    v_canonical_lines
  );
  v_entry_hash := encode(digest(v_previous_hash || '|' || v_payload, 'sha256'), 'hex');

  insert into public.vault_store_journals (
    id, source_ref, event_type, currency, balanced_amount_cents,
    stripe_checkout_session_id, stripe_payment_intent_id,
    previous_hash, entry_hash
  ) values (
    v_journal_id, trim(p_source_ref), p_event_type, p_currency, v_debits,
    p_checkout_session_id, p_payment_intent_id,
    v_previous_hash, v_entry_hash
  );

  insert into public.vault_store_journal_lines (journal_id, line_no, account_code, side, amount_cents)
  select
    v_journal_id,
    ordinality::smallint,
    trim(line ->> 'account'),
    lower(line ->> 'side'),
    (line ->> 'amount_cents')::bigint
  from jsonb_array_elements(p_lines) with ordinality as entries(line, ordinality);

  return v_journal_id;
end;
$$;

revoke all on function public.post_vault_store_journal(text, text, text, text, text, jsonb) from public;
grant execute on function public.post_vault_store_journal(text, text, text, text, text, jsonb) to service_role;

create or replace function public.verify_vault_store_journal_chain() returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with ordered as (
    select
      j.*,
      lag(j.entry_hash) over (order by j.chain_seq) as expected_previous_hash,
      (
        select string_agg(
          l.account_code || ':' || l.side || ':' || l.amount_cents::text,
          '|' order by l.line_no
        )
        from public.vault_store_journal_lines l
        where l.journal_id = j.id
      ) as canonical_lines
    from public.vault_store_journals j
  )
  select coalesce(bool_and(
    previous_hash = coalesce(expected_previous_hash, repeat('0', 64))
    and entry_hash = encode(digest(
      previous_hash || '|' || concat_ws('|',
        source_ref,
        event_type,
        currency,
        coalesce(stripe_checkout_session_id, ''),
        coalesce(stripe_payment_intent_id, ''),
        canonical_lines
      ),
      'sha256'
    ), 'hex')
  ), true)
  from ordered;
$$;

revoke all on function public.verify_vault_store_journal_chain() from public;
grant execute on function public.verify_vault_store_journal_chain() to service_role;

comment on table public.vault_store_orders is 'Platform-owned digital product purchases confirmed by signed Stripe webhook events. Gross sale accounting is mandatory; processing fee coverage is tracked separately.';
comment on table public.vault_store_entitlements is 'Account-bound Vault Store download rights. Fully refunded orders revoke access.';
comment on table public.vault_store_journals is 'Append-only balanced Vault Store journals. Each row commits to the prior journal hash and its ordered debit/credit lines.';
comment on function public.verify_vault_store_journal_chain() is 'Returns true only when the full Vault Store journal hash chain recomputes without gaps or edits.';
