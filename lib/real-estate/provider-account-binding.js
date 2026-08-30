import { getIncreaseSandboxConfig } from '../banking/increase-sandbox.js';
import { getDinariConfig } from './dinari.js';

const TABLE = 'vault_provider_account_bindings';
const BINDING_COLUMNS = 'user_id,provider,environment,entity_id,account_id,binding_status,binding_source,provider_kyc_status,verified_at';

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
  return code === '42P01'
    || /relation ["']?vault_provider_account_bindings["']? does not exist/i.test(message);
}

function increaseProviderConstraintMissing(error) {
  const code = clean(error?.code);
  const message = clean(error?.message);
  return code === '23514' && /vault_provider_account_bindings_provider_check|provider/i.test(message);
}

async function upsertBinding(admin, row, providerLabel) {
  const { data, error } = await admin
    .from(TABLE)
    .upsert(row, { onConflict: 'user_id,provider,environment' })
    .select(BINDING_COLUMNS)
    .single();

  if (error) {
    if (tableMissing(error)) {
      throw new Error('Provider account was verified, but identity binding storage is not installed yet. Apply Supabase migration 014_provider_account_bindings.sql, then bind again.');
    }
    if (providerLabel === 'Increase' && increaseProviderConstraintMissing(error)) {
      throw new Error('Increase account binding storage is not enabled yet. Apply Supabase migration 025_galactic_increase_account_bindings.sql, then bind again.');
    }
    if (clean(error.code) === '23505') {
      throw new Error(`This ${providerLabel} account is already bound to another Voxel Vault user. Voxel Vault refuses to reassign it automatically.`);
    }
    throw new Error(`Could not bind ${providerLabel} account to Voxel Vault user: ${error.message}`);
  }

  return normalizeBinding(data);
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
    .select(BINDING_COLUMNS)
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

  const now = new Date().toISOString();
  return upsertBinding(admin, {
    user_id: uid,
    provider: 'dinari',
    environment: 'sandbox',
    entity_id: entity,
    account_id: account,
    binding_status: 'verified',
    binding_source: clean(source || 'provider-onboarding').slice(0, 80),
    provider_kyc_status: 'PASS',
    verified_at: now,
    updated_at: now,
  }, 'Dinari');
}

export async function bindIncreaseSandboxAccount(admin, userId, {
  entityId = '',
  accountId = '',
  validationStatus = '',
  source = 'increase-hosted-sandbox-onboarding',
} = {}, env = process.env) {
  const config = getIncreaseSandboxConfig(env);
  if (!config.enabled || !config.credentialsConfigured || config.environment !== 'sandbox' || config.canMoveRealMoney) {
    throw new Error('Galactic Trust only writes Increase identity bindings from the configured pretend-money sandbox workflow.');
  }

  const uid = validId(userId, 'Voxel Vault user ID');
  const entity = validId(entityId, 'Increase Entity ID');
  const account = validId(accountId, 'Increase Account ID');
  const normalizedValidation = clean(validationStatus).toLowerCase();
  if (normalizedValidation !== 'valid') {
    throw new Error('Increase sandbox Entity validation must be valid before Galactic Trust binds the provider account to a user.');
  }

  const now = new Date().toISOString();
  return upsertBinding(admin, {
    user_id: uid,
    provider: 'increase',
    environment: 'sandbox',
    entity_id: entity,
    account_id: account,
    binding_status: 'verified',
    binding_source: clean(source || 'increase-hosted-sandbox-onboarding').slice(0, 80),
    provider_kyc_status: 'SANDBOX_VALID_SIMULATION',
    verified_at: now,
    updated_at: now,
  }, 'Increase');
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
