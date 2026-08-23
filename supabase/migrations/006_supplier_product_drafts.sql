-- Supplier-neutral product intake. A supplier URL creates only a private draft;
-- publication requires fulfillment, shipping, model-rights and pre-mint evidence.
create table if not exists public.supplier_product_drafts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  source_url text not null,
  source_host text not null,
  source_name text not null,
  name text not null default '',
  physical_sku text,
  source_price_cents integer check (source_price_cents > 0),
  retail_price_cents integer check (retail_price_cents > 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  fulfillment_provider text,
  fulfillment_sku text,
  fulfillment_status text not null default 'unverified' check (fulfillment_status in ('unverified','testing','verified','blocked')),
  shipping_status text not null default 'unverified' check (shipping_status in ('unverified','testing','verified','blocked')),
  model_uri text,
  usdz_uri text,
  model_license text,
  model_license_uri text,
  model_hash text,
  contract_address text,
  chain_id integer check (chain_id > 0),
  token_id text,
  mint_tx_hash text,
  mint_status text not null default 'unverified' check (mint_status in ('unverified','pending','confirmed','failed')),
  inventory_status text not null default 'unverified' check (inventory_status in ('unverified','available','reserved','sold','transferred','blocked')),
  readiness jsonb not null default '{"ready":false,"missing":[],"invalid":[]}'::jsonb,
  status text not null default 'draft' check (status in ('draft','review','ready','published','rejected','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_address, token_id)
);

alter table public.supplier_product_drafts enable row level security;
-- No anon/authenticated policies. Admin API access is authenticated and all
-- reads/writes use the service role after checking VAULT_ADMIN_USER_IDS.
create index if not exists supplier_product_drafts_status_idx on public.supplier_product_drafts(status, updated_at desc);
create index if not exists supplier_product_drafts_source_host_idx on public.supplier_product_drafts(source_host);
