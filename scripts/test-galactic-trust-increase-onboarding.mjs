import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  bootstrapIncreaseSandboxAccount,
  createIncreaseSandboxOnboardingSession,
  getIncreaseSandboxEntityReadiness,
  inspectIncreaseSandboxOnboarding,
  simulateIncreaseSandboxEntityValid,
  submitIncreaseSandboxOnboardingSession,
} from '../lib/banking/increase-onboarding-sandbox.js';
import {
  getIncreaseSandboxDashboardForAccount,
  simulateIncreaseSandboxDepositForAccount,
  simulateIncreaseSandboxSendForAccount,
} from '../lib/banking/increase-sandbox.js';

const env = {
  GALACTIC_INCREASE_SANDBOX_ENABLED: 'true',
  INCREASE_SANDBOX_API_KEY: 'sandbox-test-key',
};

const program = {
  id: 'sandbox_program_test',
  name: 'Commercial Banking',
  bank: 'increase_bank',
};
const entity = {
  id: 'sandbox_entity_test',
  status: 'active',
  structure: 'natural_person',
  validation: null,
};
let session = {
  id: 'sandbox_entity_onboarding_session_test',
  status: 'active',
  program_id: program.id,
  entity_id: null,
  session_url: 'https://onboarding.increase.com/onboarding/sessions?id=sandbox-test',
  expires_at: '2026-08-31T00:00:00Z',
};
let account = null;
let accountNumber = null;
const calls = [];

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

