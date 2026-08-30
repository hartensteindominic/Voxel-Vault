import { NextResponse } from 'next/server';
import { requireGalacticTrustAdmin } from '../../../../../../lib/admin-auth';
import { describeIncreaseSandboxError } from '../../../../../../lib/banking/increase-api-errors.js';
import { resolveIncreaseSandboxOwnerAccount } from '../../../../../../lib/banking/increase-owner-account.js';
import { getIncreaseSandboxDashboardForAccount } from '../../../../../../lib/banking/increase-sandbox.js';
import { ensureIncreaseSandboxWebhookSubscription } from '../../../../../../lib/banking/increase-webhook-subscription.js';
import { pollIncreaseSandboxEvents } from '../../../../../../lib/banking/increase-reconciliation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}

export async function GET(request: Request) {
  const auth = await requireGalacticTrustAdmin(request);
  if (auth.ok === false) return response({ ok: false, error: auth.error, setupRequired: auth.setupRequired || false }, auth.status);

  let resolution: any;
  try {
    resolution = await resolveIncreaseSandboxOwnerAccount(auth.admin, auth.user.id, process.env);
  } catch (error: any) {
    return response({ ok: false, authorized: true, provider: 'Increase', environment: 'sandbox', connected: false, setupRequired: true, canMoveRealMoney: false, error: error instanceof Error ? error.message : 'Increase sandbox owner Account could not be resolved.' }, 500);
  }

  if (!resolution.accountId) {
    return response({
      ok: false,
      authorized: true,
      provider: 'Increase',
      environment: 'sandbox',
      connected: true,
      setupRequired: true,
      recoveryAvailable: true,
      canMoveRealMoney: false,
      bindingStorageReady: resolution.bindingStorageReady,
      bindingStorageIssue: resolution.bindingStorageIssue,
      error: 'No owner-scoped Increase sandbox Account exists yet. Use the Galactic Trust sandbox recovery control to create one.',
    }, 409);
  }

  let webhookAutomation: any = null;
  let reconciliationBackstop: any = null;
  let automationIssue: string | null = null;
  try { webhookAutomation = await ensureIncreaseSandboxWebhookSubscription(process.env); } catch { automationIssue = 'Increase sandbox webhook subscription needs attention.'; }
  try { reconciliationBackstop = await pollIncreaseSandboxEvents({ maxPages: 2 }); } catch { automationIssue = automationIssue || 'Increase sandbox reconciliation backstop needs attention.'; }

  try {
    const snapshot = await getIncreaseSandboxDashboardForAccount(resolution.accountId, process.env);
    return response({
      ok: true,
      authorized: true,
      ...snapshot,
      binding: resolution.binding,
      bindingPersistence: resolution.persistence,
      bindingStorageReady: resolution.bindingStorageReady,
      bindingStorageIssue: resolution.bindingStorageIssue,
      webhookAutomation,
      reconciliationBackstop,
      automationIssue,
      note: 'Increase sandbox data is scoped server-side to this signed-in Galactic Trust owner through either trusted database binding storage or the owner-specific Increase idempotency key. Values are pretend money only.',
    });
  } catch (error: any) {
    const provider = describeIncreaseSandboxError(error, error instanceof Error ? error.message : 'Increase sandbox dashboard sync failed.');
    return response({
      ok: false,
      authorized: true,
      provider: 'Increase',
      environment: 'sandbox',
      connected: false,
      canMoveRealMoney: false,
      binding: resolution.binding,
      webhookAutomation,
      reconciliationBackstop,
      automationIssue,
      providerStatus: provider.providerStatus,
      providerType: provider.providerType,
      error: provider.error,
      nextStep: provider.nextStep,
    }, 502);
  }
}
