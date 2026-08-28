import { NextResponse } from 'next/server';
import { quoteWorldStewardship } from '../../../../../lib/world-stewardship.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const quote = quoteWorldStewardship({
      existingGlobalClaims: body?.existingGlobalClaims,
      existingRegionalClaims: body?.existingRegionalClaims,
    });
    return NextResponse.json({ ok: true, quote }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Stewardship quote failed.',
    }, { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
