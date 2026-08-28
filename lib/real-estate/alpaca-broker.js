const SANDBOX_BROKER_BASE_URL = 'https://broker-api.sandbox.alpaca.markets';
const LIVE_BROKER_BASE_URL = 'https://broker-api.alpaca.markets';
const SANDBOX_AUTH_BASE_URL = 'https://authx.sandbox.alpaca.markets';
const LIVE_AUTH_BASE_URL = 'https://authx.alpaca.markets';

export const ALPACA_LIVE_IMPLEMENTATION_READY = false;
export const ALPACA_SANDBOX_TRADING_IMPLEMENTATION_READY = false;

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function clean(value) {
  return String(value || '').trim();
}

export function getAlpacaBrokerConfig(env = {}) {
  const requestedEnvironment = clean(env.ALPACA_BROKER_ENVIRONMENT).toLowerCase();
  const environment = requestedEnvironment === 'live' ? 'live' : 'sandbox';
  const apiKeyId = clean(env.ALPACA_BROKER_API_KEY_ID);
  const apiSecretKey = clean(env.ALPACA_BROKER_API_SECRET_KEY);
  const clientId = clean(env.ALPACA_BROKER_CLIENT_ID);
  const clientSecret = clean(env.ALPACA_BROKER_CLIENT_SECRET);
  const accountId = clean(env.ALPACA_BROKER_ACCOUNT_ID);
  const legacyCredentialsConfigured = Boolean(apiKeyId && apiSecretKey);
  const clientCredentialsConfigured = Boolean(clientId && clientSecret);
  const credentialsConfigured = legacyCredentialsConfigured || clientCredentialsConfigured;

  return {
    provider: 'Alpaca Broker API',
    environment,
    brokerBaseUrl: environment === 'live' ? LIVE_BROKER_BASE_URL : SANDBOX_BROKER_BASE_URL,
    authBaseUrl: environment === 'live' ? LIVE_AUTH_BASE_URL : SANDBOX_AUTH_BASE_URL,
    apiKeyId,
    apiSecretKey,
    clientId,
    clientSecret,
    accountId,
    legacyCredentialsConfigured,
    clientCredentialsConfigured,
    credentialsConfigured,
    accountConfigured: Boolean(accountId),
    liveImplementationReady: ALPACA_LIVE_IMPLEMENTATION_READY,
    sandboxTradingImplementationReady: ALPACA_SANDBOX_TRADING_IMPLEMENTATION_READY,
  };
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function errorMessage(payload, status) {
  return clean(payload?.message || payload?.error || payload?.detail || payload?.code) || `Alpaca Broker API request failed with HTTP ${status}.`;
}

async function getClientAccessToken(config) {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessTokenExpiresAt > now + 30_000) return cachedAccessToken;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${config.authBaseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await parseResponse(response);
    if (!response.ok || !clean(payload?.access_token)) {
      throw new Error(errorMessage(payload, response.status));
    }
    const expiresIn = Math.max(Number(payload?.expires_in || 899), 60);
    cachedAccessToken = clean(payload.access_token);
    cachedAccessTokenExpiresAt = now + expiresIn * 1000;
    return cachedAccessToken;
  } finally {
    clearTimeout(timeout);
  }
}

async function authorizationHeaders(config) {
  if (config.clientCredentialsConfigured) {
    const token = await getClientAccessToken(config);
    return { Authorization: `Bearer ${token}` };
  }
  if (config.legacyCredentialsConfigured) {
    const encoded = Buffer.from(`${config.apiKeyId}:${config.apiSecretKey}`, 'utf8').toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }
  throw new Error('Alpaca Broker API credentials are not configured.');
}