globalThis.fetch = async (input, options = {}) => {
  const url = input instanceof URL ? input : new URL(String(input));
  const method = String(options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(String(options.body)) : null;
  calls.push({ url: url.toString(), method, headers: options.headers || {}, body });

  assert.equal(url.origin, 'https://sandbox.increase.com', 'onboarding must never leave the Increase sandbox API origin');
  assert.equal(options.headers?.Authorization, 'Bearer sandbox-test-key', 'sandbox credential must be used server-side');

  if (method === 'GET' && url.pathname === '/programs') return jsonResponse({ data: [program] });

  if (method === 'POST' && url.pathname === '/entity_onboarding_sessions') {
    assert.deepEqual(body, {
      program_id: program.id,
      redirect_url: 'https://www.voxelvault.io/bank?increase_onboarding=complete',
    });
    return jsonResponse(session);
  }

  if (method === 'POST' && url.pathname === `/simulations/entity_onboarding_sessions/${session.id}/submit`) {
    session = { ...session, status: 'expired', entity_id: entity.id, session_url: null };
    return jsonResponse(session);
  }

  if (method === 'GET' && url.pathname === `/entities/${entity.id}`) return jsonResponse(entity);

  if (method === 'POST' && url.pathname === `/simulations/entities/${entity.id}/update_validation`) {
    assert.deepEqual(body, { issues: [] });
    entity.validation = { status: 'valid', issues: [] };
    return jsonResponse(entity);
  }

  if (method === 'GET' && url.pathname === '/accounts' && url.searchParams.get('entity_id') === entity.id) {
    return jsonResponse({ data: account ? [account] : [] });
  }

  if (method === 'POST' && url.pathname === '/accounts') {
    assert.equal(body.entity_id, entity.id);
    assert.equal(body.program_id, program.id);
    assert.equal(body.name, 'Galactic Trust Sandbox Checking');
    account = {
      id: 'sandbox_account_test',
      entity_id: entity.id,
      program_id: program.id,
      name: body.name,
      status: 'open',
      currency: 'USD',
      bank: 'increase_bank',
    };
    return jsonResponse(account);
  }

  if (method === 'GET' && account && url.pathname === `/accounts/${account.id}`) return jsonResponse(account);

  if (method === 'GET' && account && url.pathname === `/accounts/${account.id}/balance`) {
    return jsonResponse({ current_balance: 125000, available_balance: 120000 });
  }

  if (method === 'GET' && url.pathname === '/transactions' && account && url.searchParams.get('account_id') === account.id) {
    return jsonResponse({ data: [] });
  }

  if (method === 'GET' && url.pathname === '/account_numbers' && url.searchParams.get('account_id') === account?.id) {
    return jsonResponse({ data: accountNumber ? [accountNumber] : [] });
  }

  if (method === 'POST' && url.pathname === '/account_numbers') {
    assert.equal(body.account_id, account?.id);
    accountNumber = {
      id: 'sandbox_account_number_test',
      account_id: account.id,
      name: body.name,
      status: 'active',
      account_number: '123456789',
      routing_number: '101050001',
    };
    return jsonResponse(accountNumber);
  }

  if (method === 'POST' && url.pathname === '/simulations/inbound_ach_transfers') {
    assert.equal(body.account_number_id, accountNumber?.id, 'bound sandbox funding must use the Account Number attached to the bound Account');
    return jsonResponse({ id: 'sandbox_inbound_ach_transfer_test' });
  }

  if (method === 'POST' && url.pathname === '/ach_transfers') {
    assert.equal(body.account_id, account?.id, 'bound sandbox send must use the exact bound Account ID');
    return jsonResponse({ id: 'sandbox_ach_transfer_test' });
  }

  if (method === 'POST' && url.pathname === '/simulations/ach_transfers/sandbox_ach_transfer_test/settle') {
    return jsonResponse({ id: 'sandbox_ach_transfer_test', status: 'settled' });
  }

  throw new Error(`Unexpected mocked Increase request: ${method} ${url}`);
};

const inspection = await inspectIncreaseSandboxOnboarding(env);
assert.equal(inspection.connected, true);
assert.equal(inspection.canMoveRealMoney, false);
assert.deepEqual(inspection.programs, [{ id: program.id, name: program.name, bank: program.bank }]);

const created = await createIncreaseSandboxOnboardingSession({
  redirectUrl: 'https://www.voxelvault.io/bank?increase_onboarding=complete',
}, env);
assert.equal(created.canMoveRealMoney, false);
assert.equal(created.session.id, session.id);
assert.match(created.session.sessionUrl, /^https:\/\/onboarding\.increase\.com\//);
assert.equal(JSON.stringify(created).includes('sandbox-test-key'), false, 'API key must never be returned');

const submitted = await submitIncreaseSandboxOnboardingSession(session.id, env);
assert.equal(submitted.simulated, true);
assert.equal(submitted.session.entityId, entity.id);
assert.equal(submitted.session.status, 'expired');

const beforeValidation = await getIncreaseSandboxEntityReadiness(entity.id, env);
assert.equal(beforeValidation.validationStatus, 'not_simulated');
assert.equal(beforeValidation.readyForSandboxAccount, false);

await assert.rejects(
  () => bootstrapIncreaseSandboxAccount({ entityId: entity.id }, env),
  /not ready for account creation/i,
  'account creation must fail closed until the sandbox Entity validation is explicitly valid',
);

const validation = await simulateIncreaseSandboxEntityValid(entity.id, env);
assert.equal(validation.validationSimulation, true);
assert.equal(validation.validationStatus, 'valid');
assert.equal(validation.readyForSandboxAccount, true);

const bootstrapped = await bootstrapIncreaseSandboxAccount({ entityId: entity.id }, env);
assert.equal(bootstrapped.canMoveRealMoney, false);
assert.equal(bootstrapped.account.id, 'sandbox_account_test');
assert.equal(bootstrapped.account.created, true);
assert.equal(bootstrapped.accountNumber.id, 'sandbox_account_number_test');
assert.equal(bootstrapped.accountNumber.created, true);
assert.equal(bootstrapped.accountNumber.detailsWithheld, true);
assert.equal('account_number' in bootstrapped.accountNumber, false, 'raw account number must not leave bootstrap helper');
assert.equal('routing_number' in bootstrapped.accountNumber, false, 'raw routing number must not leave bootstrap helper');

const boundDashboard = await getIncreaseSandboxDashboardForAccount(bootstrapped.account.id, env);
assert.equal(boundDashboard.boundAccount, true, 'owner-bound dashboard must identify that it is scoped to a binding');
assert.equal(boundDashboard.accounts.length, 1, 'owner-bound dashboard must never append unrelated sandbox Accounts');
assert.equal(boundDashboard.accounts[0].currentBalance, 1250);

const fundedDashboard = await simulateIncreaseSandboxDepositForAccount(50000, bootstrapped.account.id, env);
assert.equal(fundedDashboard.boundAccount, true);
assert.equal(fundedDashboard.accounts.length, 1);

const sentDashboard = await simulateIncreaseSandboxSendForAccount(2500, 'Sandbox Recipient', bootstrapped.account.id, env);
assert.equal(sentDashboard.boundAccount, true);
assert.equal(sentDashboard.accounts.length, 1);

const requestBodies = JSON.stringify(calls.map((call) => call.body));
for (const sensitiveField of ['social_security_number', 'tax_identifier', 'date_of_birth', 'identification', 'address']) {
  assert.equal(requestBodies.includes(sensitiveField), false, `Galactic Trust must not collect hosted-onboarding PII field: ${sensitiveField}`);
}

await assert.rejects(
  () => createIncreaseSandboxOnboardingSession({ redirectUrl: 'http://attacker.example/callback' }, env),
  /must use HTTPS/i,
  'non-local onboarding redirects must be HTTPS',
);

const routeSource = await readFile(new URL('../app/api/admin/bank/increase/onboarding/route.ts', import.meta.url), 'utf8');
assert.match(routeSource, /requireVoxelVaultAdmin/, 'onboarding API must remain owner-only');
assert.match(routeSource, /private, no-store/, 'onboarding API must prohibit caching');
assert.match(routeSource, /complete_setup/, 'route should expose an explicit sandbox-completion action');
assert.match(routeSource, /not a real KYC\/CIP\/AML decision/, 'sandbox validation simulation must be clearly disclosed');
assert.match(routeSource, /bindIncreaseSandboxAccount/, 'successful Increase sandbox account creation must be bound to the authenticated Galactic Trust owner');
assert.match(routeSource, /getProviderAccountBinding/, 'onboarding status must read the authenticated owner provider binding');
assert.match(routeSource, /publicBindingSummary/, 'browser responses must use the masked provider binding summary');
assert.match(routeSource, /auth\.user\.id/, 'provider binding must use the verified Supabase user ID rather than a client-supplied user identifier');
assert.match(routeSource, /provider: 'increase',[\s\S]*environment: 'sandbox'/, 'Increase binding lookup must stay scoped to the sandbox environment');
assert.match(routeSource, /binding = await bindOwnerSandboxAccount\(auth, result, 'increase-hosted-sandbox-onboarding'\)/, 'hosted onboarding completion must bind the resulting provider Account to the signed-in owner');
assert.match(routeSource, /This is not real KYC approval/, 'bound sandbox setup must still disclaim real KYC approval');
assert.equal(routeSource.includes('NEXT_PUBLIC_'), false, 'onboarding API must not use client-side provider credentials');

const bindingSource = await readFile(new URL('../lib/real-estate/provider-account-binding.js', import.meta.url), 'utf8');
assert.match(bindingSource, /bindIncreaseSandboxAccount/, 'trusted provider binding helper must support Increase sandbox');
assert.match(bindingSource, /getIncreaseSandboxConfig/, 'Increase binding writes must verify the server-side sandbox configuration');
assert.match(bindingSource, /provider_kyc_status: 'SANDBOX_VALID_SIMULATION'/, 'Increase sandbox validation must be stored as simulation, never real KYC PASS');
assert.match(bindingSource, /provider: 'increase',[\s\S]*environment: 'sandbox'/, 'Increase binding must remain sandbox-scoped');
assert.match(bindingSource, /migration 025_galactic_increase_account_bindings/, 'stale provider allowlist must fail closed with the required migration');

const dashboardRouteSource = await readFile(new URL('../app/api/admin/bank/increase/dashboard/route.ts', import.meta.url), 'utf8');
assert.match(dashboardRouteSource, /getProviderAccountBinding/, 'sandbox dashboard route must load the authenticated owner binding');
assert.match(dashboardRouteSource, /auth\.user\.id/, 'sandbox dashboard binding lookup must use the verified session user ID');
assert.match(dashboardRouteSource, /getIncreaseSandboxDashboardForAccount\(bindingState\.binding\.accountId/, 'sandbox dashboard must read exactly the bound Account rather than a global provider account list');
assert.match(dashboardRouteSource, /No Increase sandbox Account is bound to this signed-in Galactic Trust owner yet/, 'unbound owner dashboard must fail closed');
assert.doesNotMatch(dashboardRouteSource, /getIncreaseSandboxDashboard\(process\.env\)/, 'owner dashboard must not fall back to the old global sandbox dashboard');

const fundRouteSource = await readFile(new URL('../app/api/admin/bank/increase/fund/route.ts', import.meta.url), 'utf8');
assert.match(fundRouteSource, /getProviderAccountBinding/, 'sandbox funding route must require the authenticated owner binding');
assert.match(fundRouteSource, /simulateIncreaseSandboxDepositForAccount/, 'sandbox funding must target the bound Account explicitly');
assert.match(fundRouteSource, /bindingState\.binding\.accountId/, 'sandbox funding must source Account ID from server-side binding storage');

const transferRouteSource = await readFile(new URL('../app/api/admin/bank/increase/transfer/route.ts', import.meta.url), 'utf8');
assert.match(transferRouteSource, /getProviderAccountBinding/, 'sandbox transfer route must require the authenticated owner binding');
assert.match(transferRouteSource, /simulateIncreaseSandboxSendForAccount/, 'sandbox transfers must target the bound Account explicitly');
assert.match(transferRouteSource, /bindingState\.binding\.accountId/, 'sandbox transfer must source Account ID from server-side binding storage');

const setupSource = await readFile(new URL('../app/bank/GalacticSandboxSetup.js', import.meta.url), 'utf8');
assert.match(setupSource, /\/api\/admin\/bank\/increase\/onboarding/, 'owner UI must use the owner-only onboarding endpoint');
assert.match(setupSource, /Start hosted sandbox onboarding/, 'owner UI should launch Increase-hosted onboarding');
assert.match(setupSource, /Start owner-scoped sandbox onboarding/, 'existing unbound provider Accounts must trigger owner-scoped onboarding instead of being inherited');
assert.match(setupSource, /This is not real KYC approval/, 'owner UI must label sandbox validation simulation honestly');
assert.match(setupSource, /const bindingReady = Boolean\(binding\?\.provider === 'increase'/, 'owner UI must require an authenticated Increase sandbox binding');
assert.match(setupSource, /const needsAccount = connected && accountCount === 0;/, 'connected sandbox with no account must be an explicit setup-required state');
assert.match(setupSource, /const needsBinding = connected && accountCount > 0 && !bindingReady && !needsBindingStorage;/, 'existing global sandbox Accounts must not be treated as owner-scoped without a binding');
assert.match(setupSource, /const blockingSetup = returnedFromOnboarding \|\| needsAccount \|\| needsBinding \|\| needsBindingStorage;/, 'incomplete account or identity binding setup must block the illustrative dashboard');
assert.match(setupSource, /Existing unbound provider Accounts are deliberately ignored/, 'owner UI must explain that unbound provider Accounts are ignored');
assert.match(setupSource, /Owner-scoped sandbox dashboard ready/, 'setup UI must identify the bound-account ready state');
assert.match(setupSource, /Provider balances and transfer controls stay blocked until a sandbox Account is bound server-side to your signed-in user/, 'provider controls must remain blocked until binding exists');
assert.match(setupSource, /if \(!returnedFromOnboarding && connected && accountCount > 0 && bindingReady\) return null;/, 'setup blocker must disappear only after provider Account and owner binding both exist');
assert.equal(setupSource.includes('INCREASE_SANDBOX_API_KEY'), false, 'client UI must never read the Increase API key');
assert.equal(setupSource.includes('account_number'), false, 'client setup UI must not handle raw account-number data');
assert.equal(setupSource.includes('routing_number'), false, 'client setup UI must not handle raw routing-number data');

const dashboardSource = await readFile(new URL('../lib/banking/increase-sandbox.js', import.meta.url), 'utf8');
assert.match(dashboardSource, /connected: true,[\s\S]*accounts: \[\],[\s\S]*setupRequired: true/, 'provider helper must preserve connected-but-needs-account state');
assert.match(dashboardSource, /getIncreaseSandboxDashboardForAccount/, 'provider helper must expose an exact-account dashboard path');
assert.match(dashboardSource, /resolveBoundAccount/, 'bound provider operations must resolve the exact persisted Account');
assert.match(dashboardSource, /boundAccount: true/, 'bound dashboard response must identify exact-account scoping');
assert.match(dashboardSource, /simulateIncreaseSandboxDepositForAccount/, 'provider helper must expose bound-account sandbox funding');
assert.match(dashboardSource, /simulateIncreaseSandboxSendForAccount/, 'provider helper must expose bound-account sandbox transfers');

const gateSource = await readFile(new URL('../app/bank/GalacticBankGate.js', import.meta.url), 'utf8');
assert.match(gateSource, /GalacticSandboxSetup/, 'bank gate should mount the sandbox setup control');
assert.match(gateSource, /session\?\.user && <GalacticSandboxSetup/, 'sandbox setup control should only mount for signed-in sessions before server authorization');

console.log('Galactic Trust Increase sandbox onboarding checks passed.');
