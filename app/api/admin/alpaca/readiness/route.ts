import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../../lib/admin-auth';
import { getAlpacaSandboxReadiness } from '../../../../../lib/real-estate/alpaca-broker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if ('error' in auth) {
    return response({ error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);
  }

  try {
    const snapshot = await getAlpacaSandboxReadiness(process.env);
    return response({ authorized: true, ...snapshot });
  } catch (error) {
    return response({
      error: error instanceof Error ? error.message : 'Alpaca sandbox readiness could not be loaded.',
    }, 503);
  }
}
