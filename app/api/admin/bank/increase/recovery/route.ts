import { NextResponse } from 'next/server';
import { requireGalacticTrustAdmin } from '../../../../../../lib/admin-auth';
import { describeIncreaseSandboxError } from '../../../../../../lib/banking/increase-api-errors.js';
import { recoverIncreaseSandboxOwnerAccount } from '../../../../../../lib/banking/increase-sandbox-recovery.js';
import {
  bindIncreaseSandboxAccountOnly,
  getProviderAccountBinding,
  publicBindingSummary,
} from '../../../../../../lib/banking/provider-account-binding.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}

async function bindingState(auth: any) {
  return getProviderAccountBinding(auth.admin, auth.user.id, {
    provider: 'increase',
    environment: 'sandbox',
  });
}

export async function GET(request: Request) {
  const auth = await requireGalacticTrustAdmin(request);
  if (auth.ok === false) return response({ ok: false, error: auth.error, setupRequired: auth.setupRequired || false }, auth.status);

  try {
    const state = await bindingState(auth);
    return response({
      ok: true,
      authorized: true,
      provider: 'Increase',
      environment: 'sandbox',
      recoveryAvailable: !state.setupRequired && !state.binding,
      setupRequired: Boolean(state.setupRequired),
      binding: publicBindingSummary(state.binding),
      error: state.error || '',
      canMoveRealMoney: false,
      note: 'This owner-only recovery path creates a dedicated Increase sandbox Account without hosted Entity onboarding. It never enables production banking.',
    });
  } catch (error) {
    return response({
      ok: false,
      authorized: true,
      provider: 'Increase',
      environment: 'sandbox',
      recoveryAvailable: false,
      setupRequired: true,
      canMoveRealMoney: false,
      error: error instanceof Error ? error.message : 'Increase sandbox recovery status could not be loaded.',
    }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireGalacticTrustAdmin(request);
  if (auth.ok === false) return response({ ok: false, error: auth.error, setupRequired: auth.setupRequired || false }, auth.status);

  try {
    const before = await bindingState(auth);
    if (before.setupRequired) {
      return response({
        ok: false,
        authorized: true,
        provider: 'Increase',
        environment: 'sandbox',
        recoveryAvailable: false,
        setupRequired: true,
        canMoveRealMoney: false,
        error: before.error || 'Trusted provider binding storage must be installed before sandbox recovery can bind an Account.',
      }, 503);
    }

    if (before.binding) {
      return response({
        ok: true,
        authorized: true,
        provider: 'Increase',
        environment: 'sandbox',
        recovered: false,
        alreadyBound: true,
        binding: publicBindingSummary(before.binding),
        canMoveRealMoney: false,
        note: 'A verified owner-scoped Increase sandbox Account is already bound. No recovery action was needed.',
      });
    }

    const recovered = await recoverIncreaseSandboxOwnerAccount(auth.user.id, process.env);
    const binding = await bindIncreaseSandboxAccountOnly(auth.admin, auth.user.id, {
      entityId: recovered.entityId,
      accountId: recovered.accountId,
      source: 'increase-sandbox-account-recovery',
    }, process.env);

    return response({
      ok: true,
      authorized: true,
      provider: 'Increase',
      environment: 'sandbox',
      recovered: true,
      alreadyBound: false,
      binding: publicBindingSummary(binding),
      accountCreated: recovered.accountCreated,
      accountNumberReady: Boolean(recovered.accountNumber?.ready),
      accountNumberIssue: recovered.accountNumberIssue || '',
      dashboard: recovered.dashboard,
      canMoveRealMoney: false,
      note: recovered.note,
    });
  } catch (error: any) {
    const provider = describeIncreaseSandboxError(error, error instanceof Error ? error.message : 'Increase sandbox account recovery failed.');
    return response({
      ok: false,
      authorized: true,
      provider: 'Increase',
      environment: 'sandbox',
      recovered: false,
      recoveryAvailable: true,
      setupRequired: true,
      canMoveRealMoney: false,
      providerStatus: provider.providerStatus,
      providerType: provider.providerType,
      error: provider.error,
      nextStep: provider.nextStep,
    }, Number.isFinite(error?.status) ? 502 : 400);
  }
}
