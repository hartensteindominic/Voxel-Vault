create table if not exists public.galactic_increase_webhook_events (
  event_id text primary key,
  category text not null,
  associated_object_type text,
  associated_object_id text,
  source text not null check (source in ('webhook', 'poll')),
  webhook_message_id text,
  payload_sha256 text,
  provider_created_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received' check (processing_status in ('received', 'processed', 'failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(event_id) between 1 and 200),
  check (char_length(category) between 1 and 160),
  check (payload_sha256 is null or char_length(payload_sha256) = 64)
);

create table if not exists public.galactic_increase_reconciliation_state (
  environment text primary key check (environment = 'sandbox'),
  event_cursor text,
  last_event_id text,
  last_event_category text,
  last_webhook_at timestamptz,
  last_poll_at timestamptz,
  last_reconciled_at timestamptz,
  last_reconciliation_status text check (last_reconciliation_status is null or last_reconciliation_status in ('ok', 'failed')),
  last_reconciliation_trigger text check (last_reconciliation_trigger is null or last_reconciliation_trigger in ('webhook', 'poll', 'owner', 'dashboard')),
  account_count integer not null default 0 check (account_count >= 0),
  transaction_count integer not null default 0 check (transaction_count >= 0),
  current_balance_cents bigint not null default 0,
  available_balance_cents bigint not null default 0,
  last_transaction_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.galactic_increase_webhook_events enable row level security;
alter table public.galactic_increase_reconciliation_state enable row level security;

revoke all on table public.galactic_increase_webhook_events from anon, authenticated;
revoke all on table public.galactic_increase_reconciliation_state from anon, authenticated;

create index if not exists galactic_increase_webhook_events_received_idx
on public.galactic_increase_webhook_events(received_at desc);

create index if not exists galactic_increase_webhook_events_status_idx
on public.galactic_increase_webhook_events(processing_status, received_at desc);

create index if not exists galactic_increase_webhook_events_category_idx
on public.galactic_increase_webhook_events(category, provider_created_at desc);

comment on table public.galactic_increase_webhook_events is
  'Service-role-only Increase sandbox Event ledger. Stores event metadata and a payload hash, never API credentials or the raw webhook body.';

comment on table public.galactic_increase_reconciliation_state is
  'Service-role-only Increase sandbox reconciliation checkpoint and aggregate provider snapshot. No production-money authority.';
