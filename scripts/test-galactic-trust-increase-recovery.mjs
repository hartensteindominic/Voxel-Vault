import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getIncreaseSandboxOwnerRecoveryAccount,
  recoverIncreaseSandboxOwnerAccount,
} from '../lib/banking/increase-sandbox-recovery.js';

const requests = [];
const originalFetch = globalThis.fetch;
let createdAccount = null;
let createdAccountNumber = null;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = String(init.method || 'GET').toUpperCase();
  requests.push({ method, pathname: url.pathname, search: url.search, body: init.body ? JSON.parse(init.body) : null });

  if (method === 'GET' && url.pathname === '/accounts' && url.searchParams.has('idempotency_key')) {
    return json({ data: createdAccount ? [createdAccount] : [], next_cursor: null });
  }
  if (method === 'POST' && url.pathname === '/accounts') {
    assert.deepEqual(JSON.parse(init.body), { name: 'Galactic Trust Sandbox Checking' }, 'recovery Account creation must not require Program or Entity input');
    createdAccount = {
      id: 'sandbox_account_recovery123',
      entity_id: 'sandbox_entity_default123',
      program_id: 'sandbox_program_default123',
      name: 'Galactic Trust Sandbox Checking',
      status: 'open',
      currency: 'USD',
      bank: 'increase_bank',
    };
    return json(createdAccount);
  }
  if (method === 'GET' && url.pathname === '/account_numbers') {
    return json({ data: createdAccountNumber ? [createdAccountNumber] : [], next_cursor: null });
  }
  if (method === 'POST' && url.pathname === '/account_numbers') {
    createdAccountNumber = { id: 'sandbox_account_number_recovery123', status: 'active' };
    return json(createdAccountNumber);
  }
  if (method === 'GET' && url.pathname === '/accounts/sandbox_account_recovery123') {
    return json(createdAccount);
  }
  if (method === 'GET' && url.pathname === '/accounts/sandbox_account_recovery123/balance') {
    return json({ account_id: 'sandbox_account_recovery123', current_balance: 0, available_balance: 0 });
  }
  if (method === 'GET' && url.pathname === '/transactions') {
    return json({ data: [], next_cursor: null });
  }

  return json({ type: 'unexpected_test_request', detail: `${method} ${url.pathname}${url.search}` }, 500);
};

