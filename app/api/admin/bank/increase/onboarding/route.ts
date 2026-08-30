import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../../../lib/admin-auth';
import { describeIncreaseSandboxError } from '../../../../../../lib/banking/increase-api-errors.js';
import {
  bootstrapIncreaseSandboxAccount,
  completeIncreaseSandboxSetup,
  createIncreaseSandboxOnboardingSession,
  getIncreaseSandboxEntityReadiness,
  inspectIncreaseSandboxOnboarding,
  simulateIncreaseSandboxEntityValid,
  submitIncreaseSandboxOnboardingSession,
} from '../../../../../../lib/banking/increase-onboarding-sandbox.js';
import {
  bindIncreaseSandboxAccount,
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

function providerError(error: any) {
  const fallback = error instanceof Error ? error.message : 'Increase sandbox onboarding action failed.';
  const failure = describeIncreaseSandboxError(error, fallback);
  return response({
    ok: false,
    authorized: true,
    provider: 'Increase',
    environment: 'sandbox',
    canMoveRealMoney: false,
    providerStatus: failure.providerStatus,
    providerType: failure.providerType,
    error: failure.error,
    nextStep: failure.nextStep,
  }, Number.isFinite(error?.status) ? 502 : 400);
}

async function bindOwnerSandboxAccount(auth: any, result: any, source: string) {
  const binding = await bindIncreaseSandboxAccount(auth.admin, auth.user.id, {
    entityId: String(result?.entity?.entityId || ''),
    accountId: String(result?.account?.id || ''),
    validationStatus: String(result?.entity?.validationStatus || ''),
    source,
  }, process.env);
  return publicBindingSummary(binding);
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
    const bindingState = await getProviderAccountBinding(auth.admin, auth.user.id, {
      provider: 'increase',
      environment: 'sandbox',
    });
    return response({
      ok: true,
      authorized: true,
      ...onboarding,
      entity,
      binding: publicBindingSummary(bindingState.binding),
      bindingSetupRequired: bindingState.setupRequired,
      bindingError: bindingState.error || '',
      note: 'Owner-only Increase sandbox onboarding status. Provider identity is scoped to the signed-in owner through a server-written binding; no customer identity fields or account-number details are returned.',
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
      const requestedProgramId = String(body?.programId || '').trim();
      const redirectUrl = new URL('/bank', request.url);
      redirectUrl.searchParams.set('increase_onboarding', 'complete');
      if (requestedProgramId) redirectUrl.searchParams.set('increase_program_id', requestedProgramId);
      const result = await createIncreaseSandboxOnboardingSession({
        programId: requestedProgramId,
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
      const binding = await bindOwnerSandboxAccount(auth, result, 'increase-sandbox-bootstrap');
      return response({
        ok: true,
        authorized: true,
        action,
        ...result,
        binding,
        note: 'Sandbox Account ownership is bound server-side to the signed-in owner. Provider validation is sandbox simulation only; no real money can move.',
      });
    }

    if (action === 'complete_setup') {
      const result = await completeIncreaseSandboxSetup({
        entityId: String(body?.entityId || ''),
        programId: String(body?.programId || ''),
        accountName: String(body?.accountName || ''),
      }, process.env);
      const binding = await bindOwnerSandboxAccount(auth, result, 'increase-hosted-sandbox-onboarding');
      return response({
        ok: true,
        authorized: true,
        action,
        ...result,
        binding,
        note: 'Sandbox-only setup: validation was simulated before creating/reusing a test Account and Account Number, then the provider Account was bound server-side to the signed-in owner. This is not real KYC approval and no real money can move.',
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
