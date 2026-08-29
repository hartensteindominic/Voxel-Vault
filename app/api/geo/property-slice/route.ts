import { NextResponse } from 'next/server';
import {
  buildPropertySliceSandbox,
  buildSandboxPropertyPurchase,
  buildUnifiedAssetConversionPreview,
} from '../../../../lib/real-estate/property-slice-sandbox.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const mode = String(body?.mode || 'slice').trim().toLowerCase();

    let result;
    if (mode === 'slice') result = buildPropertySliceSandbox(body);
    else if (mode === 'purchase') result = buildSandboxPropertyPurchase(body);
    else if (mode === 'conversion_preview') result = buildUnifiedAssetConversionPreview(body);
    else throw new Error('Unsupported property-slice mode.');

    return NextResponse.json({ ok: true, mode, result }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Property Slice request failed.',
    }, { status: 400 });
  }
}
