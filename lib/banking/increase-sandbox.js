export const INCREASE_SANDBOX_BASE_URL = 'https://sandbox.increase.com';
export const INCREASE_SANDBOX_PROVIDER = 'Increase';

function truthy(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

export function getIncreaseSandboxConfig(env = process.env) {
  const apiKey = String(env.INCREASE_SANDBOX_API_KEY || '').trim();
  return {
    provider: INCREASE_SANDBOX_PROVIDER,
    environment: 'sandbox',
    baseUrl: INCREASE_SANDBOX_BASE_URL,
    enabled: truthy(env.GALACTIC_INCREASE_SANDBOX_ENABLED),
    credentialsConfigured: Boolean(apiKey),
    apiKey,
    canMoveRealMoney: false,
    productionSupported: false,
  };
}

function safePath(path) {
  const value = String(path || '').trim();
  if (!value.startsWith('/') || value.includes('..')) {
    throw new Error('Increase sandbox request path is invalid.');
  }
  const url = new URL(value, `${INCREASE_SANDBOX_BASE_URL}/`);
  if (url.origin !== new URL(INCREASE_SANDBOX_BASE_URL).origin) {
    throw new Error('Increase sandbox requests must stay on the sandbox origin.');
  }
  return url;
}

export async function increaseSandboxRequest(path, options = {}, env = process.env) {
  const config = getIncreaseSandboxConfig(env);
  if (!config.enabled) throw new Error('Increase sandbox is disabled. Set GALACTIC_INCREASE_SANDBOX_ENABLED=true only after a sandbox key is configured.');
  if (!config.credentialsConfigured) throw new Error('Increase sandbox credentials are not configured. Add INCREASE_SANDBOX_API_KEY to the server environment.');

  const method = String(options.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PATCH'].includes(method)) throw new Error('Increase sandbox request method is not allowed.');

  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    Accept: 'application/json',
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = String(options.idempotencyKey);

  const response = await fetch(safePath(path), {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
    signal: options.signal,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Increase sandbox request failed with status ${response.status}.`);
    error.status = response.status;
    error.providerType = typeof payload?.type === 'string' ? payload.type : '';
    throw error;
  }
  return payload;
}

function countPage(payload) {
  return Array.isArray(payload?.data) ? payload.data.length : 0;
}

export async function inspectIncreaseSandbox(env = process.env) {
  const config = getIncreaseSandboxConfig(env);
  if (!config.enabled || !config.credentialsConfigured) {
    return {
      provider: config.provider,
      environment: config.environment,
      enabled: config.enabled,
      credentialsConfigured: config.credentialsConfigured,
      connected: false,
      canMoveRealMoney: false,
      productionSupported: false,
      counts: { programs: 0, accounts: 0, entities: 0 },
    };
  }

  const [programs, accounts, entities] = await Promise.all([
    increaseSandboxRequest('/programs?limit=20', {}, env),
    increaseSandboxRequest('/accounts?limit=20', {}, env),
    increaseSandboxRequest('/entities?limit=20', {}, env),
  ]);

  return {
    provider: config.provider,
    environment: config.environment,
    enabled: true,
    credentialsConfigured: true,
    connected: true,
    canMoveRealMoney: false,
    productionSupported: false,
    counts: {
      programs: countPage(programs),
      accounts: countPage(accounts),
      entities: countPage(entities),
    },
    moreAvailable: {
      programs: Boolean(programs?.next_cursor),
      accounts: Boolean(accounts?.next_cursor),
      entities: Boolean(entities?.next_cursor),
    },
  };
}
