import { NextResponse } from 'next/server';
import { requireGalacticTrustAdmin } from '../../../../../lib/admin-auth';
import { describeIncreaseSandboxError } from '../../../../../lib/banking/increase-api-errors.js';
import { inspectIncreaseSandboxOnboarding } from '../../../../../lib/banking/increase-onboarding-sandbox.js';
import { resolveIncreaseSandboxOwnerAccount } from '../../../../../lib/banking/increase-owner-account.js';
import { getIncreaseReconciliationStatus, pollIncreaseSandboxEvents } from '../../../../../lib/banking/increase-reconciliation';
import { getIncreaseSandboxConfig, inspectIncreaseSandbox } from '../../../../../lib/banking/increase-sandbox.js';
import { ensureIncreaseSandboxWebhookSubscription } from '../../../../../lib/banking/increase-webhook-subscription.js';
import { getProviderAccountBinding, publicBindingSummary } from '../../../../../lib/banking/provider-account-binding.js';
import { bankingLaunchSnapshot } from '../../../../../lib/banking/regulated-launch.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}

function safeCapability(value: any) {
  return {
    available: value?.available === true,
    status: Number.isFinite(Number(value?.issue?.status)) ? Number(value.issue.status) : null,
    type: typeof value?.issue?.type === 'string' ? value.issue.type.slice(0, 80) : '',
  };
}

function safeProviderError(error: any, fallback: string) {
  const provider = describeIncreaseSandboxError(error, fallback);
  return {
    providerStatus: provider.providerStatus,
    providerType: provider.providerType,
    error: provider.error,
    nextStep: provider.nextStep,
  };
}

function safeReconciliationState(payload: any) {
  const state = payload?.state || null;
  const recentEvents = Array.isArray(payload?.recentEvents) ? payload.recentEvents : [];
  const latest = recentEvents[0] || null;
  return {
    databaseReady: true,
    status: String(state?.last_reconciliation_status || 'not-run'),
    lastReconciledAt: state?.last_reconciled_at || null,
    lastWebhookAt: state?.last_webhook_at || null,
    lastPollAt: state?.last_poll_at || null,
    accountCount: Number.isFinite(Number(state?.account_count)) ? Number(state.account_count) : 0,
    transactionCount: Number.isFinite(Number(state?.transaction_count)) ? Number(state.transaction_count) : 0,
    eventCursorStored: Boolean(state?.event_cursor),
    lastError: typeof state?.last_error === 'string' ? state.last_error.slice(0, 160) : '',
    recentEventCount: recentEvents.length,
    latestEvent: latest ? {
      category: String(latest.category || '').slice(0, 120),
      source: String(latest.source || '').slice(0, 40),
      processingStatus: String(latest.processing_status || '').slice(0, 40),
      receivedAt: latest.received_at || null,
    } : null,
  };
}

