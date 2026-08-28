import { NextResponse } from 'next/server';
import { streamWorldAtlasRegion } from '../../../../lib/world-atlas-tile-stream.js';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

function number(value: string | null, fallback?: number) {
  if (value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const latitude = number(url.searchParams.get('lat'));
    const longitude = number(url.searchParams.get('lng'));
    const ring = number(url.searchParams.get('ring'), 0);
    const result = await streamWorldAtlasRegion({ latitude, longitude, ring });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'World atlas stream failed.',
      buildings: [],
      coverage: { scope: 'global-on-demand', loading: 'visible-or-visited-region tile streaming' },
      legalEffects: {
        createsOwnership: false,
        createsTitle: false,
        createsExclusiveMapDataOwnership: false,
      },
    }, { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
