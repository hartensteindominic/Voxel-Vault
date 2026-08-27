create unique index if not exists spatial_assets_source_unique
  on public.spatial_assets(owner_user_id, source_kind, source_session_id, coalesce(source_task_id, ''))
  where source_session_id is not null;

create unique index if not exists spatial_assets_verified_token_unique
  on public.spatial_assets(chain_id, lower(contract_address), token_id)
  where chain_id is not null and contract_address is not null and token_id is not null and state = 'minted';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'wallet_links_address_format'
  ) then
    alter table public.wallet_links
      add constraint wallet_links_address_format check (wallet_address ~ '^0x[0-9a-f]{40}$');
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'wallet_link_challenges_address_format'
  ) then
    alter table public.wallet_link_challenges
      add constraint wallet_link_challenges_address_format check (wallet_address ~ '^0x[0-9a-f]{40}$');
  end if;
end $$;

-- Keep expired challenges short-lived; server code treats used/expired rows as invalid.
create index if not exists wallet_link_challenges_expiry_idx
  on public.wallet_link_challenges(expires_at)
  where used_at is null;
