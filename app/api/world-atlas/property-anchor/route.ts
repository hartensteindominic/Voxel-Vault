import { NextResponse } from 'next/server';
import { resolveBuffaloAtlasAnchor } from '../../../../lib/real-estate/buffalo-atlas-anchor.js';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (String(body?.type || '').trim() !== 'buffalo-parcel') {
      return NextResponse.json({ ok: false, error: 'Unsupported authoritative property anchor type.' }, { status: 400 });
    }
    const result = await resolveBuffaloAtlasAnchor({
      sbl: body?.sbl,
      pin: body?.pin,
      address: body?.address,
      radiusMeters: body?.radiusMeters,
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Authoritative property anchor failed.',
      legalEffects: {
        createsOwnership: false,
        createsTitle: false,
        createsSecurity: false,
        createsGovernmentTax: false,
        createsExclusiveMapDataOwnership: false,
      },
    }, { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
