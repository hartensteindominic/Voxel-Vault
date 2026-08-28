import assert from 'node:assert/strict';
import {
  createDinariManagedKyc,
  createDinariSandboxAccount,
  createDinariSandboxEntity,
  getDinariOnboardingSnapshot,
} from '../lib/real-estate/dinari-onboarding.js';

const sandboxEnv = {
  DINARI_ENVIRONMENT: 'sandbox',
  DINARI_API_KEY_ID: 'sandbox-key-id',
  DINARI_API_SECRET_KEY: 'sandbox-secret-never-return-this',
};

await assert.rejects(
  () => createDinariSandboxEntity({ name: 'Owner', referenceId: 'owner-test' }, { ...sandboxEnv, DINARI_ENVIRONMENT: 'live' }),
  /sandbox-only/i,
  'live environment must refuse entity creation',
);

await assert.rejects(
  () => createDinariManagedKyc({ entity: 'entity-1', jurisdiction: 'US' }, { ...sandboxEnv, DINARI_ENVIRONMENT: 'live' }),
  /sandbox-only/i,
  'live environment must refuse managed KYC creation from this setup tool',
);

let kycPassed = false;
let accountCreated = false;
const calls = [];
const originalFetch = global.fetch;
global.fetch = async (url, options = {}) => {
  const href = String(url);
  const method = String(options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : null;
  calls.push({ href, method, body, headers: options.headers });

  const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

  if (href.endsWith('/entities/me') && method === 'GET') {
    return json({ id: 'partner-org', entity_type: 'ORGANIZATION', is_kyc_complete: true });
  }
  if (href.includes('/entities/?') && method === 'GET') {
    const parsed = new URL(href);
    const reference = parsed.searchParams.get('reference_id');
    if (reference === 'voxel-vault-owner-sandbox') {
      return json({ data: [{ id: 'entity-1', entity_type: 'INDIVIDUAL', is_kyc_complete: kycPassed, reference_id: reference }] });
    }
    return json({ data: [] });
  }
  if (href.endsWith('/entities/') && method === 'POST') {
    return json({ id: 'entity-1', entity_type: 'INDIVIDUAL', is_kyc_complete: false, reference_id: body?.reference_id });
  }
  if (href.endsWith('/entities/entity-1') && method === 'GET') {
    return json({ id: 'entity-1', entity_type: 'INDIVIDUAL', is_kyc_complete: kycPassed, reference_id: 'voxel-vault-owner-sandbox' });
  }
  if (href.endsWith('/entities/entity-stale') && method === 'GET') {
    return json({ id: 'entity-stale', entity_type: 'INDIVIDUAL', is_kyc_complete: false, reference_id: 'old-owner-sandbox' });
  }
  if (href.endsWith('/entities/entity-1/kyc/url') && method === 'POST') {
    return json({ embed_url: 'https://kyc.example.test/session/1', expiration_dt: '2026-08-28T00:00:00Z' });
  }
  if (href.endsWith('/entities/entity-1/kyc') && method === 'GET') {
    return json({ id: 'kyc-1', status: kycPassed ? 'PASS' : 'PENDING', jurisdiction: 'US', checked_dt: '2026-08-27T00:00:00Z' });
  }
  if (href.endsWith('/entities/entity-stale/kyc') && method === 'GET') {
    return json({ id: 'kyc-stale', status: 'PENDING', jurisdiction: 'US', checked_dt: '2026-08-26T00:00:00Z' });
  }
  if (href.includes('/entities/entity-1/accounts') && method === 'GET') {
    return json({ data: accountCreated ? [{ id: 'account-1', entity_id: 'entity-1', is_active: true, jurisdiction: 'US' }] : [] });
  }
  if (href.includes('/entities/entity-stale/accounts') && method === 'GET') {
    return json({ data: [] });
  }
  if (href.endsWith('/entities/entity-1/accounts') && method === 'POST') {
    accountCreated = true;
    return json({ id: 'account-1', entity_id: 'entity-1', is_active: true, jurisdiction: body?.jurisdiction });
  }
  throw new Error(`Unexpected Dinari onboarding request: ${method} ${href}`);
};

try {
  const entity = await createDinariSandboxEntity({ name: 'Voxel Vault Sandbox Owner', referenceId: 'owner-test' }, sandboxEnv);
  assert.equal(entity.id, 'entity-1');
  const entityCall = calls.find((call) => call.href.endsWith('/entities/') && call.method === 'POST');
  assert.equal(entityCall.body.reference_id, 'owner-test');
  assert.equal(entityCall.headers['X-API-Key-Id'], 'sandbox-key-id');

  const managed = await createDinariManagedKyc({ entity: 'entity-1', jurisdiction: 'US' }, sandboxEnv);
  assert.equal(managed.embedUrl, 'https://kyc.example.test/session/1');
  const kycCall = calls.find((call) => call.href.endsWith('/kyc/url'));
  assert.deepEqual(kycCall.body, { jurisdiction: 'US' });

  await assert.rejects(
    () => createDinariSandboxAccount({ entity: 'entity-1', jurisdiction: 'US' }, sandboxEnv),
    /KYC must be PASS/i,
    'account creation must be blocked before KYC PASS',
  );

  kycPassed = true;
  const firstAccount = await createDinariSandboxAccount({ entity: 'entity-1', jurisdiction: 'US' }, sandboxEnv);
  assert.equal(firstAccount.created, true);
  assert.equal(firstAccount.account.id, 'account-1');

  const secondAccount = await createDinariSandboxAccount({ entity: 'entity-1', jurisdiction: 'US' }, sandboxEnv);
  assert.equal(secondAccount.created, false, 'existing active US sandbox account should be reused');
  assert.equal(secondAccount.account.id, 'account-1');

  const snapshot = await getDinariOnboardingSnapshot({ selectedEntityId: 'entity-1' }, sandboxEnv);
  assert.equal(snapshot.organization.connected, true);
  assert.equal(snapshot.entity.id, 'entity-1');
  assert.equal(snapshot.kyc.status, 'PASS');
  assert.equal(snapshot.accounts[0].id, 'account-1');

  const recovered = await getDinariOnboardingSnapshot({ selectedEntityId: 'entity-stale' }, sandboxEnv);
  assert.equal(recovered.entity.id, 'entity-1', 'canonical provider reference must win over stale browser Entity ID');
  assert.equal(recovered.kyc.status, 'PASS', 'recovery must read KYC from the canonical verified Entity');
  assert.equal(recovered.entitySelectionSource, 'provider-reference');
  assert.equal(recovered.recoveredFromStaleBrowserEntity, true);
  assert.equal(recovered.browserEntityId, 'entity-stale');

  const configured = await getDinariOnboardingSnapshot(
    { selectedEntityId: 'entity-stale' },
    { ...sandboxEnv, DINARI_ENTITY_ID: 'entity-1' },
  );
  assert.equal(configured.entity.id, 'entity-1', 'server-configured Entity must have highest priority');
  assert.equal(configured.entitySelectionSource, 'server-configured');

  const serialized = JSON.stringify(recovered);
  assert.equal(serialized.includes('sandbox-secret-never-return-this'), false, 'API secret must never be returned in onboarding snapshot');
  assert.equal(serialized.includes('sandbox-key-id'), false, 'API Key ID is not needed in browser onboarding snapshot');

  const accountPostCalls = calls.filter((call) => call.href.endsWith('/entities/entity-1/accounts') && call.method === 'POST');
  assert.equal(accountPostCalls.length, 1, 'idempotent account creation should not create duplicates');
} finally {
  global.fetch = originalFetch;
}

console.log('Dinari onboarding safety checks passed: live writes are blocked, secrets stay server-side, stale browser Entity IDs recover to the canonical provider Entity, KYC PASS is read from that Entity, and existing accounts are reused.');
