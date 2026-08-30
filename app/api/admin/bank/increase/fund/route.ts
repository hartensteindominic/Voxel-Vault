import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../../../lib/admin-auth';
import { simulateIncreaseSandboxDeposit } from '../../../../../../lib/banking/increase-sandbox.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if (auth.ok === false) {
    return response({ ok: false, error: auth.error, setupRequired: auth.setupRequired || false }, auth.status);
  }

  const body = await request.json().catch(() => ({}));
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount < 1 || amount > 5000) {
    return response({ ok: false, error: 'Sandbox deposit must be between $1 and $5,000.' }, 400);
  }

  try {
    const snapshot = await simulateIncreaseSandboxDeposit(Math.round(amount * 100), process.env);
    return response({
      ok: true,
      authorized: true,
      ...snapshot,
      action: 'sandbox-inbound-ach-simulation',
      canMoveRealMoney: false,
      note: 'Pretend Increase sandbox funds only. No external bank account was debited.',
    });
  } catch (error: any) {
    return response({
      ok: false,
      authorized: true,
      canMoveRealMoney: false,
      providerStatus: Number.isFinite(error?.status) ? error.status : null,
      error: error instanceof Error ? error.message : 'Increase sandbox funding simulation failed.',
    }, 502);
  }
}
