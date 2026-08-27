create extension if not exists pgcrypto;

create table if not exists public.spatial_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_kind text not null default 'manual' check (source_kind in ('manual','voxelpop','wallet_import')),
  source_session_id text,
  source_task_id text,
  title text not null,
  description text not null default '',
  prompt text not null default '',
  image_url text,
  glb_storage_path text,
  thumbnail_path text,
  state text not null default 'draft' check (state in ('draft','generating','generated','saved','mint_pending','minted','mint_failed','archived')),
  favorite boolean not null default false,
  collection_name text not null default 'My Vault',
  chain_id bigint,
  contract_address text,
  token_id text,
  transaction_hash text,
  owner_wallet text,
  metadata_uri text,
  audit_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, source_session_id, source_task_id)
);

create table if not exists public.wallet_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null,
  chain_id bigint,
  verification_method text not null default 'personal_sign' check (verification_method in ('personal_sign')),
  verified_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, wallet_address)
);

create table if not exists public.wallet_link_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null,
  nonce text not null unique,
  message text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_ref text not null,
  event_type text not null,
  currency text not null check (currency ~ '^[a-z]{3}$'),
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source_type, source_ref)
);

create table if not exists public.journal_legs (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete restrict,
  account_code text not null,
  direction text not null check (direction in ('debit','credit')),
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_chain_log (
  id uuid primary key default gen_random_uuid(),
  sequence bigint not null unique,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  source_ref text,
  payload jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  previous_hash text,
  entry_hash text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.spatial_asset_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.spatial_assets(id) on delete cascade,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists spatial_assets_owner_created_idx on public.spatial_assets(owner_user_id, created_at desc);
create index if not exists spatial_assets_owner_state_idx on public.spatial_assets(owner_user_id, state);
create index if not exists spatial_assets_owner_wallet_idx on public.spatial_assets(owner_user_id, owner_wallet) where owner_wallet is not null;
create index if not exists wallet_links_user_idx on public.wallet_links(user_id, verified_at desc);
create index if not exists wallet_link_challenges_lookup_idx on public.wallet_link_challenges(user_id, wallet_address, created_at desc);
create index if not exists journal_legs_entry_idx on public.journal_legs(entry_id);
create index if not exists audit_chain_entity_idx on public.audit_chain_log(entity_type, entity_id, sequence desc);
create index if not exists spatial_asset_events_asset_idx on public.spatial_asset_events(asset_id, created_at desc);

alter table public.spatial_assets enable row level security;
alter table public.wallet_links enable row level security;
alter table public.wallet_link_challenges enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_legs enable row level security;
alter table public.audit_chain_log enable row level security;
alter table public.spatial_asset_events enable row level security;

drop policy if exists "owners read spatial assets" on public.spatial_assets;
create policy "owners read spatial assets" on public.spatial_assets for select using (owner_user_id = auth.uid());

drop policy if exists "owners read wallet links" on public.wallet_links;
create policy "owners read wallet links" on public.wallet_links for select using (user_id = auth.uid());

drop policy if exists "owners read spatial asset events" on public.spatial_asset_events;
create policy "owners read spatial asset events" on public.spatial_asset_events for select using (
  exists (select 1 from public.spatial_assets a where a.id = asset_id and a.owner_user_id = auth.uid())
);

-- Writes to spatial assets, wallet proofs, journals and the audit chain are server-authoritative.
revoke insert, update, delete on public.spatial_assets from anon, authenticated;
revoke insert, update, delete on public.wallet_links from anon, authenticated;
revoke all on public.wallet_link_challenges from anon, authenticated;
revoke all on public.journal_entries from anon, authenticated;
revoke all on public.journal_legs from anon, authenticated;
revoke all on public.audit_chain_log from anon, authenticated;
revoke insert, update, delete on public.spatial_asset_events from anon, authenticated;

create or replace function public.post_balanced_journal_entry(
  p_source_type text,
  p_source_ref text,
  p_event_type text,
  p_currency text,
  p_description text,
  p_metadata jsonb,
  p_legs jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_existing_id uuid;
  v_debits bigint := 0;
  v_credits bigint := 0;
  v_leg jsonb;
  v_amount bigint;
  v_direction text;
  v_account text;
begin
  if p_source_type is null or btrim(p_source_type) = '' or p_source_ref is null or btrim(p_source_ref) = '' then
    raise exception 'JOURNAL_SOURCE_REQUIRED';
  end if;
  if p_currency !~ '^[a-z]{3}$' then raise exception 'JOURNAL_CURRENCY_INVALID'; end if;
  if jsonb_typeof(p_legs) <> 'array' or jsonb_array_length(p_legs) < 2 then raise exception 'JOURNAL_LEGS_REQUIRED'; end if;

  for v_leg in select value from jsonb_array_elements(p_legs)
  loop
    v_direction := lower(coalesce(v_leg->>'direction',''));
    v_account := btrim(coalesce(v_leg->>'accountCode',''));
    begin
      v_amount := (v_leg->>'amountCents')::bigint;
    exception when others then
      raise exception 'JOURNAL_AMOUNT_INVALID';
    end;
    if v_account = '' or v_direction not in ('debit','credit') or v_amount <= 0 then raise exception 'JOURNAL_LEG_INVALID'; end if;
    if v_direction = 'debit' then v_debits := v_debits + v_amount; else v_credits := v_credits + v_amount; end if;
  end loop;

  if v_debits <> v_credits then raise exception 'JOURNAL_UNBALANCED: debits %, credits %', v_debits, v_credits; end if;

  select id into v_existing_id from public.journal_entries where source_type = p_source_type and source_ref = p_source_ref;
  if v_existing_id is not null then return v_existing_id; end if;

  insert into public.journal_entries(source_type, source_ref, event_type, currency, description, metadata)
  values (p_source_type, p_source_ref, p_event_type, p_currency, coalesce(p_description,''), coalesce(p_metadata,'{}'::jsonb))
  returning id into v_entry_id;

  for v_leg in select value from jsonb_array_elements(p_legs)
  loop
    insert into public.journal_legs(entry_id, account_code, direction, amount_cents)
    values (
      v_entry_id,
      btrim(v_leg->>'accountCode'),
      lower(v_leg->>'direction'),
      (v_leg->>'amountCents')::bigint
    );
  end loop;

  return v_entry_id;
end;
$$;

create or replace function public.append_audit_chain_event(
  p_event_type text,
  p_entity_type text,
  p_entity_id text,
  p_payload jsonb,
  p_actor_user_id uuid default null,
  p_source_ref text default null
) returns table(sequence bigint, entry_hash text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sequence bigint;
  v_previous text;
  v_payload_hash text;
  v_entry_hash text;
begin
  perform pg_advisory_xact_lock(hashtext('voxelvault:audit_chain_log'));
  select coalesce(max(a.sequence), 0) + 1 into v_sequence from public.audit_chain_log a;
  select a.entry_hash into v_previous from public.audit_chain_log a order by a.sequence desc limit 1;
  v_payload_hash := encode(digest(coalesce(p_payload,'{}'::jsonb)::text, 'sha256'), 'hex');
  v_entry_hash := encode(digest(
    coalesce(v_previous,'GENESIS') || '|' || v_sequence::text || '|' || coalesce(p_event_type,'') || '|' ||
    coalesce(p_entity_type,'') || '|' || coalesce(p_entity_id,'') || '|' || v_payload_hash,
    'sha256'
  ), 'hex');

  insert into public.audit_chain_log(sequence, event_type, entity_type, entity_id, actor_user_id, source_ref, payload, payload_hash, previous_hash, entry_hash)
  values (v_sequence, p_event_type, p_entity_type, p_entity_id, p_actor_user_id, p_source_ref, coalesce(p_payload,'{}'::jsonb), v_payload_hash, v_previous, v_entry_hash);

  sequence := v_sequence;
  entry_hash := v_entry_hash;
  return next;
end;
$$;

create or replace function public.verify_audit_chain()
returns table(valid boolean, broken_sequence bigint, expected_hash text, actual_hash text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_previous text := null;
  v_expected text;
begin
  for r in select * from public.audit_chain_log order by sequence asc
  loop
    v_expected := encode(digest(
      coalesce(v_previous,'GENESIS') || '|' || r.sequence::text || '|' || coalesce(r.event_type,'') || '|' ||
      coalesce(r.entity_type,'') || '|' || coalesce(r.entity_id,'') || '|' || r.payload_hash,
      'sha256'
    ), 'hex');
    if r.previous_hash is distinct from v_previous or r.entry_hash <> v_expected then
      valid := false;
      broken_sequence := r.sequence;
      expected_hash := v_expected;
      actual_hash := r.entry_hash;
      return next;
      return;
    end if;
    v_previous := r.entry_hash;
  end loop;
  valid := true;
  broken_sequence := null;
  expected_hash := null;
  actual_hash := null;
  return next;
end;
$$;

revoke all on function public.post_balanced_journal_entry(text,text,text,text,text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.append_audit_chain_event(text,text,text,jsonb,uuid,text) from public, anon, authenticated;
revoke all on function public.verify_audit_chain() from public, anon, authenticated;
grant execute on function public.post_balanced_journal_entry(text,text,text,text,text,jsonb,jsonb) to service_role;
grant execute on function public.append_audit_chain_event(text,text,text,jsonb,uuid,text) to service_role;
grant execute on function public.verify_audit_chain() to service_role;

comment on table public.spatial_assets is 'Server-authoritative 3D creation inventory for the VoxelVault spatial wallet.';
comment on table public.wallet_links is 'Wallet addresses linked to a VoxelVault account only after a signed ownership challenge.';
comment on table public.journal_entries is 'Double-entry financial events posted only through post_balanced_journal_entry.';
comment on table public.audit_chain_log is 'Tamper-evident SHA-256 chain. Same-database storage is not described as externally immutable.';
