import { NextResponse } from 'next/server';
import { fetchOpenStreetImagery } from '../../../../lib/open-street-imagery.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const data = await fetchOpenStreetImagery({
      latitude: url.searchParams.get('lat'),
      longitude: url.searchParams.get('lng'),
      radiusMeters: url.searchParams.get('radius') || 120,
    });
    return NextResponse.json(data, {
      status: data.ok ? 200 : 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      configured: true,
      requiresPaidKey: false,
      provider: 'KartaView',
      photos: [],
      meshyReferences: [],
      error: error instanceof Error ? error.message : 'Open street imagery request failed.',
    }, { status: 400 });
  }
}
