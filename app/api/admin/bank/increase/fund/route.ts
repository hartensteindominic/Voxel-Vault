import { NextResponse } from 'next/server';
import { requireGalacticTrustAdmin } from '../../../../../../lib/admin-auth';
import { resolveIncreaseSandboxOwnerAccount } from '../../../../../../lib/banking/increase-owner-account.js';
import { simulateIncreaseSandboxDepositForAccount } from '../../../../../../lib/banking/increase-sandbox.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}

export async function POST(request: Request) {
  const auth = await requireGalacticTrustAdmin(request);
  if (auth.ok === false) return response({ ok: false, error: auth.error, setupRequired: auth.setupRequired || false }, auth.status);

  const body = await request.json().catch(() => ({}));
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount < 1 || amount > 5000) return response({ ok: false, error: 'Sandbox deposit must be between $1 and $5,000.' }, 400);

  try {
    const resolution = await resolveIncreaseSandboxOwnerAccount(auth.admin, auth.user.id, process.env);
    if (!resolution.accountId) {
      return response({
        ok: false,
        authorized: true,
        setupRequired: true,
        recoveryAvailable: true,
        canMoveRealMoney: false,
        bindingStorageReady: resolution.bindingStorageReady,
        bindingStorageIssue: resolution.bindingStorageIssue,
        error: 'No owner-scoped Increase sandbox Account exists yet. Create the sandbox test account before simulating funding.',
      }, 409);
    }

    const snapshot = await simulateIncreaseSandboxDepositForAccount(Math.round(amount * 100), resolution.accountId, process.env);
    return response({
      ok: true,
      authorized: true,
      ...snapshot,
      binding: resolution.binding,
      bindingPersistence: resolution.persistence,
      action: 'sandbox-inbound-ach-simulation',
      canMoveRealMoney: false,
      note: 'Pretend Increase sandbox funds only, scoped server-side to this signed-in owner. No external bank account was debited.',
    });
  } catch (error: any) {
    return response({ ok: false, authorized: true, canMoveRealMoney: false, providerStatus: Number.isFinite(error?.status) ? error.status : null, error: error instanceof Error ? error.message : 'Increase sandbox funding simulation failed.' }, 502);
  }
}
