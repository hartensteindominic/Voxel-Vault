import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../../lib/admin-auth';
import { fetchErieCountySpatialIntake } from '../../../../../lib/real-estate/erie-county-gis.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

function statusFor(error: unknown) {
  const code = String((error as { code?: string })?.code || '');
  if (code === 'INVALID_PARCEL_KEY') return 400;
  if (code === 'PARCEL_NOT_FOUND') return 404;
  if (code === 'AMBIGUOUS_PARCEL') return 409;
  if (code === 'GIS_UNAVAILABLE') return 502;
  return 500;
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if ('error' in auth) {
    return response({
      ok: false,
      error: auth.error,
      setupRequired: Boolean(auth.setupRequired),
    }, auth.status);
  }

  const url = new URL(request.url);
  const pin = String(url.searchParams.get('pin') || '').trim();
  const sbl = String(url.searchParams.get('sbl') || '').trim();

  try {
    const intake = await fetchErieCountySpatialIntake({ pin, sbl });
    return response({
      ...intake,
      authorized: true,
      intakeMode: 'owner-only-reference-intake',
      controls: {
        canChangeDeed: false,
        canEstablishTitle: false,
        canCreatePropertyRights: false,
        canMintOwnershipInterest: false,
        humanTitleReviewRequired: true,
        separateLegalRightsEvidenceRequired: true,
      },
      nextStep: 'Review the source-backed spatial record, then add a separate trusted building-height source and separate title/legal-rights evidence before any ownership status can advance beyond REFERENCE ONLY.',
    });
  } catch (error) {
    const status = statusFor(error);
    return response({
      ok: false,
      error: error instanceof Error ? error.message : 'Erie County spatial intake failed.',
      code: String((error as { code?: string })?.code || 'UNKNOWN_ERROR'),
      legalEffects: {
        establishesDeedOwnership: false,
        establishesTitleStatus: false,
        createsBlockchainRights: false,
      },
    }, status);
  }
}
