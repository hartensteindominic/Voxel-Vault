import { NextResponse } from 'next/server';
import { requireGalacticTrustAdmin } from '../../../../../../lib/admin-auth';
import { describeIncreaseSandboxError } from '../../../../../../lib/banking/increase-api-errors.js';
import { getIncreaseSandboxDashboardForAccount } from '../../../../../../lib/banking/increase-sandbox.js';
import { ensureIncreaseSandboxWebhookSubscription } from '../../../../../../lib/banking/increase-webhook-subscription.js';
import { pollIncreaseSandboxEvents } from '../../../../../../lib/banking/increase-reconciliation';
import {
  getProviderAccountBinding,
  publicBindingSummary,
} from '../../../../../../lib/banking/provider-account-binding.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}

export async function GET(request: Request) {
  const auth = await requireGalacticTrustAdmin(request);
  if (auth.ok === false) return response({ ok: false, error: auth.error, setupRequired: auth.setupRequired || false }, auth.status);

  let bindingState: any;
  try {
    bindingState = await getProviderAccountBinding(auth.admin, auth.user.id);
  } catch (error: any) {
    return response({ ok: false, authorized: true, provider: 'Increase', environment: 'sandbox', connected: false, setupRequired: true, canMoveRealMoney: false, error: error instanceof Error ? error.message : 'Increase sandbox identity binding could not be read.' }, 500);
  }

  if (bindingState.setupRequired) {
    return response({ ok: false, authorized: true, provider: 'Increase', environment: 'sandbox', connected: false, setupRequired: true, canMoveRealMoney: false, error: bindingState.error || 'Provider identity binding storage is not ready.' }, 503);
  }
  if (!bindingState.binding) {
    return response({ ok: false, authorized: true, provider: 'Increase', environment: 'sandbox', connected: true, setupRequired: true, canMoveRealMoney: false, error: 'No Increase sandbox Account is bound to this signed-in Galactic Trust owner yet. Complete owner-scoped sandbox onboarding before provider balances or transactions are shown.' }, 409);
  }

  let webhookAutomation: any = null;
  let reconciliationBackstop: any = null;
  let automationIssue: string | null = null;
  try { webhookAutomation = await ensureIncreaseSandboxWebhookSubscription(process.env); } catch { automationIssue = 'Increase sandbox webhook subscription needs attention.'; }
  try { reconciliationBackstop = await pollIncreaseSandboxEvents({ maxPages: 2 }); } catch { automationIssue = automationIssue || 'Increase sandbox reconciliation backstop needs attention.'; }

  try {
    const snapshot = await getIncreaseSandboxDashboardForAccount(bindingState.binding.accountId, process.env);
    return response({ ok: true, authorized: true, ...snapshot, binding: publicBindingSummary(bindingState.binding), webhookAutomation, reconciliationBackstop, automationIssue, note: 'Increase sandbox data is scoped to the Account bound server-side to this signed-in owner. Values are pretend money and cannot represent live customer funds.' });
  } catch (error: any) {
    const provider = describeIncreaseSandboxError(error, error instanceof Error ? error.message : 'Increase sandbox dashboard sync failed.');
    return response({
      ok: false,
      authorized: true,
      provider: 'Increase',
      environment: 'sandbox',
      connected: false,
      canMoveRealMoney: false,
      binding: publicBindingSummary(bindingState.binding),
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
