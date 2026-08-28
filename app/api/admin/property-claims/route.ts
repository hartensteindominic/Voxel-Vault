import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../lib/admin-auth';
import { PROPERTY_EVIDENCE_TYPES } from '../../../../lib/vault/property-claim.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store, private' } });
}

function setupMissing(error: any) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '42P01' || /vault_property_(claims|identities)/i.test(message);
}

function safeClaim(row: any) {
  const identity = row?.vault_property_identities || {};
  return {
    id: String(row?.id || ''),
    userId: String(row?.user_id || ''),
    claimantRole: String(row?.claimant_role || ''),
    ownerAuthorized: row?.owner_authorized === true,
    propertyLabel: String(row?.property_label || ''),
    locality: String(row?.locality || ''),
    status: String(row?.claim_status || ''),
    evidenceTypes: Array.isArray(row?.evidence_manifest?.types) ? row.evidence_manifest.types : [],
    reviewerNote: String(row?.reviewer_note || ''),
    submittedAt: row?.submitted_at || null,
    reviewedAt: row?.reviewed_at || null,
    identity: {
      id: String(identity?.id || ''),
      fingerprintSuffix: String(identity?.property_fingerprint || '').slice(-12),
      countryCode: String(identity?.country_code || ''),
      subdivisionCode: String(identity?.subdivision_code || ''),
      countyCode: String(identity?.county_code || ''),
      parcelIdNormalized: String(identity?.parcel_id_normalized || ''),
      canonicalState: String(identity?.canonical_state || ''),
      registryVerified: identity?.registry_verified === true,
      registryPropertyId: String(identity?.registry_property_id || ''),
      passportTokenId: String(identity?.canonical_passport_token_id || ''),
    },
  };
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if (!auth.ok) return response({ ok: false, error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  const { data, error } = await auth.admin
    .from('vault_property_claims')
    .select('id,user_id,claimant_role,owner_authorized,property_label,locality,claim_status,evidence_manifest,reviewer_note,submitted_at,reviewed_at,vault_property_identities!inner(id,property_fingerprint,country_code,subdivision_code,county_code,parcel_id_normalized,canonical_state,registry_verified,registry_property_id,canonical_passport_token_id)')
    .order('submitted_at', { ascending: false });

  if (error) {
    if (setupMissing(error)) return response({ ok: false, setupRequired: true, error: 'Apply Supabase migration 015 before reviewing property claims.' }, 503);
    return response({ ok: false, error: 'Property claims could not be loaded for review.' }, 500);
  }

  return response({
    ok: true,
    authorized: true,
    claims: (Array.isArray(data) ? data : []).map(safeClaim),
    controls: {
      canMintPassport: false,
      canSetOnchainRegistryVerified: false,
      humanEvidenceReviewRequired: true,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if (!auth.ok) return response({ ok: false, error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  const body = await request.json().catch(() => ({}));
  const claimId = String(body?.claimId || '').trim();
  const decision = String(body?.decision || '').trim().toLowerCase();
  const reviewerNote = String(body?.reviewerNote || '').trim().slice(0, 1000);
  const evidenceVerified = body?.evidenceVerified === true;

  if (!claimId) return response({ ok: false, error: 'claimId is required.' }, 400);
  if (!['verified', 'rejected', 'needs-evidence'].includes(decision)) return response({ ok: false, error: 'Decision must be verified, rejected or needs-evidence.' }, 400);
  if (!reviewerNote) return response({ ok: false, error: 'A reviewer note is required for every claim decision.' }, 400);

  const current = await auth.admin
    .from('vault_property_claims')
    .select('id,property_identity_id,claim_status,owner_authorized,evidence_manifest')
    .eq('id', claimId)
    .maybeSingle();

  if (current.error || !current.data) {
    if (setupMissing(current.error)) return response({ ok: false, setupRequired: true, error: 'Apply Supabase migration 015 before reviewing property claims.' }, 503);
    return response({ ok: false, error: 'Property claim was not found.' }, 404);
  }

  if (current.data.claim_status === 'verified') {
    return response({ ok: false, error: 'A verified claim is immutable in this pilot. Future suspension/revocation requires a separate governed workflow.' }, 409);
  }

  if (decision === 'verified') {
    const evidence = new Set(Array.isArray(current.data.evidence_manifest?.types) ? current.data.evidence_manifest.types : []);
    const allCategoriesPresent = PROPERTY_EVIDENCE_TYPES.every((type: string) => evidence.has(type));
    if (current.data.owner_authorized !== true || current.data.claim_status !== 'under-review' || !allCategoriesPresent || !evidenceVerified) {
      return response({
        ok: false,
        error: 'Verification requires an owner-authorized claim already under review, all evidence categories, and an explicit reviewer confirmation that the external evidence was actually checked.',
      }, 409);
    }
  }

  const reviewedAt = new Date().toISOString();
  const updated = await auth.admin
    .from('vault_property_claims')
    .update({ claim_status: decision, reviewer_note: reviewerNote, reviewed_at: reviewedAt, updated_at: reviewedAt })
    .eq('id', claimId)
    .select('id,user_id,claimant_role,owner_authorized,property_label,locality,claim_status,evidence_manifest,reviewer_note,submitted_at,reviewed_at')
    .single();

  if (updated.error || !updated.data) {
    if (String(updated.error?.code || '') === '23505') return response({ ok: false, error: 'Another claim is already the verified claim for this canonical property identity.' }, 409);
    return response({ ok: false, error: 'Property claim decision could not be stored.' }, 500);
  }

  if (decision === 'verified') {
    const identityUpdate = await auth.admin
      .from('vault_property_identities')
      .update({ canonical_state: 'verified', updated_at: reviewedAt })
      .eq('id', current.data.property_identity_id)
      .eq('registry_verified', false);
    if (identityUpdate.error) return response({ ok: false, error: 'The claim was reviewed but the canonical identity state could not be updated.' }, 500);
  }

  return response({
    ok: true,
    decision,
    claim: updated.data,
    onchainRegistryVerified: false,
    passportMinted: false,
    nextStep: decision === 'verified'
      ? 'The off-chain claim is verified. A separate controlled registry-anchoring step is still required before the non-transferable canonical Property Passport can be minted.'
      : 'The claim remains outside the canonical Passport mint path.',
  });
}
