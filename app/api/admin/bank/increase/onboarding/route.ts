import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../../../lib/admin-auth';
import {
  bootstrapIncreaseSandboxAccount,
  completeIncreaseSandboxSetup,
  createIncreaseSandboxOnboardingSession,
  getIncreaseSandboxEntityReadiness,
  inspectIncreaseSandboxOnboarding,
  simulateIncreaseSandboxEntityValid,
  submitIncreaseSandboxOnboardingSession,
} from '../../../../../../lib/banking/increase-onboarding-sandbox.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

function providerError(error: any) {
  return response({
    ok: false,
    authorized: true,
    provider: 'Increase',
    environment: 'sandbox',
    canMoveRealMoney: false,
    providerStatus: Number.isFinite(error?.status) ? error.status : null,
    error: error instanceof Error ? error.message : 'Increase sandbox onboarding action failed.',
  }, Number.isFinite(error?.status) ? 502 : 400);
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if (auth.ok === false) {
    return response({ ok: false, error: auth.error, setupRequired: auth.setupRequired || false }, auth.status);
  }

  try {
    const url = new URL(request.url);
    const entityId = String(url.searchParams.get('entity_id') || '').trim();
    const onboarding = await inspectIncreaseSandboxOnboarding(process.env);
    const entity = entityId ? await getIncreaseSandboxEntityReadiness(entityId, process.env) : null;
    return response({
      ok: true,
      authorized: true,
      ...onboarding,
      entity,
      note: 'Owner-only Increase sandbox onboarding status. No customer identity fields or account-number details are returned.',
    });
  } catch (error: any) {
    return providerError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if (auth.ok === false) {
    return response({ ok: false, error: auth.error, setupRequired: auth.setupRequired || false }, auth.status);
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '').trim().toLowerCase();

  try {
    if (action === 'create_session') {
      const redirectUrl = new URL('/bank', request.url);
      redirectUrl.searchParams.set('increase_onboarding', 'complete');
      const result = await createIncreaseSandboxOnboardingSession({
        programId: String(body?.programId || ''),
        entityId: String(body?.entityId || ''),
        redirectUrl: redirectUrl.toString(),
      }, process.env);
      return response({ ok: true, authorized: true, action, ...result });
    }

    if (action === 'simulate_submit') {
      const result = await submitIncreaseSandboxOnboardingSession(String(body?.sessionId || ''), process.env);
      return response({
        ok: true,
        authorized: true,
        action,
        ...result,
        note: 'Sandbox-only simulated form submission. This creates test data and is not customer KYC approval.',
      });
    }

    if (action === 'simulate_valid') {
      const entity = await simulateIncreaseSandboxEntityValid(String(body?.entityId || ''), process.env);
      return response({
        ok: true,
        authorized: true,
        action,
        entity,
        canMoveRealMoney: false,
        note: 'Sandbox-only validation simulation. This is not a real KYC/CIP/AML decision.',
      });
    }

    if (action === 'bootstrap') {
      const result = await bootstrapIncreaseSandboxAccount({
        entityId: String(body?.entityId || ''),
        programId: String(body?.programId || ''),
        accountName: String(body?.accountName || ''),
      }, process.env);
      return response({ ok: true, authorized: true, action, ...result });
    }

    if (action === 'complete_setup') {
      const result = await completeIncreaseSandboxSetup({
        entityId: String(body?.entityId || ''),
        programId: String(body?.programId || ''),
        accountName: String(body?.accountName || ''),
      }, process.env);
      return response({
        ok: true,
        authorized: true,
        action,
        ...result,
        note: 'Sandbox-only setup: validation was simulated before creating/reusing a test Account and Account Number. No real money can move.',
      });
    }

    return response({
      ok: false,
      authorized: true,
      canMoveRealMoney: false,
      error: 'Unsupported Increase sandbox onboarding action.',
    }, 400);
  } catch (error: any) {
    return providerError(error);
  }
}
