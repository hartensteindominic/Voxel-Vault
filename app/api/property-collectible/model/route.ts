import { NextResponse } from 'next/server';
import { resolvePaidPropertyCollectibleModel } from '../../../../lib/property-collectible-model-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const resolved = await resolvePaidPropertyCollectibleModel({
      identityKey: url.searchParams.get('identity'),
      modelTaskId: url.searchParams.get('taskId'),
      token: url.searchParams.get('token'),
    });
    return NextResponse.redirect(resolved.modelUrl, {
      status: 307,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Paid collectible model is unavailable.',
    }, { status: 403, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
