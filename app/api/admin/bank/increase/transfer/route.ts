import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../../../lib/admin-auth';
import { describeIncreaseSandboxError } from '../../../../../../lib/banking/increase-api-errors.js';
import { simulateIncreaseSandboxSendForAccount } from '../../../../../../lib/banking/increase-sandbox.js';
import {
  getProviderAccountBinding,
  publicBindingSummary,
} from '../../../../../../lib/real-estate/provider-account-binding.js';

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
  const recipient = String(body?.recipient || '').trim();
  if (!recipient || recipient.length > 80) {
    return response({ ok: false, error: 'Enter a sandbox recipient name.' }, 400);
  }
  if (!Number.isFinite(amount) || amount < 1 || amount > 1000) {
    return response({ ok: false, error: 'Sandbox transfer must be between $1 and $1,000.' }, 400);
  }

  try {
    const bindingState = await getProviderAccountBinding(auth.admin, auth.user.id, {
      provider: 'increase',
      environment: 'sandbox',
    });
    if (bindingState.setupRequired) {
      return response({
        ok: false,
        authorized: true,
        setupRequired: true,
        canMoveRealMoney: false,
        error: bindingState.error || 'Provider identity binding storage is not ready.',
      }, 503);
    }
    if (!bindingState.binding) {
      return response({
        ok: false,
        authorized: true,
        setupRequired: true,
        canMoveRealMoney: false,
        error: 'No Increase sandbox Account is bound to this signed-in Galactic Trust owner. Complete owner-scoped sandbox onboarding before simulating transfers.',
      }, 409);
    }

    const snapshot = await simulateIncreaseSandboxSendForAccount(
      Math.round(amount * 100),
      recipient,
      bindingState.binding.accountId,
      process.env,
    );
    return response({
      ok: true,
      authorized: true,
      ...snapshot,
      binding: publicBindingSummary(bindingState.binding),
      action: 'sandbox-ach-transfer-simulation',
      canMoveRealMoney: false,
      note: 'This transfer is scoped to the Increase sandbox Account bound server-side to this signed-in owner and routes only to sandbox test coordinates. No real recipient or bank account is used.',
    });
  } catch (error: any) {
    const fallback = error instanceof Error ? error.message : 'Increase sandbox transfer simulation failed.';
    const failure = describeIncreaseSandboxError(error, fallback);
    return response({
      ok: false,
      authorized: true,
      canMoveRealMoney: false,
      providerStatus: failure.providerStatus,
      providerType: failure.providerType,
      error: failure.error,
      nextStep: failure.nextStep,
    }, 502);
  }
}
