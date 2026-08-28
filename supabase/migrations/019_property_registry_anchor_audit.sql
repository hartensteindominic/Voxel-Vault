-- Durable audit state for the Base Sepolia canonical property identity registry.
-- This migration does not mint a Passport, alter a deed, or create economic rights.

alter table public.vault_property_identities
  add column if not exists registry_chain_id bigint,
  add column if not exists registry_contract_address text,
  add column if not exists registry_registered_tx_hash text,
  add column if not exists registry_registered_at timestamptz,
  add column if not exists registry_verified_tx_hash text,
  add column if not exists registry_verified_at timestamptz,
  add column if not exists registry_claim_hash text,
  add column if not exists registry_source_hash text,
  add column if not exists registry_metadata_uri text;

alter table public.vault_property_identities
  drop constraint if exists vault_property_identities_registry_chain_check;
alter table public.vault_property_identities
  add constraint vault_property_identities_registry_chain_check
  check (registry_chain_id is null or registry_chain_id = 84532);

alter table public.vault_property_identities
  drop constraint if exists vault_property_identities_registry_contract_check;
alter table public.vault_property_identities
  add constraint vault_property_identities_registry_contract_check
  check (registry_contract_address is null or registry_contract_address ~ '^0x[0-9a-fA-F]{40}$');

alter table public.vault_property_identities
  drop constraint if exists vault_property_identities_registry_property_id_check;
alter table public.vault_property_identities
  add constraint vault_property_identities_registry_property_id_check
  check (registry_property_id = '' or registry_property_id ~ '^0x[0-9a-fA-F]{64}$');

alter table public.vault_property_identities
  drop constraint if exists vault_property_identities_registry_registered_tx_check;
alter table public.vault_property_identities
  add constraint vault_property_identities_registry_registered_tx_check
  check (registry_registered_tx_hash is null or registry_registered_tx_hash ~ '^0x[0-9a-fA-F]{64}$');

alter table public.vault_property_identities
  drop constraint if exists vault_property_identities_registry_verified_tx_check;
alter table public.vault_property_identities
  add constraint vault_property_identities_registry_verified_tx_check
  check (registry_verified_tx_hash is null or registry_verified_tx_hash ~ '^0x[0-9a-fA-F]{64}$');

alter table public.vault_property_identities
  drop constraint if exists vault_property_identities_registry_claim_hash_check;
alter table public.vault_property_identities
  add constraint vault_property_identities_registry_claim_hash_check
  check (registry_claim_hash is null or registry_claim_hash ~ '^0x[0-9a-fA-F]{64}$');

alter table public.vault_property_identities
  drop constraint if exists vault_property_identities_registry_source_hash_check;
alter table public.vault_property_identities
  add constraint vault_property_identities_registry_source_hash_check
  check (registry_source_hash is null or registry_source_hash ~ '^0x[0-9a-fA-F]{64}$');

