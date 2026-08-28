import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import {
  buildPublicClaimSummary,
  evaluatePropertyClaim,
  PROPERTY_CLAIM_STATUSES,
} from '../../../../lib/vault/property-claim.js';

export const dynamic = 'force-dynamic';

function setupMissing(error: any) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '42P01' || /vault_property_(claims|identities)/i.test(message);
}

function responseForAuthFailure(auth: Awaited<ReturnType<typeof requireVoxelVaultUser>>) {
  if (auth.ok) return null;
  return NextResponse.json(
    { ok: false, error: auth.error, setupRequired: auth.setupRequired === true },
    { status: auth.status }
  );
}

function claimSummary(row: any) {
  const identity = row?.vault_property_identities || row?.propertyIdentity || {};
  return buildPublicClaimSummary({
    id: row?.id,
    status: row?.claim_status,
    claimantRole: row?.claimant_role,
    propertyFingerprint: identity?.property_fingerprint,
    propertyLabel: row?.property_label,
    locality: row?.locality,
    evidenceTypes: row?.evidence_manifest?.types || [],
    registryVerified: identity?.registry_verified === true,
  });
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  const authFailure = responseForAuthFailure(auth);
  if (authFailure) return authFailure;
  if (!auth.ok) return authFailure!;

  const { data, error } = await auth.admin
    .from('vault_property_claims')
    .select('id,claimant_role,property_label,locality,claim_status,evidence_manifest,submitted_at,reviewed_at,vault_property_identities!inner(property_fingerprint,registry_verified,canonical_state)')
    .eq('user_id', auth.user.id)
    .order('submitted_at', { ascending: false });

  if (error) {
    if (setupMissing(error)) {
      return NextResponse.json({
        ok: false,
        setupRequired: true,
        error: 'Property-claim storage is not installed yet. Apply Supabase migration 015 before accepting official property claims.',
      }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: 'Property claims could not be loaded.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    claims: (Array.isArray(data) ? data : []).map(claimSummary),
    rules: {
      oneCanonicalTwinPerParcel: true,
      addressUsedAsIdentityKey: false,
      selfVerificationAllowed: false,
      canonicalMintFromClaimAllowed: false,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  const authFailure = responseForAuthFailure(auth);
  if (authFailure) return authFailure;
  if (!auth.ok) return authFailure!;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'A JSON property claim is required.' }, { status: 400 });
  }

  let evaluation;
  try {
    evaluation = evaluatePropertyClaim(body || {});
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Property identity could not be normalized.',
    }, { status: 400 });
  }

  if (!evaluation.canEnterOfficialReview) {
    return NextResponse.json({
      ok: false,
      error: 'An official Property Passport claim requires the property owner or an authorized controller. A creative building can still exist separately as an unverified digital collectible.',
      officialClaimAllowed: false,
    }, { status: 403 });
  }

  const identityInsert = {
    property_fingerprint: evaluation.fingerprint,
    country_code: evaluation.identity.countryCode,
    subdivision_code: evaluation.identity.subdivisionCode,
    county_code: evaluation.identity.countyCode,
    parcel_id_normalized: evaluation.identity.parcelId,
  };

  const identityResult = await auth.admin
    .from('vault_property_identities')
    .upsert(identityInsert, { onConflict: 'property_fingerprint' })
    .select('id,property_fingerprint,registry_verified,canonical_state')
    .single();

  if (identityResult.error || !identityResult.data) {
    if (setupMissing(identityResult.error)) {
      return NextResponse.json({
        ok: false,
        setupRequired: true,
        error: 'Property-claim storage is not installed yet. Apply Supabase migration 015 before accepting official property claims.',
      }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: 'The canonical property identity could not be reserved.' }, { status: 500 });
  }

  const identity = identityResult.data;
  const existingResult = await auth.admin
    .from('vault_property_claims')
    .select('id,claimant_role,property_label,locality,claim_status,evidence_manifest,submitted_at,reviewed_at')
    .eq('property_identity_id', identity.id)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (existingResult.error) {
    return NextResponse.json({ ok: false, error: 'The existing claim state could not be checked.' }, { status: 500 });
  }

  const propertyLabel = String(body?.propertyLabel || '').trim().slice(0, 120);
  const locality = String(body?.locality || '').trim().slice(0, 120);
  const safeEvidenceManifest = { types: evaluation.evidenceTypes };

  let claimRow: any;
  if (existingResult.data) {
    const currentStatus = String(existingResult.data.claim_status || '');
    if ([PROPERTY_CLAIM_STATUSES.VERIFIED, PROPERTY_CLAIM_STATUSES.REJECTED, PROPERTY_CLAIM_STATUSES.WITHDRAWN].includes(currentStatus as any)) {
      claimRow = existingResult.data;
    } else {
      const updated = await auth.admin
        .from('vault_property_claims')
        .update({
          claimant_role: evaluation.claimantRole,
          owner_authorized: true,
          property_label: propertyLabel,
          locality,
          claim_status: evaluation.status,
          evidence_manifest: safeEvidenceManifest,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingResult.data.id)
        .eq('user_id', auth.user.id)
        .select('id,claimant_role,property_label,locality,claim_status,evidence_manifest,submitted_at,reviewed_at')
        .single();
      if (updated.error || !updated.data) return NextResponse.json({ ok: false, error: 'The property claim could not be updated.' }, { status: 500 });
      claimRow = updated.data;
    }
  } else {
    const inserted = await auth.admin
      .from('vault_property_claims')
      .insert({
        property_identity_id: identity.id,
        user_id: auth.user.id,
        claimant_role: evaluation.claimantRole,
        owner_authorized: true,
        property_label: propertyLabel,
        locality,
        claim_status: evaluation.status,
        evidence_manifest: safeEvidenceManifest,
      })
      .select('id,claimant_role,property_label,locality,claim_status,evidence_manifest,submitted_at,reviewed_at')
      .single();
    if (inserted.error || !inserted.data) return NextResponse.json({ ok: false, error: 'The property claim could not be submitted.' }, { status: 500 });
    claimRow = inserted.data;
  }

  return NextResponse.json({
    ok: true,
    claim: claimSummary({ ...claimRow, vault_property_identities: identity }),
    duplicateProtection: 'Claims for the same normalized jurisdiction + parcel identifier converge on one canonical property fingerprint.',
    nextStep: evaluation.status === PROPERTY_CLAIM_STATUSES.UNDER_REVIEW
      ? 'Human verification must validate the evidence before registry verification or a canonical Passport mint can occur.'
      : 'Add the required evidence categories before the claim can enter human verification.',
  }, { status: existingResult.data ? 200 : 201 });
}
