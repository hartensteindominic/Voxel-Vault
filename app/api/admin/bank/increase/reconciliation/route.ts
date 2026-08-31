import { NextResponse } from 'next/server';
import { requireGalacticTrustAdmin } from '../../../../../../lib/admin-auth';
import { resolveIncreaseSandboxOwnerAccount } from '../../../../../../lib/banking/increase-owner-account.js';
import { ensureIncreaseSandboxWebhookSubscription } from '../../../../../../lib/banking/increase-webhook-subscription.js';
import { getIncreaseReconciliationStatus, pollIncreaseSandboxEvents } from '../../../../../../lib/banking/increase-reconciliation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}

async function authorize(request: Request) {
  const auth = await requireGalacticTrustAdmin(request);
  if (auth.ok === false) return { ok: false as const, response: response({ ok: false, error: auth.error, setupRequired: auth.setupRequired || false }, auth.status) };
  return { ok: true as const, auth };
}

async function ownerScope(auth: any) {
  const resolution = await resolveIncreaseSandboxOwnerAccount(auth.admin, auth.user.id, process.env);
  if (!resolution.accountId) {
    return {
      ok: false as const,
      response: response({
        ok: false,
        authorized: true,
        provider: 'Increase',
        environment: 'sandbox',
        canMoveRealMoney: false,
        recoveryAvailable: true,
        error: 'No owner-scoped Increase sandbox Account exists yet. Create the sandbox test account before reconciliation.',
      }, 409),
    };
  }
  return { ok: true as const, resolution };
}

export async function GET(request: Request) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;

  try {
    const scope = await ownerScope(authorized.auth);
    if (!scope.ok) return scope.response;
    const [subscription, reconciliation] = await Promise.all([
      ensureIncreaseSandboxWebhookSubscription(process.env),
      getIncreaseReconciliationStatus(),
    ]);
    return response({
      ok: true,
      authorized: true,
      provider: 'Increase',
      environment: 'sandbox',
      canMoveRealMoney: false,
      scope: 'owner-account',
      binding: scope.resolution.binding,
      subscription,
      reconciliation,
    });
  } catch {
    return response({ ok: false, authorized: true, provider: 'Increase', environment: 'sandbox', canMoveRealMoney: false, error: 'Increase sandbox reconciliation status is unavailable.' }, 502);
  }
}

export async function POST(request: Request) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;

  try {
    const scope = await ownerScope(authorized.auth);
    if (!scope.ok) return scope.response;
    const subscription = await ensureIncreaseSandboxWebhookSubscription(process.env);
    const backstop = await pollIncreaseSandboxEvents({
      accountId: scope.resolution.accountId,
      maxPages: 5,
      forceReconcile: true,
    });
    const reconciliation = await getIncreaseReconciliationStatus();
    return response({
      ok: true,
      authorized: true,
      provider: 'Increase',
      environment: 'sandbox',
      canMoveRealMoney: false,
      scope: 'owner-account',
      binding: scope.resolution.binding,
      subscription,
      backstop,
      reconciliation,
      note: 'Provider Events were polled oldest-first and only the signed-in owner sandbox Account snapshot was reconciled. No real money moved.',
    });
  } catch {
    return response({ ok: false, authorized: true, provider: 'Increase', environment: 'sandbox', canMoveRealMoney: false, error: 'Increase sandbox reconciliation failed.' }, 502);
  }
}
