import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../../../lib/admin-auth';
import { simulateIncreaseSandboxSend } from '../../../../../../lib/banking/increase-sandbox.js';

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
    const snapshot = await simulateIncreaseSandboxSend(Math.round(amount * 100), recipient, process.env);
    return response({
      ok: true,
      authorized: true,
      ...snapshot,
      action: 'sandbox-ach-transfer-simulation',
      canMoveRealMoney: false,
      note: 'This transfer is routed only to Increase sandbox test coordinates. No real recipient or bank account is used.',
    });
  } catch (error: any) {
    return response({
      ok: false,
      authorized: true,
      canMoveRealMoney: false,
      providerStatus: Number.isFinite(error?.status) ? error.status : null,
      error: error instanceof Error ? error.message : 'Increase sandbox transfer simulation failed.',
    }, 502);
  }
}
