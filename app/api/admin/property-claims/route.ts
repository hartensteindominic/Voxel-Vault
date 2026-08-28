import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store, private' } });
}

function setupMissing(error: any) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '42P01'
    || code === '42703'
    || code === '42883'
    || /vault_property_(claims|identities)/i.test(message)
    || /admin_review_property_claim/i.test(message);
}

function safeClaim(row: any) {
  const identity = row?.vault_property_identities || {};
  const userId = String(row?.user_id || '');
  return {
    id: String(row?.id || ''),
    claimantUserSuffix: userId ? userId.slice(-8) : '',
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
      verifiedClaimId: String(identity?.verified_claim_id || ''),
    },
  };
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if (!auth.ok) return response({ ok: false, error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  const { data, error } = await auth.admin
    .from('vault_property_claims')
    .select('id,user_id,claimant_role,owner_authorized,property_label,locality,claim_status,evidence_manifest,reviewer_note,submitted_at,reviewed_at,vault_property_identities!inner(id,property_fingerprint,country_code,subdivision_code,county_code,parcel_id_normalized,canonical_state,registry_verified,registry_property_id,canonical_passport_token_id,verified_claim_id)')
    .order('submitted_at', { ascending: false })
    .limit(100);

  if (error) {
    if (setupMissing(error)) return response({ ok: false, setupRequired: true, error: 'Apply Supabase migrations 015 and 016 before reviewing property claims.' }, 503);
    return response({ ok: false, error: 'Property claims could not be loaded for review.' }, 500);
  }

  return response({
    ok: true,
    authorized: true,
    claims: (Array.isArray(data) ? data : []).map(safeClaim),
    controls: {
      canMintPassport: false,
      canSetOnchainRegistryVerified: false,
      canChangeDeed: false,
      humanEvidenceReviewRequired: true,
      competingVerifiedClaimsAllowed: false,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if (!auth.ok) return response({ ok: false, error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  const body = await request.json().catch(() => ({}));
  const claimId = String(body?.claimId || '').trim();
  const decision = String(body?.decision || '').trim().toLowerCase();
  const reviewerNote = String(body?.reviewerNote || '').trim();
  const evidenceVerified = body?.evidenceVerified === true;

  if (!claimId) return response({ ok: false, error: 'claimId is required.' }, 400);
  if (!['verified', 'rejected', 'needs-evidence'].includes(decision)) return response({ ok: false, error: 'Decision must be verified, rejected or needs-evidence.' }, 400);
  if (reviewerNote.length < 20 || reviewerNote.length > 1000) {
    return response({ ok: false, error: 'Reviewer note must be between 20 and 1000 characters and describe the evidence checked.' }, 400);
  }

  if (decision === 'verified' && !evidenceVerified) {
    return response({
      ok: false,
      error: 'Verification requires an explicit reviewer confirmation that the external parcel, ownership/control, and model-capture evidence was actually checked.',
    }, 409);
  }

  if (decision === 'needs-evidence') {
    const current = await auth.admin
      .from('vault_property_claims')
      .select('id,claim_status')
      .eq('id', claimId)
      .maybeSingle();

    if (current.error || !current.data) {
      if (setupMissing(current.error)) return response({ ok: false, setupRequired: true, error: 'Apply Supabase migrations 015 and 016 before reviewing property claims.' }, 503);
      return response({ ok: false, error: 'Property claim was not found.' }, 404);
    }

    if (!['needs-evidence', 'under-review'].includes(String(current.data.claim_status || ''))) {
      return response({ ok: false, error: 'This claim is already in a terminal state and cannot be moved back to evidence collection.' }, 409);
    }

    const reviewedAt = new Date().toISOString();
    const updated = await auth.admin
      .from('vault_property_claims')
      .update({ claim_status: 'needs-evidence', reviewer_note: reviewerNote, reviewed_at: reviewedAt, updated_at: reviewedAt })
      .eq('id', claimId)
      .select('id,claim_status,reviewer_note,reviewed_at')
      .single();

    if (updated.error || !updated.data) return response({ ok: false, error: 'The request for additional evidence could not be stored.' }, 500);

    return response({
      ok: true,
      decision,
      claim: updated.data,
      onchainRegistryVerified: false,
      passportMinted: false,
      deedChanged: false,
      propertyRightsCreated: false,
      nextStep: 'The claimant must add the missing evidence categories before the claim can return to human verification.',
    });
  }

  const rpcDecision = decision === 'verified' ? 'approve' : 'reject';
  const { data, error } = await auth.admin.rpc('admin_review_property_claim', {
    p_claim_id: claimId,
    p_decision: rpcDecision,
    p_reviewer_user_id: auth.user.id,
    p_reviewer_note: reviewerNote,
  });

  if (error) {
    if (setupMissing(error)) return response({ ok: false, setupRequired: true, error: 'Apply Supabase migrations 015 and 016 before reviewing property claims.' }, 503);

    const message = String(error.message || '');
    if (/PROPERTY_ALREADY_VERIFIED_BY_ANOTHER_CLAIM/i.test(message)) {
      return response({ ok: false, error: 'This parcel already has a different verified canonical claim. The competing claim was not approved.' }, 409);
    }
    if (/CLAIM_NOT_READY_FOR_APPROVAL|REQUIRED_EVIDENCE_METADATA_MISSING|OWNER_AUTHORIZATION_REQUIRED/i.test(message)) {
      return response({ ok: false, error: 'This claim is not eligible for approval yet. Required authorization/evidence gates are incomplete.' }, 409);
    }
    if (/CLAIM_NOT_REVIEWABLE/i.test(message)) {
      return response({ ok: false, error: 'This claim is already in a terminal state and cannot be reviewed again.' }, 409);
    }
    if (/PROPERTY_CLAIM_NOT_FOUND/i.test(message)) {
      return response({ ok: false, error: 'Property claim was not found.' }, 404);
    }

    return response({ ok: false, error: 'Property claim decision could not be stored.' }, 500);
  }

  return response({
    ok: true,
    decision,
    review: data,
    onchainRegistryVerified: false,
    passportMinted: false,
    deedChanged: false,
    propertyRightsCreated: false,
    nextStep: decision === 'verified'
      ? 'The off-chain canonical identity is human-verified. A separate controlled registry-anchor step is still required before the non-transferable canonical Property Passport can be minted.'
      : 'The claim is rejected and remains outside the canonical Property Passport path.',
  });
}
