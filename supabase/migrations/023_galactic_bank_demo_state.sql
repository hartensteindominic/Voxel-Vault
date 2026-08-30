create table if not exists public.galactic_bank_demo_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.galactic_bank_demo_state enable row level security;

create policy "users read own galactic demo state"
on public.galactic_bank_demo_state
for select
to authenticated
using (user_id = auth.uid());

create policy "users create own galactic demo state"
on public.galactic_bank_demo_state
for insert
to authenticated
with check (user_id = auth.uid());

create policy "users update own galactic demo state"
on public.galactic_bank_demo_state
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index if not exists galactic_bank_demo_state_updated_idx
on public.galactic_bank_demo_state(updated_at desc);
