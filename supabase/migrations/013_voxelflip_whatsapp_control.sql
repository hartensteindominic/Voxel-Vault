create extension if not exists pgcrypto;

create table if not exists public.voxelflip_control_actions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  wallet text check (wallet is null or wallet ~* '^0x[0-9a-f]{40}$'),
  action_type text not null check (action_type in ('revenue_notice','reinvest','list','buy','mint','test')),
  status text not null default 'pending' check (status in ('pending','approved','skipped','expired','notified','executed','failed')),
  payload jsonb not null default '{}'::jsonb,
  whatsapp_message_id text,
  responder_hash text,
  approved_via text,
  expires_at timestamptz,
  responded_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voxelflip_control_actions_status_time_idx
  on public.voxelflip_control_actions (status, created_at desc);
create index if not exists voxelflip_control_actions_wallet_time_idx
  on public.voxelflip_control_actions (lower(wallet), created_at desc);

alter table public.voxelflip_control_actions enable row level security;
revoke all on table public.voxelflip_control_actions from anon, authenticated;
grant select, insert, update on table public.voxelflip_control_actions to service_role;

comment on table public.voxelflip_control_actions is
  'Server-only, single-use control approvals for VoxelFlip. WhatsApp approval records intent only; it is never a blockchain signature and cannot bypass bounded executor rules.';
