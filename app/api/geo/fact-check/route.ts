import { NextResponse } from 'next/server';
import { factCheckProperty } from '../../../../lib/real-estate/property-fact-check.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const report = factCheckProperty({
      propertyId: body?.propertyId,
      facts: Array.isArray(body?.facts) ? body.facts : [],
    });
    return NextResponse.json({ ok: true, report }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Property fact check failed.' }, { status: 400 });
  }
}
