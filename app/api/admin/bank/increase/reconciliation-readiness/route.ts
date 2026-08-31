import { NextResponse } from 'next/server';
import { requireGalacticTrustAdmin } from '../../../../../../lib/admin-auth';
import { inspectIncreaseReconciliationStorage } from '../../../../../../lib/banking/increase-reconciliation-readiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

export async function GET(request: Request) {
  const auth = await requireGalacticTrustAdmin(request);
  if (auth.ok === false) {
    return response({
      ok: false,
      authorized: false,
      error: auth.error,
      setupRequired: auth.setupRequired || false,
      canMoveRealMoney: false,
    }, auth.status);
  }

  const readiness = await inspectIncreaseReconciliationStorage();
  return response({
    ...readiness,
    authorized: true,
    checkedAt: new Date().toISOString(),
    note: 'Owner-only readiness probe. It checks the deployed server Supabase configuration and migration-024 tables without returning credentials, database URLs, or raw database errors.',
    canMoveRealMoney: false,
  });
}
