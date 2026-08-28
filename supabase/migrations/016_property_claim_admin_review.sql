alter table public.vault_property_identities
  add column if not exists verified_claim_id uuid references public.vault_property_claims(id) on delete restrict,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

create unique index if not exists vault_property_identities_verified_claim_idx
  on public.vault_property_identities(verified_claim_id)
  where verified_claim_id is not null;

-- Service-role-only review transition. The web route must authenticate an allowlisted
-- Voxel Vault admin before calling this function. This function verifies only the
-- off-chain claim/identity record; it deliberately does NOT set registry_verified,
-- mint a Property Passport, transfer a deed, or create economic rights.
create or replace function public.admin_review_property_claim(
  p_claim_id uuid,
  p_decision text,
  p_reviewer_user_id uuid,
  p_reviewer_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claim public.vault_property_claims%rowtype;
  v_identity public.vault_property_identities%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_note text := trim(coalesce(p_reviewer_note, ''));
begin
  if p_reviewer_user_id is null then
    raise exception 'REVIEWER_REQUIRED';
  end if;

  if v_decision not in ('approve', 'reject') then
    raise exception 'INVALID_REVIEW_DECISION';
  end if;

  if char_length(v_note) < 20 or char_length(v_note) > 1000 then
    raise exception 'REVIEWER_NOTE_LENGTH_INVALID';
  end if;

  select * into v_claim
  from public.vault_property_claims
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'PROPERTY_CLAIM_NOT_FOUND';
  end if;

  select * into v_identity
  from public.vault_property_identities
  where id = v_claim.property_identity_id
  for update;

  if not found then
    raise exception 'PROPERTY_IDENTITY_NOT_FOUND';
  end if;

  if v_decision = 'approve' then
    if v_claim.claim_status <> 'under-review' then
      raise exception 'CLAIM_NOT_READY_FOR_APPROVAL';
    end if;

    if v_claim.owner_authorized is not true then
      raise exception 'OWNER_AUTHORIZATION_REQUIRED';
    end if;

    if not (
      coalesce(v_claim.evidence_manifest->'types', '[]'::jsonb) ? 'parcel-record'
      and coalesce(v_claim.evidence_manifest->'types', '[]'::jsonb) ? 'ownership-or-control'
      and coalesce(v_claim.evidence_manifest->'types', '[]'::jsonb) ? 'model-capture-rights'
    ) then
      raise exception 'REQUIRED_EVIDENCE_METADATA_MISSING';
    end if;

    if v_identity.verified_claim_id is not null and v_identity.verified_claim_id <> v_claim.id then
      raise exception 'PROPERTY_ALREADY_VERIFIED_BY_ANOTHER_CLAIM';
    end if;

    update public.vault_property_claims
    set claim_status = 'verified',
        reviewer_note = v_note,
        reviewed_at = now(),
        updated_at = now()
    where id = v_claim.id;

    update public.vault_property_identities
    set canonical_state = 'verified',
        verified_claim_id = v_claim.id,
        verified_at = now(),
        verified_by = p_reviewer_user_id,
        updated_at = now()
    where id = v_identity.id;

    return jsonb_build_object(
      'claimId', v_claim.id,
      'status', 'verified',
      'canonicalState', 'verified',
      'registryVerified', v_identity.registry_verified,
      'passportMinted', false,
      'deedChanged', false
    );
  end if;

  if v_claim.claim_status not in ('needs-evidence', 'under-review') then
    raise exception 'CLAIM_NOT_REVIEWABLE';
  end if;

  update public.vault_property_claims
  set claim_status = 'rejected',
      reviewer_note = v_note,
      reviewed_at = now(),
      updated_at = now()
  where id = v_claim.id;

  return jsonb_build_object(
    'claimId', v_claim.id,
    'status', 'rejected',
    'canonicalState', v_identity.canonical_state,
    'registryVerified', v_identity.registry_verified,
    'passportMinted', false,
    'deedChanged', false
  );
end;
$$;

revoke all on function public.admin_review_property_claim(uuid, text, uuid, text) from public;
revoke all on function public.admin_review_property_claim(uuid, text, uuid, text) from anon;
revoke all on function public.admin_review_property_claim(uuid, text, uuid, text) from authenticated;
grant execute on function public.admin_review_property_claim(uuid, text, uuid, text) to service_role;
