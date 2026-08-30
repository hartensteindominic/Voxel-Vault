import { NextResponse } from 'next/server';
import { requireGalacticTrustAdmin } from '../../../../../../lib/admin-auth';
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
  return { ok: true as const };
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  try {
    const [subscription, reconciliation] = await Promise.all([ensureIncreaseSandboxWebhookSubscription(process.env), getIncreaseReconciliationStatus()]);
    return response({ ok: true, authorized: true, provider: 'Increase', environment: 'sandbox', canMoveRealMoney: false, subscription, reconciliation });
  } catch {
    return response({ ok: false, authorized: true, provider: 'Increase', environment: 'sandbox', canMoveRealMoney: false, error: 'Increase sandbox reconciliation status is unavailable.' }, 502);
  }
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  try {
    const subscription = await ensureIncreaseSandboxWebhookSubscription(process.env);
    const backstop = await pollIncreaseSandboxEvents({ maxPages: 5, forceReconcile: true });
    const reconciliation = await getIncreaseReconciliationStatus();
    return response({ ok: true, authorized: true, provider: 'Increase', environment: 'sandbox', canMoveRealMoney: false, subscription, backstop, reconciliation, note: 'Provider Events were polled oldest-first and the sandbox snapshot was reconciled. No real money moved.' });
  } catch {
    return response({ ok: false, authorized: true, provider: 'Increase', environment: 'sandbox', canMoveRealMoney: false, error: 'Increase sandbox reconciliation failed.' }, 502);
  }
}
