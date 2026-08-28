create table if not exists public.vault_property_identities (
  id uuid primary key default gen_random_uuid(),
  property_fingerprint text not null unique check (char_length(property_fingerprint) = 64),
  country_code text not null check (char_length(country_code) = 2),
  subdivision_code text not null default '' check (char_length(subdivision_code) <= 32),
  county_code text not null default '' check (char_length(county_code) <= 64),
  parcel_id_normalized text not null check (char_length(parcel_id_normalized) between 1 and 128),
  canonical_state text not null default 'unverified' check (canonical_state in ('unverified','verified','passport-minted','suspended')),
  registry_property_id text not null default '' check (char_length(registry_property_id) <= 96),
  registry_verified boolean not null default false,
  canonical_passport_token_id text not null default '' check (char_length(canonical_passport_token_id) <= 96),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vault_property_claims (
  id uuid primary key default gen_random_uuid(),
  property_identity_id uuid not null references public.vault_property_identities(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  claimant_role text not null check (claimant_role in ('owner','authorized-controller')),
  owner_authorized boolean not null default false,
  property_label text not null default '' check (char_length(property_label) <= 120),
  locality text not null default '' check (char_length(locality) <= 120),
  claim_status text not null default 'needs-evidence' check (claim_status in ('needs-evidence','under-review','verified','rejected','withdrawn')),
  evidence_manifest jsonb not null default '{"types":[]}'::jsonb,
  reviewer_note text not null default '' check (char_length(reviewer_note) <= 1000),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_identity_id, user_id)
);

alter table public.vault_property_identities enable row level security;
alter table public.vault_property_claims enable row level security;

-- Identity rows are deliberately server-controlled. There are no client write policies.
-- A user may read only their own claim. The canonical identity is returned through a
-- server route that strips raw parcel identifiers and internal review data.
create policy "users read own property claims"
on public.vault_property_claims
for select to authenticated
using (user_id = auth.uid());

create index if not exists vault_property_identities_fingerprint_idx
  on public.vault_property_identities(property_fingerprint);

create index if not exists vault_property_claims_user_idx
  on public.vault_property_claims(user_id, claim_status, submitted_at desc);

create index if not exists vault_property_claims_identity_idx
  on public.vault_property_claims(property_identity_id, claim_status);

-- Multiple parties may submit competing claims for review, but only one claim may ever
-- become the verified canonical claim for a property identity.
create unique index if not exists vault_property_claims_one_verified_identity_idx
  on public.vault_property_claims(property_identity_id)
  where claim_status = 'verified';