async function alpacaRequest(path, { env = process.env } = {}) {
  const config = getAlpacaBrokerConfig(env);
  if (!config.credentialsConfigured) throw new Error('Alpaca Broker API credentials are not configured.');
  if (config.environment !== 'sandbox' && !ALPACA_LIVE_IMPLEMENTATION_READY) {
    throw new Error('Alpaca live Broker API access is intentionally disabled in Voxel Vault. Use sandbox.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const auth = await authorizationHeaders(config);
    const response = await fetch(`${config.brokerBaseUrl}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json', ...auth },
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await parseResponse(response);
    if (!response.ok) throw new Error(errorMessage(payload, response.status));
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAccount(account = {}) {
  const kycResults = account?.kyc_results && typeof account.kyc_results === 'object'
    ? Object.fromEntries(Object.entries(account.kyc_results).map(([key, value]) => [key, clean(value)]).filter(([, value]) => value))
    : null;

  return {
    id: clean(account.id),
    accountNumber: clean(account.account_number),
    status: clean(account.status).toUpperCase(),
    accountType: clean(account.account_type),
    cryptoStatus: clean(account.crypto_status).toUpperCase(),
    tradingBlocked: account.trading_blocked === true,
    accountBlocked: account.account_blocked === true,
    kycResults,
    createdAt: clean(account.created_at),
  };
}

function normalizeAchRelationship(item = {}) {
  return {
    id: clean(item.id),
    status: clean(item.status).toUpperCase(),
    accountOwnerNamePresent: Boolean(clean(item.account_owner_name)),
    bankAccountType: clean(item.bank_account_type).toUpperCase(),
    nickname: clean(item.nickname),
    createdAt: clean(item.created_at),
    updatedAt: clean(item.updated_at),
  };
}

function normalizeTransfer(item = {}) {
  return {
    id: clean(item.id),
    relationshipId: clean(item.relationship_id),
    type: clean(item.type).toLowerCase(),
    status: clean(item.status).toUpperCase(),
    currency: clean(item.currency).toUpperCase(),
    amount: Number(item.amount || 0),
    instantAmount: Number(item.instant_amount || 0),
    requestedAmount: Number(item.requested_amount || item.amount || 0),
    fee: Number(item.fee || 0),
    direction: clean(item.direction).toUpperCase(),
    expiresAt: clean(item.expires_at),
    holdUntil: clean(item.hold_until),
    reason: clean(item.reason),
    createdAt: clean(item.created_at),
    updatedAt: clean(item.updated_at),
  };
}

export async function getAlpacaAccount(env = process.env) {
  const config = getAlpacaBrokerConfig(env);
  if (!config.credentialsConfigured || !config.accountConfigured) return null;
  const payload = await alpacaRequest(`/v1/accounts/${encodeURIComponent(config.accountId)}`, { env });
  return normalizeAccount(payload || {});
}

export async function getAlpacaAchRelationships(env = process.env) {
  const config = getAlpacaBrokerConfig(env);
  if (!config.credentialsConfigured || !config.accountConfigured) return [];
  const payload = await alpacaRequest(`/v1/accounts/${encodeURIComponent(config.accountId)}/ach_relationships`, { env });
  return (Array.isArray(payload) ? payload : []).map(normalizeAchRelationship).filter((item) => item.id);
}

export async function getAlpacaTransfers(env = process.env) {
  const config = getAlpacaBrokerConfig(env);
  if (!config.credentialsConfigured || !config.accountConfigured) return [];
  const payload = await alpacaRequest(`/v1/accounts/${encodeURIComponent(config.accountId)}/transfers?limit=20&offset=0`, { env });
  return (Array.isArray(payload) ? payload : []).map(normalizeTransfer).filter((item) => item.id);
}

function newestTransfer(transfers) {
  return [...transfers].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
}

export async function getAlpacaSandboxReadiness(env = process.env) {
  const config = getAlpacaBrokerConfig(env);
  const snapshot = {
    provider: config.provider,
    environment: config.environment,
    credentialsConfigured: config.credentialsConfigured,
    accountConfigured: config.accountConfigured,
    authenticationMode: config.clientCredentialsConfigured ? 'client_credentials' : config.legacyCredentialsConfigured ? 'legacy_basic' : 'none',
    liveImplementationReady: ALPACA_LIVE_IMPLEMENTATION_READY,
    sandboxTradingImplementationReady: ALPACA_SANDBOX_TRADING_IMPLEMENTATION_READY,
    account: null,
    achRelationships: [],
    transfers: [],
    readiness: {
      accountActive: false,
      accountUnblocked: false,
      approvedAchRelationship: false,
      incomingTransferComplete: false,
      providerReadReady: false,
      sandboxOrderReady: false,
    },
    errors: [],
  };

  if (!config.credentialsConfigured || !config.accountConfigured) return snapshot;

  const results = await Promise.allSettled([
    getAlpacaAccount(env),
    getAlpacaAchRelationships(env),
    getAlpacaTransfers(env),
  ]);

  if (results[0].status === 'fulfilled') snapshot.account = results[0].value;
  else snapshot.errors.push(`account: ${results[0].reason?.message || 'provider request failed'}`);
  if (results[1].status === 'fulfilled') snapshot.achRelationships = results[1].value;
  else snapshot.errors.push(`ach: ${results[1].reason?.message || 'provider request failed'}`);
  if (results[2].status === 'fulfilled') snapshot.transfers = results[2].value;
  else snapshot.errors.push(`transfers: ${results[2].reason?.message || 'provider request failed'}`);

  const accountActive = snapshot.account?.status === 'ACTIVE';
  const accountUnblocked = Boolean(snapshot.account && !snapshot.account.accountBlocked && !snapshot.account.tradingBlocked);
  const approvedAchRelationship = snapshot.achRelationships.some((item) => item.status === 'APPROVED');
  const incomingTransferComplete = snapshot.transfers.some((item) => item.direction === 'INCOMING' && item.status === 'COMPLETE' && item.amount > 0);
  const latestTransfer = newestTransfer(snapshot.transfers);

  snapshot.readiness = {
    accountActive,
    accountUnblocked,
    approvedAchRelationship,
    incomingTransferComplete,
    providerReadReady: Boolean(accountActive && accountUnblocked && !snapshot.errors.length),
    sandboxOrderReady: Boolean(
      config.environment === 'sandbox' &&
      accountActive &&
      accountUnblocked &&
      incomingTransferComplete &&
      ALPACA_SANDBOX_TRADING_IMPLEMENTATION_READY
    ),
    latestTransferStatus: latestTransfer?.status || '',
  };

  return snapshot;
}
