-- Bind human-approved property claims to one authoritative parcel identity.
-- Candidate claim fingerprints may still use user-entered jurisdiction labels, but a
-- claim cannot become verified until an admin supplies a stable official jurisdiction
-- namespace/code plus parcel/APN from an independently checked source.

alter table public.vault_property_identities
  add column if not exists verified_property_fingerprint text,
  add column if not exists verified_property_namespace text,
  add column if not exists verified_property_source text,
  add column if not exists verified_property_source_checked_at timestamptz;

alter table public.vault_property_identities
  drop constraint if exists vault_property_identities_verified_property_fingerprint_check;

alter table public.vault_property_identities
  add constraint vault_property_identities_verified_property_fingerprint_check
  check (
    verified_property_fingerprint is null
    or verified_property_fingerprint ~ '^[0-9a-f]{64}$'
  );

create unique index if not exists vault_property_identities_verified_property_fingerprint_idx
  on public.vault_property_identities(verified_property_fingerprint)
  where verified_property_fingerprint is not null;

-- Remove the old approval signature so there is no alternate path that can approve a
-- claim without an authoritative property fingerprint.
drop function if exists public.admin_review_property_claim(uuid, text, uuid, text);
drop function if exists public.admin_review_property_claim(uuid, text, uuid, text, text, text, text);

create function public.admin_review_property_claim(
  p_claim_id uuid,
  p_decision text,
  p_reviewer_user_id uuid,
  p_reviewer_note text,
  p_authoritative_fingerprint text,
  p_authoritative_namespace text,
  p_authoritative_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claim public.vault_property_claims%rowtype;
  v_identity public.vault_property_identities%rowtype;
  v_conflict_identity uuid;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_note text := trim(coalesce(p_reviewer_note, ''));
  v_fingerprint text := lower(trim(coalesce(p_authoritative_fingerprint, '')));
  v_namespace text := trim(coalesce(p_authoritative_namespace, ''));
  v_source text := trim(coalesce(p_authoritative_source, ''));
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

    if v_fingerprint !~ '^[0-9a-f]{64}$' then
      raise exception 'AUTHORITATIVE_PROPERTY_FINGERPRINT_REQUIRED';
    end if;

    if char_length(v_namespace) < 2 or char_length(v_namespace) > 96 then
      raise exception 'AUTHORITATIVE_PROPERTY_NAMESPACE_REQUIRED';
    end if;

    if char_length(v_source) < 5 or char_length(v_source) > 240 then
      raise exception 'AUTHORITATIVE_PROPERTY_SOURCE_REQUIRED';
    end if;

    if v_identity.verified_claim_id is not null and v_identity.verified_claim_id <> v_claim.id then
      raise exception 'PROPERTY_ALREADY_VERIFIED_BY_ANOTHER_CLAIM';
    end if;

    if v_identity.verified_property_fingerprint is not null
       and v_identity.verified_property_fingerprint <> v_fingerprint then
      raise exception 'PROPERTY_AUTHORITATIVE_IDENTITY_ALREADY_ASSIGNED';
    end if;

    select id into v_conflict_identity
    from public.vault_property_identities
    where verified_property_fingerprint = v_fingerprint
      and id <> v_identity.id
    limit 1
    for update;

    if v_conflict_identity is not null then
      raise exception 'PROPERTY_AUTHORITATIVE_IDENTITY_CONFLICT';
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
        verified_property_fingerprint = v_fingerprint,
        verified_property_namespace = v_namespace,
        verified_property_source = v_source,
        verified_property_source_checked_at = now(),
        updated_at = now()
    where id = v_identity.id;

    return jsonb_build_object(
      'claimId', v_claim.id,
      'status', 'verified',
      'canonicalState', 'verified',
      'verifiedPropertyFingerprintSuffix', right(v_fingerprint, 12),
      'registryVerified', v_identity.registry_verified,
      'passportMinted', false,
      'deedChanged', false,
      'propertyRightsCreated', false
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
    'deedChanged', false,
    'propertyRightsCreated', false
  );
end;
$$;

revoke all on function public.admin_review_property_claim(uuid, text, uuid, text, text, text, text) from public;
revoke all on function public.admin_review_property_claim(uuid, text, uuid, text, text, text, text) from anon;
revoke all on function public.admin_review_property_claim(uuid, text, uuid, text, text, text, text) from authenticated;
grant execute on function public.admin_review_property_claim(uuid, text, uuid, text, text, text, text) to service_role;
