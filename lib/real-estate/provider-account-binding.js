import { getDinariConfig } from './dinari.js';

const TABLE = 'vault_provider_account_bindings';

function clean(value) {
  return String(value ?? '').trim();
}

function validId(value, label) {
  const id = clean(value);
  if (!id || id.length > 128) throw new Error(`${label} is required and must be 128 characters or fewer.`);
  return id;
}

function normalizeBinding(row = {}) {
  if (!row || typeof row !== 'object') return null;
  const userId = clean(row.user_id || row.userId);
  const provider = clean(row.provider).toLowerCase();
  const environment = clean(row.environment).toLowerCase();
  const entityId = clean(row.entity_id || row.entityId);
  const accountId = clean(row.account_id || row.accountId);
  const status = clean(row.binding_status || row.status || 'verified').toLowerCase();
  if (!userId || !provider || !environment || !entityId || !accountId) return null;
  return {
    userId,
    provider,
    environment,
    entityId,
    accountId,
    status,
    source: clean(row.binding_source || row.source || 'provider-onboarding'),
    kycStatus: clean(row.provider_kyc_status || row.kycStatus),
    verifiedAt: clean(row.verified_at || row.verifiedAt),
  };
}

function tableMissing(error) {
  const code = clean(error?.code);
  const message = clean(error?.message);
  return code === '42P01' || /vault_provider_account_bindings|relation .* does not exist/i.test(message);
}

export async function getProviderAccountBinding(admin, userId, {
  provider = 'dinari',
  environment = 'sandbox',
} = {}) {
  const uid = validId(userId, 'Voxel Vault user ID');
  const normalizedProvider = clean(provider).toLowerCase();
  const normalizedEnvironment = clean(environment).toLowerCase();

  const { data, error } = await admin
    .from(TABLE)
    .select('user_id,provider,environment,entity_id,account_id,binding_status,binding_source,provider_kyc_status,verified_at')
    .eq('user_id', uid)
    .eq('provider', normalizedProvider)
    .eq('environment', normalizedEnvironment)
    .maybeSingle();

  if (error) {
    if (tableMissing(error)) {
      return {
        binding: null,
        setupRequired: true,
        error: 'Provider identity binding storage is not installed yet. Apply Supabase migration 014_provider_account_bindings.sql before showing provider holdings as user-owned.',
      };
    }
    throw new Error(`Could not read provider account binding: ${error.message}`);
  }

  const binding = normalizeBinding(data);
  if (!binding || binding.status !== 'verified') return { binding: null, setupRequired: false, error: '' };
  return { binding, setupRequired: false, error: '' };
}

export async function bindDinariSandboxAccount(admin, userId, {
  entityId,
  accountId,
  kycStatus = 'PASS',
  source = 'provider-onboarding',
} = {}, env = process.env) {
  const config = getDinariConfig(env);
  if (config.environment !== 'sandbox') {
    throw new Error('Voxel Vault only writes Dinari identity bindings from the sandbox onboarding workflow right now.');
  }
  const uid = validId(userId, 'Voxel Vault user ID');
  const entity = validId(entityId, 'Dinari Entity ID');
  const account = validId(accountId, 'Dinari Account ID');
  const normalizedKyc = clean(kycStatus).toUpperCase();
  if (normalizedKyc !== 'PASS') throw new Error('Dinari KYC must be PASS before Voxel Vault binds the provider account to a user.');

  const row = {
    user_id: uid,
    provider: 'dinari',
    environment: 'sandbox',
    entity_id: entity,
    account_id: account,
    binding_status: 'verified',
    binding_source: clean(source || 'provider-onboarding').slice(0, 80),
    provider_kyc_status: 'PASS',
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from(TABLE)
    .upsert(row, { onConflict: 'user_id,provider,environment' })
    .select('user_id,provider,environment,entity_id,account_id,binding_status,binding_source,provider_kyc_status,verified_at')
    .single();

  if (error) {
    if (tableMissing(error)) {
      throw new Error('Provider account was verified, but identity binding storage is not installed yet. Apply Supabase migration 014_provider_account_bindings.sql, then bind again.');
    }
    if (clean(error.code) === '23505') {
      throw new Error('This Dinari account is already bound to another Voxel Vault user. Voxel Vault refuses to reassign it automatically.');
    }
    throw new Error(`Could not bind Dinari account to Voxel Vault user: ${error.message}`);
  }

  return normalizeBinding(data);
}

export function buildReadOnlyDinariEnvForBinding(binding, env = process.env) {
  const normalized = normalizeBinding(binding);
  if (!normalized || normalized.provider !== 'dinari' || normalized.status !== 'verified') {
    throw new Error('A verified Dinari provider binding is required.');
  }

  const baseConfig = getDinariConfig(env);
  if (baseConfig.environment !== normalized.environment) {
    throw new Error(`Provider binding environment mismatch: binding is ${normalized.environment}, server is ${baseConfig.environment}.`);
  }

  return {
    ...env,
    DINARI_ACCOUNT_ID: normalized.accountId,
    DINARI_ENTITY_ID: normalized.entityId,
    DINARI_SANDBOX_ORDER_EXECUTION_ENABLED: 'false',
    DINARI_SANDBOX_FAUCET_ENABLED: 'false',
    DINARI_PRODUCTION_TRADING_ENABLED: 'false',
  };
}

export function publicBindingSummary(binding) {
  const normalized = normalizeBinding(binding);
  if (!normalized) return null;
  return {
    provider: normalized.provider,
    environment: normalized.environment,
    status: normalized.status,
    source: normalized.source,
    kycStatus: normalized.kycStatus,
    verifiedAt: normalized.verifiedAt,
    accountSuffix: normalized.accountId.length > 6 ? normalized.accountId.slice(-6) : normalized.accountId,
  };
}
