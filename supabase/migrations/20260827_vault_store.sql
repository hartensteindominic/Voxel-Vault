create table if not exists public.vault_store_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  sku text not null,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text unique,
  currency text not null default 'usd' check (char_length(currency) = 3),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vault_store_entitlements (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  sku text not null,
  order_id uuid not null references public.vault_store_orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (buyer_id, sku)
);

alter table public.vault_store_orders enable row level security;
alter table public.vault_store_entitlements enable row level security;

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

create index if not exists vault_store_orders_buyer_idx on public.vault_store_orders (buyer_id, created_at desc);
create index if not exists vault_store_entitlements_buyer_idx on public.vault_store_entitlements (buyer_id, sku) where revoked_at is null;

comment on table public.vault_store_orders is 'Platform-owned digital product purchases confirmed by signed Stripe webhook events.';
comment on table public.vault_store_entitlements is 'Account-bound Vault Store download rights. Revoked on refund.';
