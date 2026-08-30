import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recoverIncreaseSandboxOwnerAccount } from '../lib/banking/increase-sandbox-recovery.js';

const requests = [];
const originalFetch = globalThis.fetch;

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
    return json({ data: [], next_cursor: null });
  }
  if (method === 'POST' && url.pathname === '/accounts') {
    assert.deepEqual(JSON.parse(init.body), { name: 'Galactic Trust Sandbox Checking' }, 'recovery Account creation must not require Program or Entity input');
    return json({
      id: 'sandbox_account_recovery123',
      entity_id: 'sandbox_entity_default123',
      program_id: 'sandbox_program_default123',
      name: 'Galactic Trust Sandbox Checking',
      status: 'open',
      currency: 'USD',
      bank: 'increase_bank',
    });
  }
  if (method === 'GET' && url.pathname === '/account_numbers') {
    return json({ data: [], next_cursor: null });
  }
  if (method === 'POST' && url.pathname === '/account_numbers') {
    return json({ id: 'sandbox_account_number_recovery123', status: 'active' });
  }
  if (method === 'GET' && url.pathname === '/accounts/sandbox_account_recovery123') {
    return json({
      id: 'sandbox_account_recovery123',
      entity_id: 'sandbox_entity_default123',
      program_id: 'sandbox_program_default123',
      name: 'Galactic Trust Sandbox Checking',
      status: 'open',
      currency: 'USD',
      bank: 'increase_bank',
    });
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
  const result = await recoverIncreaseSandboxOwnerAccount('00000000-0000-4000-8000-000000000123', {
    GALACTIC_INCREASE_SANDBOX_ENABLED: 'true',
    INCREASE_SANDBOX_API_KEY: 'sandbox_test_key_not_secret',
  });

  assert.equal(result.provider, 'Increase');
  assert.equal(result.environment, 'sandbox');
  assert.equal(result.bindingKind, 'SANDBOX_ACCOUNT_ONLY');
  assert.equal(result.canMoveRealMoney, false);
  assert.equal(result.accountCreated, true);
  assert.equal(result.accountNumber.ready, true);
  assert.equal(result.dashboard.connected, true);
  assert.equal(result.dashboard.canMoveRealMoney, false);

  const requestedPaths = requests.map((entry) => entry.pathname).join('\n');
  assert.equal(requestedPaths.includes('/programs'), false, 'account-only recovery must not call Programs');
  assert.equal(requestedPaths.includes('/entities'), false, 'account-only recovery must not call Entities');
  assert.equal(requestedPaths.includes('entity_onboarding_sessions'), false, 'account-only recovery must not call hosted onboarding');
  assert.equal(requests.some((entry) => entry.method === 'POST' && entry.pathname === '/accounts'), true, 'recovery must create the sandbox Account when no idempotent Account exists');
  assert.equal(requests.some((entry) => entry.method === 'POST' && entry.pathname === '/account_numbers'), true, 'recovery should create an Account Number for sandbox ACH simulation when available');

  const routeSource = await readFile(new URL('../app/api/admin/bank/increase/recovery/route.ts', import.meta.url), 'utf8');
  assert.match(routeSource, /requireGalacticTrustAdmin/, 'recovery route must be owner/admin authenticated');
  assert.match(routeSource, /bindIncreaseSandboxAccountOnly/, 'recovery must use the explicit account-only binding path');
  assert.match(routeSource, /publicBindingSummary/, 'browser response must use the sanitized binding summary');
  assert.match(routeSource, /canMoveRealMoney: false/, 'recovery route must stay fail-closed for real money');
  assert.equal(routeSource.includes('INCREASE_SANDBOX_API_KEY'), false, 'recovery route must never expose or read a client-visible provider key');

  const bindingSource = await readFile(new URL('../lib/banking/provider-account-binding.js', import.meta.url), 'utf8');
  assert.match(bindingSource, /SANDBOX_ACCOUNT_ONLY/, 'binding layer must preserve the account-only marker separately from KYC simulation');
  assert.match(bindingSource, /SANDBOX_VALID_SIMULATION/, 'hosted/simulated KYC marker must remain available for the normal onboarding path');

  const uiSource = await readFile(new URL('../app/bank/GalacticIncreaseSandboxRecovery.js', import.meta.url), 'utf8');
  assert.match(uiSource, /private_feature_error/, 'recovery UI must only activate for the private-feature restriction');
  assert.match(uiSource, /Create sandbox test account/, 'recovery UI must provide the one-click account action');
  assert.match(uiSource, /This is not KYC or a real bank account/, 'recovery UI must disclose the account-only boundary');
  assert.equal(uiSource.includes('/api/admin/bank/increase/recovery'), true);
  assert.equal(uiSource.includes('NEXT_PUBLIC_INCREASE'), false, 'recovery UI must not reference client-exposed Increase credentials');

  console.log('Galactic Trust Increase recovery checks passed: the private-feature fallback creates an owner-scoped sandbox Account without Programs, Entities, or hosted onboarding, keeps KYC semantics separate, and remains pretend-money only.');
} finally {
  globalThis.fetch = originalFetch;
}