try {
  const env = {
    GALACTIC_INCREASE_SANDBOX_ENABLED: 'true',
    INCREASE_SANDBOX_API_KEY: 'sandbox_test_key_not_secret',
  };
  const userId = '00000000-0000-4000-8000-000000000123';

  const result = await recoverIncreaseSandboxOwnerAccount(userId, env);
  assert.equal(result.provider, 'Increase');
  assert.equal(result.environment, 'sandbox');
  assert.equal(result.bindingKind, 'SANDBOX_ACCOUNT_ONLY');
  assert.equal(result.canMoveRealMoney, false);
  assert.equal(result.accountCreated, true);
  assert.equal(result.accountNumber.ready, true);
  assert.equal(result.dashboard.connected, true);
  assert.equal(result.dashboard.canMoveRealMoney, false);

  const rediscovered = await getIncreaseSandboxOwnerRecoveryAccount(userId, env);
  assert.equal(rediscovered.accountId, 'sandbox_account_recovery123', 'the owner Account must be rediscoverable by deterministic idempotency key without database binding storage');
  assert.equal(rediscovered.bindingKind, 'SANDBOX_ACCOUNT_ONLY');
  assert.equal(rediscovered.canMoveRealMoney, false);

  const accountCreates = requests.filter((entry) => entry.method === 'POST' && entry.pathname === '/accounts');
  assert.equal(accountCreates.length, 1, 'deterministic owner recovery must create at most one sandbox Account');
  const requestedPaths = requests.map((entry) => entry.pathname).join('\n');
  assert.equal(requestedPaths.includes('/programs'), false, 'account-only recovery must not call Programs');
  assert.equal(requestedPaths.includes('/entities'), false, 'account-only recovery must not call Entities');
  assert.equal(requestedPaths.includes('entity_onboarding_sessions'), false, 'account-only recovery must not call hosted onboarding');
  assert.equal(requests.some((entry) => entry.method === 'POST' && entry.pathname === '/account_numbers'), true, 'recovery should create an Account Number for sandbox ACH simulation when available');

  const recoveryRouteSource = await readFile(new URL('../app/api/admin/bank/increase/recovery/route.ts', import.meta.url), 'utf8');
  assert.match(recoveryRouteSource, /requireGalacticTrustAdmin/, 'recovery route must be owner/admin authenticated');
  assert.match(recoveryRouteSource, /getIncreaseSandboxOwnerRecoveryAccount/, 'recovery GET must rediscover owner-scoped sandbox Accounts without database binding storage');
  assert.match(recoveryRouteSource, /publicIncreaseRecoveryBindingSummary/, 'migration-free recovery must expose only a sanitized virtual binding summary');
  assert.match(recoveryRouteSource, /bindIncreaseSandboxAccountOnly/, 'database binding remains the preferred path when storage is available');
  assert.match(recoveryRouteSource, /canMoveRealMoney: false/, 'recovery route must stay fail-closed for real money');
  assert.equal(recoveryRouteSource.includes('INCREASE_SANDBOX_API_KEY'), false, 'recovery route must never expose or read a client-visible provider key');

  const resolverSource = await readFile(new URL('../lib/banking/increase-owner-account.js', import.meta.url), 'utf8');
  assert.match(resolverSource, /getProviderAccountBinding/, 'owner resolver should prefer trusted database bindings when available');
  assert.match(resolverSource, /getIncreaseSandboxOwnerRecoveryAccount/, 'owner resolver must fall back to Increase idempotency-key discovery');
  assert.match(resolverSource, /increase-idempotency-key/, 'fallback persistence must be explicit');

  for (const path of [
    '../app/api/admin/bank/increase/dashboard/route.ts',
    '../app/api/admin/bank/increase/fund/route.ts',
    '../app/api/admin/bank/increase/transfer/route.ts',
  ]) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /resolveIncreaseSandboxOwnerAccount/, `${path} must use the migration-free owner Account resolver`);
    assert.match(source, /canMoveRealMoney: false/, `${path} must remain sandbox-only`);
  }

  const bindingSource = await readFile(new URL('../lib/banking/provider-account-binding.js', import.meta.url), 'utf8');
  assert.match(bindingSource, /SANDBOX_ACCOUNT_ONLY/, 'binding layer must preserve the account-only marker separately from KYC simulation');
  assert.match(bindingSource, /SANDBOX_VALID_SIMULATION/, 'hosted/simulated KYC marker must remain available for the normal onboarding path');

  const gateSource = await readFile(new URL('../app/bank/GalacticBankGate.js', import.meta.url), 'utf8');
  assert.match(gateSource, /import GalacticIncreaseSandboxRecovery from '\.\/GalacticIncreaseSandboxRecovery'/, 'dashboard gate must import the recovery UI');
  assert.match(gateSource, /session\?\.user && <GalacticIncreaseSandboxRecovery \/>/, 'recovery UI must actually be mounted for signed-in users');

  const uiSource = await readFile(new URL('../app/bank/GalacticIncreaseSandboxRecovery.js', import.meta.url), 'utf8');
  assert.match(uiSource, /recoveryResponse\.ok && Boolean\(recovery\?\.recoveryAvailable\)/, 'recovery UI must use the owner recovery endpoint as the positive handoff signal');
  assert.equal(uiSource.includes('hasPrivateFeatureRestriction'), false, 'recovery UI must not depend on one exact Increase private-feature error shape');
  assert.match(uiSource, /Create sandbox test account/, 'recovery UI must provide the one-click account action');
  assert.match(uiSource, /takeOverLegacySetup/, 'recovery UI must hide the legacy hosted-onboarding blocker while it owns the recovery state');
  assert.match(uiSource, /This is not KYC or a real bank account/, 'recovery UI must disclose the account-only boundary');
  assert.equal(uiSource.includes('/api/admin/bank/increase/recovery'), true);
  assert.equal(uiSource.includes('NEXT_PUBLIC_INCREASE'), false, 'recovery UI must not reference client-exposed Increase credentials');

  const lifecycleRouteSource = await readFile(new URL('../app/api/bank/lifecycle/route.ts', import.meta.url), 'utf8');
  assert.match(lifecycleRouteSource, /getIncreaseSandboxOwnerRecoveryAccount/, 'lifecycle should recognize recovered Account state even before database migration 025');
  assert.match(lifecycleRouteSource, /SANDBOX_ACCOUNT_ONLY/, 'lifecycle fallback must stay explicitly account-only, not KYC');
  assert.equal(lifecycleRouteSource.includes('accountId'), false, 'lifecycle route must not expose provider Account IDs');

  console.log('Galactic Trust Increase recovery checks passed: the mounted owner fallback is driven by the recovery endpoint, creates and rediscovers one owner-scoped sandbox Account via Increase idempotency-key lookup without Programs, Entities, hosted onboarding, or migration 025, while KYC and production money movement remain locked.');
} finally {
  globalThis.fetch = originalFetch;
}
