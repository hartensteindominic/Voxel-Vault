import { NextResponse } from 'next/server';
import { requireGalacticTrustAdmin } from '../../../../../../lib/admin-auth';
import { describeIncreaseSandboxError } from '../../../../../../lib/banking/increase-api-errors.js';
import { getIncreaseSandboxConfig, inspectIncreaseSandbox } from '../../../../../../lib/banking/increase-sandbox.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}

export async function GET(request: Request) {
  const auth = await requireGalacticTrustAdmin(request);
  if (auth.ok === false) return response({ ok: false, error: auth.error, setupRequired: auth.setupRequired || false }, auth.status);

  const config = getIncreaseSandboxConfig(process.env);
  if (!config.enabled || !config.credentialsConfigured) {
    return response({
      ok: true,
      authorized: true,
      provider: 'Increase',
      environment: 'sandbox',
      enabled: config.enabled,
      credentialsConfigured: config.credentialsConfigured,
      connected: false,
      canMoveRealMoney: false,
      setupRequired: true,
      nextStep: config.credentialsConfigured
        ? 'Set GALACTIC_INCREASE_SANDBOX_ENABLED=true in the server environment and redeploy.'
        : 'Create an Increase sandbox account, then add INCREASE_SANDBOX_API_KEY to the server environment. Do not paste the key into chat or commit it to GitHub.',
    });
  }

  try {
    const snapshot = await inspectIncreaseSandbox(process.env);
    const restrictedCapabilities = Object.entries(snapshot?.capabilities || {})
      .filter(([, value]: any) => value?.available === false)
      .map(([name]) => name);
    return response({
      ok: true,
      authorized: true,
      ...snapshot,
      setupRequired: restrictedCapabilities.length > 0,
      nextStep: restrictedCapabilities.length
        ? `Increase sandbox is connected for Accounts, but ${restrictedCapabilities.join(' and ')} access is restricted. Use a sandbox API key with those permissions before owner onboarding.`
        : '',
      note: 'This route performs read-only sandbox inspection. It cannot move real money and never returns the API key.',
    });
  } catch (error: any) {
    const provider = describeIncreaseSandboxError(error, 'Increase sandbox connection check failed.');
    return response({
      ok: false,
      authorized: true,
      provider: 'Increase',
      environment: 'sandbox',
      connected: false,
      canMoveRealMoney: false,
      setupRequired: true,
      providerStatus: provider.providerStatus,
      providerType: provider.providerType,
      error: provider.error,
      nextStep: provider.nextStep,
    }, 502);
  }
}