async function buildHealth(auth: any) {
  const config = getIncreaseSandboxConfig(process.env);
  const launch = bankingLaunchSnapshot(process.env);

  let provider: any = {
    provider: 'Increase',
    environment: 'sandbox',
    enabled: config.enabled,
    credentialsConfigured: config.credentialsConfigured,
    connected: false,
    setupRequired: true,
    counts: { programs: 0, accounts: 0, entities: 0 },
    capabilities: {
      accounts: { available: false, status: null, type: '' },
      programs: { available: false, status: null, type: '' },
      entities: { available: false, status: null, type: '' },
    },
    nextStep: config.credentialsConfigured
      ? 'Set GALACTIC_INCREASE_SANDBOX_ENABLED=true in the server environment and redeploy.'
      : 'Add an Increase sandbox API key to the server environment, then redeploy. Keep the key server-only.',
  };

  if (config.enabled && config.credentialsConfigured) {
    try {
      const snapshot: any = await inspectIncreaseSandbox(process.env);
      const restricted = Object.entries(snapshot?.capabilities || {})
        .filter(([, value]: any) => value?.available === false)
        .map(([name]) => name);
      provider = {
        provider: 'Increase',
        environment: 'sandbox',
        enabled: true,
        credentialsConfigured: true,
        connected: snapshot?.connected === true,
        setupRequired: restricted.length > 0,
        counts: {
          programs: Number(snapshot?.counts?.programs || 0),
          accounts: Number(snapshot?.counts?.accounts || 0),
          entities: Number(snapshot?.counts?.entities || 0),
        },
        capabilities: {
          accounts: safeCapability(snapshot?.capabilities?.accounts),
          programs: safeCapability(snapshot?.capabilities?.programs),
          entities: safeCapability(snapshot?.capabilities?.entities),
        },
        nextStep: restricted.length
          ? `Increase sandbox is connected for Accounts, but ${restricted.join(' and ')} access is restricted. Use the owner Account-only recovery path when hosted onboarding is unavailable.`
          : '',
      };
    } catch (error: any) {
      provider = { ...provider, ...safeProviderError(error, 'Increase sandbox connection check failed.') };
    }
  }

  let binding: any = {
    storageReady: true,
    bound: false,
    status: 'not-bound',
    validationKind: 'none',
    accountSuffix: '',
    verifiedAt: null,
    nextStep: 'Create the dedicated owner-scoped Increase sandbox test account.',
  };
  try {
    const state = await getProviderAccountBinding(auth.admin, auth.user.id, { provider: 'increase', environment: 'sandbox' });
    const summary: any = publicBindingSummary(state.binding);
    binding = {
      storageReady: state.setupRequired !== true,
      bound: Boolean(summary),
      status: summary?.status || (state.setupRequired ? 'setup-required' : 'not-bound'),
      validationKind: summary?.kycStatus === 'SANDBOX_VALID_SIMULATION' ? 'sandbox-simulation' : 'none',
      accountSuffix: summary?.accountSuffix || '',
      verifiedAt: summary?.verifiedAt || null,
      nextStep: state.setupRequired
        ? 'Durable provider-binding storage is pending; Account-only recovery can still use the verified owner ID plus Increase idempotency-key scope.'
        : summary
          ? ''
          : 'Create the dedicated owner-scoped Increase sandbox test account.',
    };
  } catch {
    binding = {
      ...binding,
      storageReady: false,
      status: 'unavailable',
      nextStep: 'Verify the Supabase service-role configuration. Account-only recovery remains separate from production banking.',
    };
  }

  let onboarding: any = {
    available: false,
    programCount: 0,
    setupRequired: true,
    nextStep: provider.connected ? 'Hosted onboarding is optional for Account-only sandbox recovery.' : provider.nextStep,
  };
  if (provider.connected) {
    try {
      const snapshot: any = await inspectIncreaseSandboxOnboarding(process.env);
      onboarding = {
        available: snapshot?.connected === true,
        programCount: Array.isArray(snapshot?.programs) ? snapshot.programs.length : 0,
        setupRequired: snapshot?.setupRequired === true,
        nextStep: snapshot?.setupRequired ? 'Hosted onboarding is unavailable; use the dedicated Account-only owner recovery path instead.' : '',
      };
    } catch (error: any) {
      const issue = safeProviderError(error, 'Increase sandbox onboarding inspection failed.');
      onboarding = { ...onboarding, ...issue, nextStep: issue.nextStep || onboarding.nextStep };
    }
  }

  let webhook: any = {
    configured: false,
    active: false,
    status: 'not-configured',
    nextStep: provider.connected ? 'Configure the Increase sandbox event subscription after provider access is healthy.' : provider.nextStep,
  };
  if (provider.connected) {
    try {
      const subscription: any = await ensureIncreaseSandboxWebhookSubscription(process.env);
      webhook = {
        configured: subscription?.configured === true,
        active: subscription?.active === true,
        status: String(subscription?.status || (subscription?.configured ? 'inactive' : 'not-configured')).slice(0, 40),
        nextStep: subscription?.active ? '' : 'Make the Galactic Trust Increase sandbox event subscription active.',
      };
    } catch (error: any) {
      const issue = safeProviderError(error, 'Increase sandbox webhook status is unavailable.');
      webhook = { ...webhook, status: 'unavailable', ...issue, nextStep: issue.nextStep || webhook.nextStep };
    }
  }

  let reconciliation: any = {
    databaseReady: false,
    status: 'unavailable',
    lastReconciledAt: null,
    lastWebhookAt: null,
    lastPollAt: null,
    accountCount: 0,
    transactionCount: 0,
    eventCursorStored: false,
    lastError: '',
    recentEventCount: 0,
    latestEvent: null,
    nextStep: 'Apply the Galactic Trust Increase webhook/reconciliation migration, then verify the service-role configuration.',
  };
  try {
    reconciliation = { ...safeReconciliationState(await getIncreaseReconciliationStatus()), nextStep: '' };
  } catch {
    // Keep the fail-closed migration/setup state. Do not leak database error details to the browser.
  }

  const assertedGateCount = Array.isArray(launch.gates) ? launch.gates.filter((gate: any) => gate?.asserted).length : 0;
  const totalGateCount = Array.isArray(launch.gates) ? launch.gates.length : 0;
  const production = {
    status: launch.status,
    implementationReady: launch.implementationReady === true,
    liveSwitchRequested: launch.liveSwitchRequested === true,
    assertedGateCount,
    totalGateCount,
    liveBankingEnabled: launch.liveBankingEnabled === true,
    canMoveRealMoney: false,
  };

  const nextSteps = [
    provider.nextStep,
    onboarding.nextStep,
    binding.nextStep,
    webhook.nextStep,
    reconciliation.nextStep,
  ].map((value) => String(value || '').trim()).filter(Boolean);

  return {
    ok: true,
    authorized: true,
    generatedAt: new Date().toISOString(),
    environment: 'sandbox',
    canMoveRealMoney: false,
    provider,
    onboarding,
    binding,
    webhook,
    reconciliation,
    production,
    readyForSandboxOperations: Boolean(
      provider.connected
      && provider.capabilities?.accounts?.available
      && reconciliation.databaseReady
    ),
    nextSteps: Array.from(new Set(nextSteps)).slice(0, 6),
    note: 'Owner-only operational summary. Increase values are sandbox test data. SANDBOX_VALID_SIMULATION and SANDBOX_ACCOUNT_ONLY are not real KYC/CIP/AML approval, and production banking remains fail-closed.',
  };
}

