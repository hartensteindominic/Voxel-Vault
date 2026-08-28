import { NextResponse } from 'next/server';
import { inspectWorldAtlas } from '../../../../lib/world-atlas.js';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

function optionalNumber(value: string | null) {
  if (value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const latitude = optionalNumber(url.searchParams.get('lat'));
    const longitude = optionalNumber(url.searchParams.get('lng'));
    const radiusMeters = optionalNumber(url.searchParams.get('radius'));
    const address = String(url.searchParams.get('address') || '').trim().slice(0, 180);

    const result = await inspectWorldAtlas({ latitude, longitude, radiusMeters, address });
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'World atlas lookup failed.',
      buildings: [],
      rights: {
        createsPhysicalPropertyOwnership: false,
        createsExclusiveMapDataOwnership: false,
      },
    }, { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}