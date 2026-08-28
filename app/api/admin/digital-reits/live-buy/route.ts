import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../../lib/admin-auth';
import { createLiveMarketBuy } from '../../../../../lib/real-estate/dinari.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

function response(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return response({ ok: false, error: 'Live trade request must originate from this Voxel Vault deployment.' }, 403);
  }

  const auth = await requireVoxelVaultAdmin(request);
  if ('error' in auth) return response({ ok: false, error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  const body = await request.json().catch(() => ({}));
  try {
    const result = await createLiveMarketBuy({
      userId: auth.user.id,
      confirmationToken: body?.confirmationToken,
    }, process.env);

    return response({
      ok: true,
      ...result,
    });
  } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message : 'Live Dinari market buy failed.' }, 422);
  }
}
