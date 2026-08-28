import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  bindDinariSandboxAccount,
  buildReadOnlyDinariEnvForBinding,
  getProviderAccountBinding,
  publicBindingSummary,
} from '../lib/real-estate/provider-account-binding.js';

const sandboxEnv = {
  DINARI_ENVIRONMENT: 'sandbox',
  DINARI_API_KEY_ID: 'test-key',
  DINARI_API_SECRET_KEY: 'test-secret',
  DINARI_SANDBOX_ORDER_EXECUTION_ENABLED: 'true',
  DINARI_SANDBOX_FAUCET_ENABLED: 'true',
  DINARI_PRODUCTION_TRADING_ENABLED: 'true',
};

function makeAdmin() {
  let stored = null;

  const admin = {
    from(table) {
      assert.equal(table, 'vault_provider_account_bindings');
      return {
        select() {
          const filters = {};
          const chain = {
            eq(key, value) {
              filters[key] = value;
              return chain;
            },
            async maybeSingle() {
              if (!stored) return { data: null, error: null };
              const matches = Object.entries(filters).every(([key, value]) => stored[key] === value);
              return { data: matches ? stored : null, error: null };
            },
          };
          return chain;
        },
        upsert(row) {
          stored = { ...row };
          return {
            select() {
              return {
                async single() {
                  return { data: stored, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  return { admin, read: () => stored };
}

const migration = readFileSync(new URL('../supabase/migrations/014_provider_account_bindings.sql', import.meta.url), 'utf8').toLowerCase();
assert.match(migration, /alter table public\.vault_provider_account_bindings enable row level security/, 'provider binding table must have RLS enabled');
assert.match(migration, /for select to authenticated/, 'users must only get a read-own RLS policy');
assert.doesNotMatch(migration, /for insert to authenticated/, 'browser users must not get provider binding insert rights');
assert.doesNotMatch(migration, /for update to authenticated/, 'browser users must not get provider binding update rights');
assert.doesNotMatch(migration, /for delete to authenticated/, 'browser users must not get provider binding delete rights');
assert.match(migration, /unique \(provider, environment, account_id\)/, 'one provider account must not bind to multiple Voxel Vault users');

const { admin, read } = makeAdmin();
const userId = '11111111-1111-4111-8111-111111111111';
const entityId = 'entity-sandbox-123';
const accountId = 'account-sandbox-abcdef123456';

const before = await getProviderAccountBinding(admin, userId, { provider: 'dinari', environment: 'sandbox' });
assert.equal(before.binding, null, 'unbound user must not inherit a configured/global provider account');
assert.equal(before.setupRequired, false);

await assert.rejects(
  () => bindDinariSandboxAccount(admin, userId, { entityId, accountId, kycStatus: 'PENDING' }, sandboxEnv),
  /KYC must be PASS/i,
  'non-PASS KYC must never create a provider identity binding'
);

await assert.rejects(
  () => bindDinariSandboxAccount(admin, userId, { entityId, accountId, kycStatus: 'PASS' }, { ...sandboxEnv, DINARI_ENVIRONMENT: 'live' }),
  /sandbox onboarding workflow/i,
  'live-environment provider binding writes must remain disabled'
);

const binding = await bindDinariSandboxAccount(admin, userId, {
  entityId,
  accountId,
  kycStatus: 'PASS',
  source: 'test-provider-onboarding',
}, sandboxEnv);

assert.equal(binding?.userId, userId);
assert.equal(binding?.accountId, accountId);
assert.equal(binding?.status, 'verified');
assert.equal(read()?.provider_kyc_status, 'PASS');

const loaded = await getProviderAccountBinding(admin, userId, { provider: 'dinari', environment: 'sandbox' });
assert.equal(loaded.binding?.accountId, accountId);
assert.equal(loaded.binding?.status, 'verified');

const scoped = buildReadOnlyDinariEnvForBinding(binding, sandboxEnv);
assert.equal(scoped.DINARI_ACCOUNT_ID, accountId);
assert.equal(scoped.DINARI_ENTITY_ID, entityId);
assert.equal(scoped.DINARI_SANDBOX_ORDER_EXECUTION_ENABLED, 'false', 'user-bound read route must never inherit sandbox order execution');
assert.equal(scoped.DINARI_SANDBOX_FAUCET_ENABLED, 'false', 'user-bound read route must never inherit sandbox faucet execution');
assert.equal(scoped.DINARI_PRODUCTION_TRADING_ENABLED, 'false', 'user-bound read route must never inherit production trading execution');

assert.throws(
  () => buildReadOnlyDinariEnvForBinding({ ...binding, status: 'suspended' }, sandboxEnv),
  /verified Dinari provider binding/i,
  'suspended provider bindings must not load holdings'
);

const summary = publicBindingSummary(binding);
assert.equal(summary?.status, 'verified');
assert.equal(summary?.accountSuffix, accountId.slice(-6));
assert.equal('accountId' in summary, false, 'browser summary must not expose the full provider account ID');
assert.equal('entityId' in summary, false, 'browser summary must not expose the full provider entity ID');

assert.throws(
  () => buildReadOnlyDinariEnvForBinding(binding, { ...sandboxEnv, DINARI_ENVIRONMENT: 'live' }),
  /environment mismatch/i,
  'a sandbox binding must not be read through live provider configuration'
);

const missingTableAdmin = {
  from() {
    return {
      select() {
        const chain = {
          eq() { return chain; },
          async maybeSingle() {
            return { data: null, error: { code: '42P01', message: 'relation vault_provider_account_bindings does not exist' } };
          },
        };
        return chain;
      },
    };
  },
};

const missing = await getProviderAccountBinding(missingTableAdmin, userId, { provider: 'dinari', environment: 'sandbox' });
assert.equal(missing.binding, null);
assert.equal(missing.setupRequired, true, 'missing binding migration must fail closed and report setup required');
assert.match(missing.error, /migration 014_provider_account_bindings/i);

console.log('Provider binding safety checks passed: RLS has no client writes, global holdings are never inherited, binding is PASS-only and sandbox-only, browser summaries are private, suspended bindings fail closed, and user-bound reads force every trading/funding flag off.');
