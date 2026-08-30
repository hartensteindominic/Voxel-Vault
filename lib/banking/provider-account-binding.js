import { getIncreaseSandboxConfig } from './increase-sandbox.js';

// The table name is retained for compatibility with migrations 014 and 025.
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
  if (!userId || provider !== 'increase' || environment !== 'sandbox' || !entityId || !accountId) return null;
  return {
    userId,
    provider,
    environment,
    entityId,
    accountId,
    status,
    source: clean(row.binding_source || row.source || 'increase-hosted-sandbox-onboarding'),
    kycStatus: clean(row.provider_kyc_status || row.kycStatus),
    verifiedAt: clean(row.verified_at || row.verifiedAt),
  };
}

function tableMissing(error) {
  const code = clean(error?.code);
  const message = clean(error?.message);
  return code === '42P01' || /relation ["']?vault_provider_account_bindings["']? does not exist/i.test(message);
}

function increaseProviderConstraintMissing(error) {
  const code = clean(error?.code);
  const message = clean(error?.message);
  return code === '23514' && /vault_provider_account_bindings_provider_check|provider/i.test(message);
}

async function upsertBinding(admin, row) {
  const { data, error } = await admin
    .from(TABLE)
    .upsert(row, { onConflict: 'user_id,provider,environment' })
    .select(BINDING_COLUMNS)
    .single();

  if (error) {
    if (tableMissing(error)) {
      throw new Error('Galactic Trust provider binding storage is not installed yet. Apply Supabase migration 014_provider_account_bindings.sql, then bind again.');
    }
    if (increaseProviderConstraintMissing(error)) {
      throw new Error('Increase account binding storage is not enabled yet. Apply Supabase migration 025_galactic_increase_account_bindings.sql, then bind again.');
    }
    if (clean(error.code) === '23505') {
      throw new Error('This Increase sandbox account is already bound to another Galactic Trust user. Galactic Trust refuses to reassign it automatically.');
    }
    throw new Error(`Could not bind Increase sandbox account: ${error.message}`);
  }

  return normalizeBinding(data);
}

function assertIncreaseSandboxBindingEnvironment(env = process.env) {
  const config = getIncreaseSandboxConfig(env);
  if (!config.enabled || !config.credentialsConfigured || config.environment !== 'sandbox' || config.canMoveRealMoney) {
    throw new Error('Galactic Trust only writes Increase identity bindings from the configured pretend-money sandbox workflow.');
  }
}

async function writeIncreaseSandboxBinding(admin, userId, {
  entityId = '',
  accountId = '',
  source = '',
  kycStatus = '',
} = {}, env = process.env) {
  assertIncreaseSandboxBindingEnvironment(env);
  const uid = validId(userId, 'Galactic Trust user ID');
  const entity = validId(entityId, 'Increase Entity ID');
  const account = validId(accountId, 'Increase Account ID');
  const normalizedKycStatus = clean(kycStatus).toUpperCase();
  if (!['SANDBOX_VALID_SIMULATION', 'SANDBOX_ACCOUNT_ONLY'].includes(normalizedKycStatus)) {
    throw new Error('Unsupported Increase sandbox binding verification state.');
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
    provider_kyc_status: normalizedKycStatus,
    verified_at: now,
    updated_at: now,
  });
}

export async function getProviderAccountBinding(admin, userId, {
  provider = 'increase',
  environment = 'sandbox',
} = {}) {
  const uid = validId(userId, 'Galactic Trust user ID');
  const normalizedProvider = clean(provider).toLowerCase();
  const normalizedEnvironment = clean(environment).toLowerCase();
  if (normalizedProvider !== 'increase' || normalizedEnvironment !== 'sandbox') {
    throw new Error('Galactic Trust provider bindings are restricted to the Increase sandbox workflow.');
  }

  const { data, error } = await admin
    .from(TABLE)
    .select(BINDING_COLUMNS)
    .eq('user_id', uid)
    .eq('provider', 'increase')
    .eq('environment', 'sandbox')
    .maybeSingle();

  if (error) {
    if (tableMissing(error)) {
      return {
        binding: null,
        setupRequired: true,
        error: 'Galactic Trust provider binding storage is not installed yet. Apply Supabase migration 014_provider_account_bindings.sql before showing provider data as user-owned.',
      };
    }
    throw new Error(`Could not read Galactic Trust provider binding: ${error.message}`);
  }

  const binding = normalizeBinding(data);
  if (!binding || binding.status !== 'verified') return { binding: null, setupRequired: false, error: '' };
  return { binding, setupRequired: false, error: '' };
}

export async function bindIncreaseSandboxAccount(admin, userId, {
  entityId = '',
  accountId = '',
  validationStatus = '',
  source = 'increase-hosted-sandbox-onboarding',
} = {}, env = process.env) {
  const normalizedValidation = clean(validationStatus).toLowerCase();
  if (normalizedValidation !== 'valid') {
    throw new Error('Increase sandbox Entity validation must be valid before Galactic Trust binds the provider account to a user.');
  }
  return writeIncreaseSandboxBinding(admin, userId, {
    entityId,
    accountId,
    source,
    kycStatus: 'SANDBOX_VALID_SIMULATION',
  }, env);
}

export async function bindIncreaseSandboxAccountOnly(admin, userId, {
  entityId = '',
  accountId = '',
  source = 'increase-sandbox-account-recovery',
} = {}, env = process.env) {
  return writeIncreaseSandboxBinding(admin, userId, {
    entityId,
    accountId,
    source,
    kycStatus: 'SANDBOX_ACCOUNT_ONLY',
  }, env);
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
