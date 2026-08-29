import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import { propertyFingerprint } from '../../../../lib/vault/property-claim.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function setupMissing(error: any) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '42P01' || /vault_property_(claims|identities)/i.test(message);
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error, setupRequired: auth.setupRequired === true }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const fingerprint = propertyFingerprint({
      countryCode: body?.countryCode,
      subdivisionCode: body?.subdivisionCode,
      countyCode: body?.countyCode,
      parcelId: body?.parcelId,
    });

    const identityResult = await auth.admin
      .from('vault_property_identities')
      .select('id,canonical_state,registry_verified,canonical_passport_token_id')
      .eq('property_fingerprint', fingerprint)
      .maybeSingle();

    if (identityResult.error) {
      if (setupMissing(identityResult.error)) {
        return NextResponse.json({ ok: false, setupRequired: true, error: 'Property identity storage is not installed yet.' }, { status: 503 });
      }
      throw identityResult.error;
    }

    if (!identityResult.data) {
      return NextResponse.json({
        ok: true,
        state: 'available',
        canonicalExists: false,
        verified: false,
        alreadyMinted: false,
        canSubmitClaim: true,
        canMintNow: false,
        duplicateMintBlocked: true,
        note: 'No canonical property identity is reserved for this normalized parcel yet. Verification is still required before minting.',
      }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
    }

    const identity = identityResult.data;
    const canonicalState = String(identity.canonical_state || 'unverified');
    const alreadyMinted = canonicalState === 'passport-minted' || Boolean(identity.canonical_passport_token_id);
    const verified = canonicalState === 'verified' || alreadyMinted || identity.registry_verified === true;

    const claimResult = await auth.admin
      .from('vault_property_claims')
      .select('id,claim_status')
      .eq('property_identity_id', identity.id)
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (claimResult.error && !setupMissing(claimResult.error)) throw claimResult.error;

    const ownClaimStatus = String(claimResult.data?.claim_status || '');
    const state = alreadyMinted ? 'minted' : verified ? 'verified' : ownClaimStatus ? 'claimed' : 'reserved';

    return NextResponse.json({
      ok: true,
      state,
      canonicalExists: true,
      verified,
      alreadyMinted,
      ownClaimStatus: ownClaimStatus || null,
      canSubmitClaim: !verified,
      canMintNow: Boolean(ownClaimStatus === 'verified' && identity.registry_verified === true && !alreadyMinted),
      duplicateMintBlocked: true,
      note: alreadyMinted
        ? 'This parcel already has its one canonical Property Passport. A second canonical property mint is blocked.'
        : verified
          ? 'This parcel already has a verified canonical identity. A second claimant cannot create another canonical property identity.'
          : ownClaimStatus
            ? 'Your claim is already attached to this one canonical parcel identity.'
            : 'This parcel identity already exists, but it is not yet verified. Competing claims may be reviewed; only one can become canonical.',
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Canonical property status could not be checked.',
    }, { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
