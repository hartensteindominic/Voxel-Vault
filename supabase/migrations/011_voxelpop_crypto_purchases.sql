create table if not exists public.voxelpop_crypto_purchases (
  session_id text primary key,
  wallet text not null,
  tx_hash text unique,
  chain_id bigint not null default 8453,
  status text not null default 'quoted' check (status in ('quoted','paid','expired')),
  quote_wei text not null,
  quote_usd_cents integer not null default 199,
  quote_expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voxelpop_crypto_purchases_wallet_idx on public.voxelpop_crypto_purchases (lower(wallet));
create index if not exists voxelpop_crypto_purchases_status_idx on public.voxelpop_crypto_purchases (status, created_at desc);

alter table public.voxelpop_crypto_purchases enable row level security;

-- Server-only table: browser clients receive access through guarded API routes.
revoke all on public.voxelpop_crypto_purchases from anon, authenticated;