create table if not exists public.vault_property_registry_anchor_events (
  id uuid primary key default gen_random_uuid(),
  property_identity_id uuid not null references public.vault_property_identities(id) on delete restrict,
  action text not null check (action in ('register','verify')),
  chain_id bigint not null check (chain_id = 84532),
  contract_address text not null check (contract_address ~ '^0x[0-9a-fA-F]{40}$'),
  property_id text not null check (property_id ~ '^0x[0-9a-fA-F]{64}$'),
  tx_hash text not null unique check (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  block_number bigint not null check (block_number >= 0),
  actor_address text not null check (actor_address ~ '^0x[0-9a-fA-F]{40}$'),
  claim_hash text not null check (claim_hash ~ '^0x[0-9a-fA-F]{64}$'),
  source_hash text not null check (source_hash ~ '^0x[0-9a-fA-F]{64}$'),
  metadata_uri text not null default '' check (char_length(metadata_uri) <= 500),
  created_at timestamptz not null default now(),
  unique (property_identity_id, action)
);

alter table public.vault_property_registry_anchor_events enable row level security;
revoke all on table public.vault_property_registry_anchor_events from anon, authenticated;
grant select, insert on table public.vault_property_registry_anchor_events to service_role;

create index if not exists vault_property_registry_anchor_events_identity_idx
  on public.vault_property_registry_anchor_events(property_identity_id, created_at);

create or replace function public.record_property_registry_anchor(
  p_property_identity_id uuid,
  p_action text,
  p_chain_id bigint,
  p_contract_address text,
  p_property_id text,
  p_tx_hash text,
  p_block_number bigint,
  p_actor_address text,
  p_claim_hash text,
  p_source_hash text,
  p_metadata_uri text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_identity public.vault_property_identities%rowtype;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_contract text := lower(trim(coalesce(p_contract_address, '')));
  v_property_id text := lower(trim(coalesce(p_property_id, '')));
  v_tx_hash text := lower(trim(coalesce(p_tx_hash, '')));
  v_actor text := lower(trim(coalesce(p_actor_address, '')));
  v_claim_hash text := lower(trim(coalesce(p_claim_hash, '')));
  v_source_hash text := lower(trim(coalesce(p_source_hash, '')));
  v_metadata text := trim(coalesce(p_metadata_uri, ''));
begin
  if v_action not in ('register', 'verify') then raise exception 'INVALID_REGISTRY_ANCHOR_ACTION'; end if;
  if p_chain_id <> 84532 then raise exception 'PROPERTY_REGISTRY_BASE_SEPOLIA_ONLY'; end if;
  if v_contract !~ '^0x[0-9a-f]{40}$' then raise exception 'INVALID_REGISTRY_CONTRACT'; end if;
  if v_property_id !~ '^0x[0-9a-f]{64}$' then raise exception 'INVALID_REGISTRY_PROPERTY_ID'; end if;
  if v_tx_hash !~ '^0x[0-9a-f]{64}$' then raise exception 'INVALID_REGISTRY_TX_HASH'; end if;
  if v_actor !~ '^0x[0-9a-f]{40}$' then raise exception 'INVALID_REGISTRY_ACTOR'; end if;
  if v_claim_hash !~ '^0x[0-9a-f]{64}$' then raise exception 'INVALID_REGISTRY_CLAIM_HASH'; end if;
  if v_source_hash !~ '^0x[0-9a-f]{64}$' then raise exception 'INVALID_REGISTRY_SOURCE_HASH'; end if;
  if char_length(v_metadata) > 500 then raise exception 'REGISTRY_METADATA_URI_TOO_LONG'; end if;

  select * into v_identity
  from public.vault_property_identities
  where id = p_property_identity_id
  for update;

  if not found then raise exception 'PROPERTY_IDENTITY_NOT_FOUND'; end if;
  if v_identity.canonical_state not in ('verified','passport-minted') then raise exception 'PROPERTY_IDENTITY_NOT_HUMAN_VERIFIED'; end if;
  if v_identity.verified_claim_id is null then raise exception 'PROPERTY_VERIFIED_CLAIM_REQUIRED'; end if;
  if v_identity.verified_property_fingerprint is null then raise exception 'AUTHORITATIVE_PROPERTY_FINGERPRINT_REQUIRED'; end if;
  if v_property_id <> ('0x' || lower(v_identity.verified_property_fingerprint)) then raise exception 'REGISTRY_PROPERTY_ID_MISMATCH'; end if;

  if v_action = 'register' then
    if v_identity.registry_registered_tx_hash is not null then raise exception 'PROPERTY_REGISTRY_ALREADY_REGISTERED'; end if;
    if v_identity.registry_verified is true then raise exception 'PROPERTY_REGISTRY_ALREADY_VERIFIED'; end if;

    update public.vault_property_identities
    set registry_chain_id = p_chain_id,
        registry_contract_address = v_contract,
        registry_property_id = v_property_id,
        registry_registered_tx_hash = v_tx_hash,
        registry_registered_at = now(),
        registry_claim_hash = v_claim_hash,
        registry_source_hash = v_source_hash,
        registry_metadata_uri = v_metadata,
        updated_at = now()
    where id = v_identity.id;
  else
    if v_identity.registry_registered_tx_hash is null then raise exception 'PROPERTY_REGISTRY_REGISTRATION_REQUIRED'; end if;
    if lower(coalesce(v_identity.registry_contract_address, '')) <> v_contract then raise exception 'REGISTRY_CONTRACT_MISMATCH'; end if;
    if lower(coalesce(v_identity.registry_property_id, '')) <> v_property_id then raise exception 'REGISTRY_PROPERTY_ID_MISMATCH'; end if;
    if lower(coalesce(v_identity.registry_claim_hash, '')) <> v_claim_hash then raise exception 'REGISTRY_CLAIM_HASH_MISMATCH'; end if;
    if lower(coalesce(v_identity.registry_source_hash, '')) <> v_source_hash then raise exception 'REGISTRY_SOURCE_HASH_MISMATCH'; end if;

    update public.vault_property_identities
    set registry_verified = true,
        registry_verified_tx_hash = v_tx_hash,
        registry_verified_at = now(),
        updated_at = now()
    where id = v_identity.id;
  end if;

  insert into public.vault_property_registry_anchor_events(
    property_identity_id, action, chain_id, contract_address, property_id,
    tx_hash, block_number, actor_address, claim_hash, source_hash, metadata_uri
  ) values (
    v_identity.id, v_action, p_chain_id, v_contract, v_property_id,
    v_tx_hash, p_block_number, v_actor, v_claim_hash, v_source_hash, v_metadata
  );

  return jsonb_build_object(
    'propertyIdentityId', v_identity.id,
    'action', v_action,
    'propertyId', v_property_id,
    'registryVerified', v_action = 'verify'
  );
end;
$$;

revoke all on function public.record_property_registry_anchor(uuid,text,bigint,text,text,text,bigint,text,text,text,text) from public, anon, authenticated;
grant execute on function public.record_property_registry_anchor(uuid,text,bigint,text,text,text,bigint,text,text,text,text) to service_role;
