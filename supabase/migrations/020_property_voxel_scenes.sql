-- User-controlled digital scene layer for verified Property Passports.
-- This table stores display references to separately owned Voxel NFTs plus transforms.
-- It does NOT change a deed, property appraisal, rent rights, canonical property identity,
-- or ownership of the attached NFT itself.

create table if not exists public.vault_property_scene_items (
  id uuid primary key default gen_random_uuid(),
  property_identity_id uuid not null references public.vault_property_identities(id) on delete cascade,
  attached_by_user_id uuid not null references auth.users(id) on delete cascade,
  owner_wallet text not null check (owner_wallet ~ '^0x[0-9a-fA-F]{40}$'),
  nft_chain_id bigint not null check (nft_chain_id > 0),
  nft_contract text not null check (nft_contract ~ '^0x[0-9a-fA-F]{40}$'),
  nft_token_id text not null check (char_length(nft_token_id) between 1 and 96),
  token_uri text not null default '' check (char_length(token_uri) <= 4000),
  display_label text not null default '' check (char_length(display_label) <= 80),
  position_x numeric(8,3) not null default 0 check (position_x between -50 and 50),
  position_y numeric(8,3) not null default 0 check (position_y between -10 and 50),
  position_z numeric(8,3) not null default 0 check (position_z between -50 and 50),
  rotation_y numeric(8,4) not null default 0 check (rotation_y between -6.2832 and 6.2832),
  scale numeric(8,3) not null default 1 check (scale between 0.05 and 10),
  ownership_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_identity_id, nft_chain_id, nft_contract, nft_token_id)
);

alter table public.vault_property_scene_items enable row level security;

-- Scene writes are deliberately server-only because the server must verify:
--   1) the signed-in user controls the verified property claim, and
--   2) the connected wallet currently owns the referenced Voxel NFT on-chain.
revoke all on table public.vault_property_scene_items from anon, authenticated;
grant select, insert, update, delete on table public.vault_property_scene_items to service_role;

create index if not exists vault_property_scene_items_property_idx
  on public.vault_property_scene_items(property_identity_id, created_at);

create index if not exists vault_property_scene_items_user_idx
  on public.vault_property_scene_items(attached_by_user_id, updated_at desc);

comment on table public.vault_property_scene_items is
  'Digital-only Property Passport scene decorations. NFT ownership and digital collectible value remain separate from real-property title, appraisal and rent rights.';
