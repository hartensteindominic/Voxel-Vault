import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../../../lib/admin-auth';
import { getIncreaseSandboxDashboard } from '../../../../../../lib/banking/increase-sandbox.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if (auth.ok === false) {
    return response({ ok: false, error: auth.error, setupRequired: auth.setupRequired || false }, auth.status);
  }

  try {
    const snapshot = await getIncreaseSandboxDashboard(process.env);
    return response({
      ok: true,
      authorized: true,
      ...snapshot,
      note: 'Increase sandbox data only. Values are pretend money and cannot represent live customer funds.',
    });
  } catch (error: any) {
    return response({
      ok: false,
      authorized: true,
      provider: 'Increase',
      environment: 'sandbox',
      connected: false,
      canMoveRealMoney: false,
      providerStatus: Number.isFinite(error?.status) ? error.status : null,
      error: error instanceof Error ? error.message : 'Increase sandbox dashboard sync failed.',
    }, 502);
  }
}
