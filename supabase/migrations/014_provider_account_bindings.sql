create table if not exists public.vault_provider_account_bindings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('dinari')),
  environment text not null check (environment in ('sandbox','live')),
  entity_id text not null check (char_length(entity_id) between 1 and 128),
  account_id text not null check (char_length(account_id) between 1 and 128),
  binding_status text not null default 'verified' check (binding_status in ('verified','suspended','revoked')),
  binding_source text not null default 'provider-onboarding' check (char_length(binding_source) between 1 and 80),
  provider_kyc_status text not null default '' check (char_length(provider_kyc_status) <= 40),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, environment),
  unique (provider, environment, account_id)
);

alter table public.vault_provider_account_bindings enable row level security;

-- Users may read their own binding so the UI can explain which provider rail is connected.
-- There are intentionally NO client insert/update/delete policies. Bindings are written only
-- by trusted server code after provider onboarding/verification using the Supabase service role.
create policy "users read own provider account binding"
on public.vault_provider_account_bindings
for select to authenticated
using (user_id = auth.uid());

create index if not exists vault_provider_account_bindings_user_idx
  on public.vault_provider_account_bindings(user_id, provider, environment);

create index if not exists vault_provider_account_bindings_account_idx
  on public.vault_provider_account_bindings(provider, environment, account_id);
