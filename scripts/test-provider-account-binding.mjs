import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  bindDinariSandboxAccount,
  bindIncreaseSandboxAccount,
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

const increaseSandboxEnv = {
  GALACTIC_INCREASE_SANDBOX_ENABLED: 'true',
  INCREASE_SANDBOX_API_KEY: 'increase-sandbox-test-key',
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

const increaseMigration = readFileSync(new URL('../supabase/migrations/025_galactic_increase_account_bindings.sql', import.meta.url), 'utf8').toLowerCase();
assert.match(increaseMigration, /provider in \('dinari', 'increase'\)/, 'Increase migration must extend the existing provider allowlist rather than create parallel identity storage');
assert.doesNotMatch(increaseMigration, /create policy/, 'Increase migration must preserve the existing RLS policy set instead of adding browser write policies');
assert.doesNotMatch(increaseMigration, /for insert to authenticated|for update to authenticated|for delete to authenticated/, 'Increase migration must not grant browser writes');

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

const { admin: increaseAdmin, read: readIncrease } = makeAdmin();
const increaseEntityId = 'entity_increase_sandbox_123';
const increaseAccountId = 'account_increase_sandbox_abcdef123456';

const increaseBefore = await getProviderAccountBinding(increaseAdmin, userId, { provider: 'increase', environment: 'sandbox' });
assert.equal(increaseBefore.binding, null, 'an unbound Galactic Trust user must not inherit a global Increase sandbox account');

await assert.rejects(
  () => bindIncreaseSandboxAccount(increaseAdmin, userId, {
    entityId: increaseEntityId,
    accountId: increaseAccountId,
    validationStatus: 'pending',
  }, increaseSandboxEnv),
  /validation must be valid/i,
  'Increase account binding must fail closed until provider sandbox validation is explicitly valid'
);

await assert.rejects(
  () => bindIncreaseSandboxAccount(increaseAdmin, userId, {
    entityId: increaseEntityId,
    accountId: increaseAccountId,
    validationStatus: 'valid',
  }, { ...increaseSandboxEnv, GALACTIC_INCREASE_SANDBOX_ENABLED: 'false' }),
  /pretend-money sandbox workflow/i,
  'Increase binding writes must remain disabled outside the explicitly enabled sandbox workflow'
);

await assert.rejects(
  () => bindIncreaseSandboxAccount(increaseAdmin, userId, {
    entityId: increaseEntityId,
    accountId: increaseAccountId,
    validationStatus: 'valid',
  }, { GALACTIC_INCREASE_SANDBOX_ENABLED: 'true' }),
  /pretend-money sandbox workflow/i,
  'Increase binding writes must require server-side sandbox credentials'
);

const increaseBinding = await bindIncreaseSandboxAccount(increaseAdmin, userId, {
  entityId: increaseEntityId,
  accountId: increaseAccountId,
  validationStatus: 'valid',
  source: 'increase-hosted-sandbox-onboarding',
}, increaseSandboxEnv);

assert.equal(increaseBinding?.userId, userId);
assert.equal(increaseBinding?.provider, 'increase');
assert.equal(increaseBinding?.environment, 'sandbox');
assert.equal(increaseBinding?.accountId, increaseAccountId);
assert.equal(increaseBinding?.status, 'verified');
assert.equal(readIncrease()?.provider_kyc_status, 'SANDBOX_VALID_SIMULATION', 'Increase sandbox validation must never be stored as real KYC PASS');

const increaseLoaded = await getProviderAccountBinding(increaseAdmin, userId, { provider: 'increase', environment: 'sandbox' });
assert.equal(increaseLoaded.binding?.entityId, increaseEntityId);
assert.equal(increaseLoaded.binding?.accountId, increaseAccountId);
assert.equal(increaseLoaded.binding?.kycStatus, 'SANDBOX_VALID_SIMULATION');

const increaseSummary = publicBindingSummary(increaseBinding);
assert.equal(increaseSummary?.provider, 'increase');
assert.equal(increaseSummary?.kycStatus, 'SANDBOX_VALID_SIMULATION');
assert.equal(increaseSummary?.accountSuffix, increaseAccountId.slice(-6));
assert.equal('accountId' in increaseSummary, false, 'browser Increase summary must not expose the full provider account ID');
assert.equal('entityId' in increaseSummary, false, 'browser Increase summary must not expose the full provider entity ID');

const missingIncreaseMigrationAdmin = {
  from() {
    return {
      upsert() {
        return {
          select() {
            return {
              async single() {
                return {
                  data: null,
                  error: {
                    code: '23514',
                    message: 'new row violates check constraint vault_provider_account_bindings_provider_check',
                  },
                };
              },
            };
          },
        };
      },
    };
  },
};

await assert.rejects(
  () => bindIncreaseSandboxAccount(missingIncreaseMigrationAdmin, userId, {
    entityId: increaseEntityId,
    accountId: increaseAccountId,
    validationStatus: 'valid',
  }, increaseSandboxEnv),
  /migration 025_galactic_increase_account_bindings/i,
  'Increase binding must fail closed with a concrete migration requirement when the provider allowlist is stale'
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

console.log('Provider binding safety checks passed: RLS has no client writes, Dinari remains PASS-only and sandbox-only, Increase sandbox uses the same trusted binding table, Increase validation is explicitly recorded as simulation rather than KYC approval, stale migrations fail closed, global holdings are never inherited, browser summaries hide full provider IDs, and user-bound Dinari reads keep every trading/funding flag off.');
