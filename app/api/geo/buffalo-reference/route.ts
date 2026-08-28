import { NextResponse } from 'next/server';
import { fetchBuffaloPropertyReference } from '../../../../../lib/real-estate/buffalo-property-reference.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await fetchBuffaloPropertyReference({
      printKey: body?.sbl || body?.printKey || '',
      rawSbl: body?.rawSbl || '',
      pin: body?.pin || '',
    });
    return NextResponse.json({ ok: true, result }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Buffalo property reference failed.',
    }, { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
