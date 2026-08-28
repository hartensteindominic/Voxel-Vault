import { getDinariConfig } from './dinari.js';

const DEFAULT_OWNER_REFERENCE_ID = 'voxel-vault-owner-sandbox';

function clean(value) {
  return String(value || '').trim();
}

function headers(config) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-API-Key-Id': config.apiKeyId,
    'X-API-Secret-Key': config.apiSecretKey,
  };
}

async function request(path, { env = process.env, method = 'GET', body } = {}) {
  const config = getDinariConfig(env);
  if (!config.credentialsConfigured) throw new Error('Dinari API credentials are not configured.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: headers(config),
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
    if (!response.ok) {
      const message = payload?.detail || payload?.message || payload?.error || `Dinari onboarding request failed with HTTP ${response.status}.`;
      throw new Error(String(message));
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function assertSandbox(config, action) {
  if (config.environment !== 'sandbox') {
    throw new Error(`${action} is sandbox-only in Voxel Vault. Live onboarding changes are intentionally blocked.`);
  }
}

function entityId(value) {
  const id = clean(value);
  if (!id || id.length > 128) throw new Error('A valid Dinari Entity ID is required.');
  return id;
}

function safeEntity(entity = {}) {
  return {
    id: clean(entity.id),
    entityType: clean(entity.entity_type),
    isKycComplete: entity.is_kyc_complete === true,
    referenceId: clean(entity.reference_id),
  };
}

function safeKyc(kyc = {}) {
  return {
    id: clean(kyc.id),
    status: clean(kyc.status),
    jurisdiction: clean(kyc.jurisdiction),
    checkedDt: clean(kyc.checked_dt),
  };
}

function safeAccount(account = {}) {
  return {
    id: clean(account.id),
    entityId: clean(account.entity_id),
    isActive: account.is_active === true,
    jurisdiction: clean(account.jurisdiction),
    brokerageAccountId: clean(account.brokerage_account_id),
  };
}

function items(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export async function probeDinariOrganization(env = process.env) {
  const config = getDinariConfig(env);
  if (!config.credentialsConfigured) return null;
  const organization = await request('/entities/me', { env });
  return {
    id: clean(organization?.id),
    entityType: clean(organization?.entity_type),
    connected: Boolean(organization?.id),
  };
}

export async function getDinariEntity(entity, env = process.env) {
  const id = entityId(entity);
  return safeEntity(await request(`/entities/${encodeURIComponent(id)}`, { env }));
}

export async function listDinariEntitiesByReference(referenceId = DEFAULT_OWNER_REFERENCE_ID, env = process.env) {
  const reference = clean(referenceId);
  if (!reference) return [];
  const params = new URLSearchParams({ reference_id: reference, limit: '20', order: 'desc' });
  const payload = await request(`/entities/?${params.toString()}`, { env });
  return items(payload)
    .map(safeEntity)
    .filter((entity) => entity.id && entity.referenceId === reference);
}

export async function getDinariKyc(entity, env = process.env) {
  const id = entityId(entity);
  try {
    return safeKyc(await request(`/entities/${encodeURIComponent(id)}/kyc`, { env }));
  } catch (error) {
    if (/404|not found|no kyc/i.test(String(error?.message || ''))) {
      return { id: '', status: 'NOT_STARTED', jurisdiction: '', checkedDt: '' };
    }
    throw error;
  }
}

export async function listDinariAccounts(entity, env = process.env) {
  const id = entityId(entity);
  const payload = await request(`/entities/${encodeURIComponent(id)}/accounts?limit=100&order=desc`, { env });
  return items(payload).map(safeAccount).filter((account) => account.id);
}

export async function getDinariOnboardingSnapshot({ selectedEntityId = '' } = {}, env = process.env) {
  const config = getDinariConfig(env);
  const browserEntityId = clean(selectedEntityId);
  const referenceId = clean(env.DINARI_ENTITY_REFERENCE_ID) || DEFAULT_OWNER_REFERENCE_ID;
  const snapshot = {
    provider: config.provider,
    environment: config.environment,
    credentialsConfigured: config.credentialsConfigured,
    configuredEntityId: config.entityId || '',
    configuredAccountId: config.accountId || '',
    browserEntityId,
    canonicalReferenceId: referenceId,
    entitySelectionSource: '',
    recoveredFromStaleBrowserEntity: false,
    organization: null,
    entity: null,
    kyc: null,
    accounts: [],
    errors: [],
  };

  if (!config.credentialsConfigured) return snapshot;

  try {
    snapshot.organization = await probeDinariOrganization(env);
  } catch (error) {
    snapshot.errors.push(`credentials: ${error?.message || 'Dinari credential probe failed'}`);
    return snapshot;
  }

  let canonicalEntities = [];
  try {
    canonicalEntities = await listDinariEntitiesByReference(referenceId, env);
  } catch (error) {
    snapshot.errors.push(`entity-reference: ${error?.message || 'Canonical Entity lookup failed'}`);
  }

  const canonicalEntity = canonicalEntities[0] || null;
  const id = clean(config.entityId || canonicalEntity?.id || browserEntityId);
  snapshot.entitySelectionSource = config.entityId
    ? 'server-configured'
    : canonicalEntity?.id
      ? 'provider-reference'
      : browserEntityId
        ? 'browser-fallback'
        : '';
  snapshot.recoveredFromStaleBrowserEntity = Boolean(
    browserEntityId && id && browserEntityId !== id && (config.entityId || canonicalEntity?.id)
  );

  if (!id) return snapshot;

  try {
    snapshot.entity = await getDinariEntity(id, env);
  } catch (error) {
    snapshot.errors.push(`entity: ${error?.message || 'Entity lookup failed'}`);
    return snapshot;
  }

  const results = await Promise.allSettled([getDinariKyc(id, env), listDinariAccounts(id, env)]);
  if (results[0].status === 'fulfilled') snapshot.kyc = results[0].value;
  else snapshot.errors.push(`kyc: ${results[0].reason?.message || 'KYC lookup failed'}`);
  if (results[1].status === 'fulfilled') snapshot.accounts = results[1].value;
  else snapshot.errors.push(`accounts: ${results[1].reason?.message || 'Account lookup failed'}`);

  return snapshot;
}

export async function createDinariSandboxEntity({ name, referenceId = '' } = {}, env = process.env) {
  const config = getDinariConfig(env);
  assertSandbox(config, 'Entity creation');
  if (!config.credentialsConfigured) throw new Error('Dinari sandbox credentials are not configured.');

  const safeName = clean(name);
  if (safeName.length < 2 || safeName.length > 120) throw new Error('Entity name must be between 2 and 120 characters.');
  const safeReference = clean(referenceId);
  if (safeReference && (!/^[A-Za-z0-9._:-]{3,100}$/.test(safeReference))) {
    throw new Error('Reference ID may use letters, numbers, dot, underscore, colon and dash only.');
  }

  const body = { name: safeName };
  if (safeReference) body.reference_id = safeReference;
  return safeEntity(await request('/entities/', { env, method: 'POST', body }));
}

export async function createDinariManagedKyc({ entity, jurisdiction = 'US' } = {}, env = process.env) {
  const config = getDinariConfig(env);
  assertSandbox(config, 'Managed KYC creation');
  const id = entityId(entity);
  const safeJurisdiction = jurisdiction === 'BASELINE' ? 'BASELINE' : 'US';
  const payload = await request(`/entities/${encodeURIComponent(id)}/kyc/url`, {
    env,
    method: 'POST',
    body: { jurisdiction: safeJurisdiction },
  });
  const embedUrl = clean(payload?.embed_url);
  if (!/^https:\/\//i.test(embedUrl)) throw new Error('Dinari did not return a valid managed KYC URL.');
  return {
    embedUrl,
    expirationDt: clean(payload?.expiration_dt),
    jurisdiction: safeJurisdiction,
  };
}

export async function createDinariSandboxAccount({ entity, jurisdiction = 'US' } = {}, env = process.env) {
  const config = getDinariConfig(env);
  assertSandbox(config, 'Account creation');
  const id = entityId(entity);
  const safeJurisdiction = jurisdiction === 'BASELINE' ? 'BASELINE' : 'US';

  const [entityState, kyc, accounts] = await Promise.all([
    getDinariEntity(id, env),
    getDinariKyc(id, env),
    listDinariAccounts(id, env),
  ]);

  if (!entityState.isKycComplete || kyc.status !== 'PASS') {
    throw new Error(`Dinari KYC must be PASS before creating an account. Current status: ${kyc.status || 'UNKNOWN'}.`);
  }

  const existing = accounts.find((account) => account.isActive && account.jurisdiction === safeJurisdiction);
  if (existing) return { account: existing, created: false };

  const created = await request(`/entities/${encodeURIComponent(id)}/accounts`, {
    env,
    method: 'POST',
    body: { jurisdiction: safeJurisdiction },
  });
  return { account: safeAccount(created), created: true };
}
