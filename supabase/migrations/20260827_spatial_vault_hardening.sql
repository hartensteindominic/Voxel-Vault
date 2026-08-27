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

-- The first migration creates a cents-shaped bigint because current commerce is USD.
-- Generalize the leg amount before release so the same balanced journal can also store
-- ETH wei without pretending crypto amounts are cents.
alter table public.journal_legs rename column amount_cents to amount_minor;
alter table public.journal_legs alter column amount_minor type numeric(78,0) using amount_minor::numeric;

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
  v_debits numeric(78,0) := 0;
  v_credits numeric(78,0) := 0;
  v_leg jsonb;
  v_amount numeric(78,0);
  v_direction text;
  v_account text;
  v_amount_text text;
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
    v_amount_text := coalesce(v_leg->>'amountMinor', v_leg->>'amountCents', '');
    begin
      v_amount := v_amount_text::numeric(78,0);
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
    v_amount_text := coalesce(v_leg->>'amountMinor', v_leg->>'amountCents', '');
    insert into public.journal_legs(entry_id, account_code, direction, amount_minor)
    values (
      v_entry_id,
      btrim(v_leg->>'accountCode'),
      lower(v_leg->>'direction'),
      v_amount_text::numeric(78,0)
    );
  end loop;

  return v_entry_id;
end;
$$;

-- Keep expired challenges short-lived; server code treats used/expired rows as invalid.
create index if not exists wallet_link_challenges_expiry_idx
  on public.wallet_link_challenges(expires_at)
  where used_at is null;