async function authorize(request: Request) {
  const auth = await requireGalacticTrustAdmin(request);
  if (auth.ok === false) return { ok: false as const, response: response({ ok: false, error: auth.error, setupRequired: auth.setupRequired || false }, auth.status) };
  return { ok: true as const, auth };
}

export async function GET(request: Request) {
  const result = await authorize(request);
  if (!result.ok) return result.response;
  return response(await buildHealth(result.auth));
}

export async function POST(request: Request) {
  const result = await authorize(request);
  if (!result.ok) return result.response;
  try {
    const resolution = await resolveIncreaseSandboxOwnerAccount(result.auth.admin, result.auth.user.id, process.env);
    if (!resolution.accountId) {
      const health = await buildHealth(result.auth);
      return response({
        ...health,
        ok: false,
        action: 'sandbox-reconciliation-needs-owner-account',
        error: 'No owner-scoped Increase sandbox Account exists yet.',
        nextStep: 'Create the dedicated sandbox test account, then run reconciliation again.',
      }, 409);
    }
    await ensureIncreaseSandboxWebhookSubscription(process.env);
    await pollIncreaseSandboxEvents({ accountId: resolution.accountId, maxPages: 5, forceReconcile: true });
    const health = await buildHealth(result.auth);
    return response({ ...health, action: 'sandbox-reconciliation-complete' });
  } catch (error: any) {
    const issue = safeProviderError(error, 'Increase sandbox reconciliation could not run.');
    const health = await buildHealth(result.auth);
    return response({ ...health, ok: false, action: 'sandbox-reconciliation-failed', error: issue.error, nextStep: issue.nextStep || health.nextSteps?.[0] || '' }, 502);
  }
}
