import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const SANDBOX_BASE_URL = 'https://api-enterprise.sandbox.dinari.com/api/v2';
const LIVE_BASE_URL = 'https://api-enterprise.sbt.dinari.com/api/v2';

// The live implementation is now present, but activation is still fail-closed. A live
// trade requires approved production credentials, a provider-verified US account/KYC,
// a Dinari-managed non-AML-flagged wallet, the approved disclosure/NBBO gates below,
// an owner-authenticated pre-trade confirmation, and a fresh signed quote token.
export const DINARI_LIVE_TRADING_IMPLEMENTATION_READY = true;
export const DINARI_LIVE_ORDER_MAX_USD = 700;
export const DINARI_LIVE_CONFIRMATION_TTL_MS = 18_000;
export const DINARI_LIVE_QUOTE_MAX_AGE_MS = 30_000;
export const DINARI_SANDBOX_ORDER_MAX_USD = 25;
export const DINARI_SANDBOX_FAUCET_AMOUNT = 1000;

const DEFAULT_REAL_ESTATE_SYMBOLS = Object.freeze([
  'VNQ',
  'SCHH',
  'XLRE',
  'REET',
  'O',
  'PLD',
  'AMT',
  'WELL',
]);

function clean(value) {
  return String(value || '').trim();
}

function bool(value) {
  return value === true || clean(value).toLowerCase() === 'true';
}

function configuredSymbols(env = {}) {
  const raw = clean(env.DINARI_REAL_ESTATE_SYMBOLS);
  if (!raw) return [...DEFAULT_REAL_ESTATE_SYMBOLS];
  return [...new Set(raw.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean))].slice(0, 100);
}

function liveConfigurationBlockers(config) {
  const blockers = [];
  if (config.environment !== 'live') blockers.push('DINARI_ENVIRONMENT must be live.');
  if (!config.credentialsConfigured) blockers.push('Live Dinari API key ID and secret are required.');
  if (!config.entityConfigured) blockers.push('DINARI_ENTITY_ID is required for live KYC/NBBO verification.');
  if (!config.accountConfigured) blockers.push('DINARI_ACCOUNT_ID is required for live trading.');
  if (!config.livePartnerApproved) blockers.push('DINARI_LIVE_PARTNER_APPROVED=true is required after Dinari production approval.');
  if (!config.liveManagedOrdersApproved) blockers.push('DINARI_LIVE_MANAGED_ORDERS_APPROVED=true is required for the approved managed-wallet flow.');
  if (!config.usDisclosuresApproved) blockers.push('DINARI_US_DISCLOSURES_APPROVED=true is required after compliance approves the disclosure screen.');
  if (!config.disclosureVersion) blockers.push('DINARI_US_DISCLOSURE_VERSION must identify the approved disclosure version.');
  if (!config.disclosurePageUrl) blockers.push('DINARI_US_DISCLOSURE_PAGE_URL must point to the approved disclosure screen.');
  if (!config.nbboApproved) blockers.push('DINARI_US_NBBO_APPROVED=true is required after the SIP/NBBO display is approved.');
  if (!config.confirmationSecretReady) blockers.push('DINARI_LIVE_CONFIRMATION_SECRET must be a server-only secret of at least 32 characters.');
  if (!config.productionTradingFlag) blockers.push('DINARI_PRODUCTION_TRADING_ENABLED=true is required for deliberate activation.');
  if (!DINARI_LIVE_TRADING_IMPLEMENTATION_READY) blockers.push('Live trading implementation is code-locked.');
  return blockers;
}

export function getDinariConfig(env = {}) {
  const requestedEnvironment = clean(env.DINARI_ENVIRONMENT).toLowerCase();
  const environment = requestedEnvironment === 'live' ? 'live' : 'sandbox';
  const apiKeyId = clean(env.DINARI_API_KEY_ID);
  const apiSecretKey = clean(env.DINARI_API_SECRET_KEY);
  const accountId = clean(env.DINARI_ACCOUNT_ID);
  const entityId = clean(env.DINARI_ENTITY_ID);
  const sandboxOrderFlag = bool(env.DINARI_SANDBOX_ORDER_EXECUTION_ENABLED);
  const sandboxFaucetFlag = bool(env.DINARI_SANDBOX_FAUCET_ENABLED);
  const productionTradingFlag = bool(env.DINARI_PRODUCTION_TRADING_ENABLED);
  const livePartnerApproved = bool(env.DINARI_LIVE_PARTNER_APPROVED);
  const liveManagedOrdersApproved = bool(env.DINARI_LIVE_MANAGED_ORDERS_APPROVED);
  const usDisclosuresApproved = bool(env.DINARI_US_DISCLOSURES_APPROVED);
  const nbboApproved = bool(env.DINARI_US_NBBO_APPROVED);
  const disclosureVersion = clean(env.DINARI_US_DISCLOSURE_VERSION);
  const rawDisclosureUrl = clean(env.DINARI_US_DISCLOSURE_PAGE_URL);
  const disclosurePageUrl = /^https:\/\//i.test(rawDisclosureUrl) ? rawDisclosureUrl : '';
  const confirmationSecret = clean(env.DINARI_LIVE_CONFIRMATION_SECRET);
  const confirmationSecretReady = confirmationSecret.length >= 32;
  const credentialsConfigured = Boolean(apiKeyId && apiSecretKey);
  const accountConfigured = Boolean(accountId);
  const entityConfigured = Boolean(entityId);
  const symbols = configuredSymbols(env);

  const config = {
    provider: 'Dinari',
    environment,
    baseUrl: environment === 'live' ? LIVE_BASE_URL : SANDBOX_BASE_URL,
    apiKeyId,
    apiSecretKey,
    accountId,
    entityId,
    credentialsConfigured,
    accountConfigured,
    entityConfigured,
    symbols,
    sandboxOrderFlag,
    sandboxFaucetFlag,
    productionTradingFlag,
    livePartnerApproved,
    liveManagedOrdersApproved,
    usDisclosuresApproved,
    nbboApproved,
    disclosureVersion,
    disclosurePageUrl,
    confirmationSecret,
    confirmationSecretReady,
    sandboxTradingEnabled: Boolean(environment === 'sandbox' && credentialsConfigured && accountConfigured && sandboxOrderFlag),
    sandboxFaucetEnabled: Boolean(environment === 'sandbox' && credentialsConfigured && accountConfigured && sandboxFaucetFlag),
    productionTradingEnabled: false,
    productionReadinessBlockers: [],
  };

  config.productionReadinessBlockers = liveConfigurationBlockers(config);
  config.productionTradingEnabled = config.productionReadinessBlockers.length === 0;
  return config;
}

function headers(config) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-API-Key-Id': config.apiKeyId,
    'X-API-Secret-Key': config.apiSecretKey,
  };
}

async function dinariRequest(path, { env = process.env, method = 'GET', body } = {}) {
  const config = getDinariConfig(env);
  if (!config.credentialsConfigured) {
    throw new Error('Dinari API credentials are not configured.');
  }

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
      const message = payload?.detail || payload?.message || payload?.error || `Dinari API request failed with HTTP ${response.status}.`;
      throw new Error(String(message));
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function resultItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function symbolQuery(symbols) {
  const params = new URLSearchParams();
  for (const symbol of symbols) params.append('symbols', symbol);
  params.set('limit', '100');
  return params.toString();
}

function normalizeStock(stock = {}) {
  return {
    id: clean(stock.id || stock.stock_id),
    symbol: clean(stock.symbol).toUpperCase(),
    name: clean(stock.display_name || stock.name || stock.company_name || stock.symbol),
    cusip: clean(stock.cusip),
    isFractionable: stock.is_fractionable ?? stock.fractionable ?? null,
    isTradable: stock.is_tradable ?? stock.tradable ?? null,
    rawType: clean(stock.type || stock.asset_type || stock.security_type),
  };
}

export async function listDigitalRealEstateAssets(env = process.env) {
  const config = getDinariConfig(env);
  if (!config.credentialsConfigured) return [];

  const payload = await dinariRequest(`/market_data/stocks/?${symbolQuery(config.symbols)}`, { env });
  const allowed = new Set(config.symbols);
  return resultItems(payload)
    .map(normalizeStock)
    .filter((asset) => asset.id && allowed.has(asset.symbol));
}

function normalizePortfolio(payload) {
  const assets = Array.isArray(payload?.assets) ? payload.assets : resultItems(payload);
  return assets.map((asset = {}) => ({
    stockId: clean(asset.stock_id || asset.stock?.id),
    symbol: clean(asset.symbol || asset.stock?.symbol).toUpperCase(),
    amount: Number(asset.amount || asset.quantity || asset.asset_quantity || 0),
    chainId: clean(asset.chain_id),
    tokenAddress: clean(asset.token_address),
  })).filter((asset) => asset.symbol || asset.stockId);
}

export async function getDigitalRealEstatePortfolio(env = process.env) {
  const config = getDinariConfig(env);
  if (!config.credentialsConfigured || !config.accountConfigured) return [];
  const payload = await dinariRequest(`/accounts/${encodeURIComponent(config.accountId)}/portfolio`, { env });
  const allowed = new Set(config.symbols);
  return normalizePortfolio(payload).filter((asset) => allowed.has(asset.symbol));
}

function normalizeCash(payload) {
  return resultItems(payload).map((balance = {}) => ({
    symbol: clean(balance.symbol).toUpperCase(),
    amount: Number(balance.amount || 0),
    chainId: clean(balance.chain_id),
    tokenAddress: clean(balance.token_address),
  })).filter((balance) => balance.symbol);
}

export async function getDigitalRealEstateCash(env = process.env) {
  const config = getDinariConfig(env);
  if (!config.credentialsConfigured || !config.accountConfigured) return [];
  const payload = await dinariRequest(`/accounts/${encodeURIComponent(config.accountId)}/cash`, { env });
  return normalizeCash(payload);
}

function normalizeDividendPayments(payload, stockById = new Map()) {
  return resultItems(payload).map((payment = {}) => {
    const stockId = clean(payment.stock_id || payment.stock?.id);
    const mapped = stockById.get(stockId);
    return {
      id: clean(payment.id || `${stockId}-${payment.payment_date || payment.payable_date || ''}`),
      stockId,
      symbol: clean(payment.symbol || payment.stock?.symbol || mapped?.symbol).toUpperCase(),
      amount: Number(payment.amount || payment.payment_amount || payment.cash_amount || 0),
      currency: clean(payment.currency || 'USD'),
      payableDate: clean(payment.payable_date || payment.payment_date || payment.created_at),
      status: clean(payment.status),
    };
  });
}

function dividendWindow(now = new Date()) {
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date(now);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  const isoDate = (date) => date.toISOString().slice(0, 10);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

export async function getDigitalRealEstateDividends(env = process.env, catalog = []) {
  const config = getDinariConfig(env);
  if (!config.credentialsConfigured || !config.accountConfigured || !catalog.length) return [];

  const stockById = new Map(catalog.map((asset) => [asset.id, asset]));
  const allowedStockIds = new Set(stockById.keys());
  const { startDate, endDate } = dividendWindow();
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    limit: '100',
    order: 'desc',
  });
  const payload = await dinariRequest(`/accounts/${encodeURIComponent(config.accountId)}/dividend_payments?${params.toString()}`, { env });
  return normalizeDividendPayments(payload, stockById).filter((payment) => allowedStockIds.has(payment.stockId));
}

function providerAccount(account = {}) {
  return {
    id: clean(account.id),
    entityId: clean(account.entity_id),
    isActive: account.is_active === true,
    jurisdiction: clean(account.jurisdiction).toUpperCase(),
  };
}

export async function inspectLiveDinariAccount(env = process.env) {
  const config = getDinariConfig(env);
  const blockers = [];
  if (config.environment !== 'live') blockers.push('Server is not configured for the Dinari live environment.');
  if (!config.credentialsConfigured) blockers.push('Live Dinari credentials are missing.');
  if (!config.entityConfigured) blockers.push('Live Dinari Entity ID is missing.');
  if (!config.accountConfigured) blockers.push('Live Dinari Account ID is missing.');

  const state = {
    checked: false,
    ready: false,
    kycComplete: false,
    kycStatus: '',
    accountActive: false,
    accountJurisdiction: '',
    managedWallet: false,
    amlFlagged: null,
    entitySuffix: config.entityId ? config.entityId.slice(-6) : '',
    accountSuffix: config.accountId ? config.accountId.slice(-6) : '',
    blockers,
  };

  if (blockers.length) return state;

  const [entity, kyc, accountsPayload, wallet] = await Promise.all([
    dinariRequest(`/entities/${encodeURIComponent(config.entityId)}`, { env }),
    dinariRequest(`/entities/${encodeURIComponent(config.entityId)}/kyc`, { env }),
    dinariRequest(`/entities/${encodeURIComponent(config.entityId)}/accounts?limit=100&order=desc`, { env }),
    dinariRequest(`/accounts/${encodeURIComponent(config.accountId)}/wallet`, { env }),
  ]);

  state.checked = true;
  state.kycComplete = entity?.is_kyc_complete === true;
  state.kycStatus = clean(kyc?.status).toUpperCase();
  const account = resultItems(accountsPayload).map(providerAccount).find((candidate) => candidate.id === config.accountId) || null;
  state.accountActive = account?.isActive === true;
  state.accountJurisdiction = account?.jurisdiction || '';
  state.managedWallet = wallet?.is_managed_wallet === true;
  state.amlFlagged = wallet?.is_aml_flagged === true;

  if (!state.kycComplete || state.kycStatus !== 'PASS') state.blockers.push(`Provider KYC must be PASS; current status is ${state.kycStatus || 'UNKNOWN'}.`);
  if (!account) state.blockers.push('Configured live account was not returned under the configured live Entity.');
  else {
    if (!state.accountActive) state.blockers.push('Configured live account is not active.');
    if (state.accountJurisdiction !== 'US') state.blockers.push(`Configured live account jurisdiction must be US; provider returned ${state.accountJurisdiction || 'UNKNOWN'}.`);
  }
  if (!state.managedWallet) state.blockers.push('Configured live account does not have a Dinari-managed wallet; this live managed-order path will not sign for an external wallet.');
  if (state.amlFlagged === true) state.blockers.push('Provider reports the configured wallet as AML flagged.');
  state.ready = state.blockers.length === 0;
  return state;
}

export async function verifyLiveDinariAccount(env = process.env) {
  const config = getDinariConfig(env);
  if (!config.productionTradingEnabled) {
    throw new Error(`Live Dinari trading is locked: ${config.productionReadinessBlockers.join(' ') || 'production activation is incomplete.'}`);
  }
  const state = await inspectLiveDinariAccount(env);
  if (!state.ready) throw new Error(`Live Dinari account verification failed: ${state.blockers.join(' ')}`);
  return state;
}

async function resolveLiveRealEstateAsset(stockId, env = process.env) {
  const id = clean(stockId);
  if (!id) throw new Error('A Dinari stock_id is required.');
  const catalog = await listDigitalRealEstateAssets(env);
  const asset = catalog.find((candidate) => candidate.id === id);
  if (!asset) throw new Error('That stock is not in the configured provider-confirmed real-estate universe.');
  if (asset.isTradable === false) throw new Error(`${asset.symbol} is not currently tradable according to the provider.`);
  if (asset.isFractionable === false) throw new Error(`${asset.symbol} is not fractionable; Voxel Vault live market buys require a fractionable security.`);
  return asset;
}

function normalizeLiveQuote(payload = {}, asset = {}) {
  const bid = Number(payload.bid_price ?? payload.bid ?? 0);
  const offer = Number(payload.ask_price ?? payload.offer_price ?? payload.ask ?? payload.offer ?? 0);
  const bidSize = Number(payload.bid_size ?? payload.bid_volume ?? 0);
  const offerSize = Number(payload.ask_size ?? payload.offer_size ?? payload.ask_volume ?? 0);
  const bidExchange = clean(payload.bid_exchange || payload.bid_exchange_code || payload.bid_market_center || payload.bid_exchange_name);
  const offerExchange = clean(payload.ask_exchange || payload.offer_exchange || payload.ask_exchange_code || payload.offer_exchange_code || payload.ask_market_center || payload.offer_market_center);
  const timestamp = clean(payload.timestamp || payload.quote_timestamp || payload.generated_at);
  return {
    stockId: clean(payload.stock_id || asset.id),
    symbol: clean(payload.symbol || asset.symbol).toUpperCase(),
    bid,
    bidSize,
    bidExchange,
    offer,
    offerSize,
    offerExchange,
    timestamp,
  };
}

function assertFreshUsQuote(quote) {
  if (!quote.stockId || !quote.symbol) throw new Error('Provider quote is missing stock identity.');
  if (!Number.isFinite(quote.bid) || quote.bid <= 0 || !Number.isFinite(quote.offer) || quote.offer <= 0) {
    throw new Error('Provider did not return a usable NBBO bid and offer.');
  }
  if (!Number.isFinite(quote.bidSize) || quote.bidSize < 0 || !Number.isFinite(quote.offerSize) || quote.offerSize < 0) {
    throw new Error('Provider returned invalid NBBO sizes.');
  }
  if (!quote.bidExchange || !quote.offerExchange) {
    throw new Error('Provider quote is missing the bid/offer exchange fields required for the U.S. pre-trade screen.');
  }
  const generated = Date.parse(quote.timestamp);
  if (!Number.isFinite(generated)) throw new Error('Provider quote timestamp is invalid.');
  const age = Date.now() - generated;
  if (age < -5_000 || age > DINARI_LIVE_QUOTE_MAX_AGE_MS) {
    throw new Error('Provider NBBO quote is stale. Refresh the pre-trade confirmation before trading.');
  }
}

export async function getLiveRealEstateQuote({ stockId } = {}, env = process.env) {
  const config = getDinariConfig(env);
  if (!config.productionTradingEnabled) {
    throw new Error(`Live quote is locked: ${config.productionReadinessBlockers.join(' ') || 'production activation is incomplete.'}`);
  }
  const asset = await resolveLiveRealEstateAsset(stockId, env);
  const params = new URLSearchParams({ feed: 'sip', entity_id: config.entityId });
  const payload = await dinariRequest(`/market_data/stocks/${encodeURIComponent(asset.id)}/current_quote?${params.toString()}`, { env });
  const quote = normalizeLiveQuote(payload, asset);
  assertFreshUsQuote(quote);
  return quote;
}

function normalizeLiveAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 1 || amount > DINARI_LIVE_ORDER_MAX_USD) {
    throw new Error(`Live market buy must be between $1 and $${DINARI_LIVE_ORDER_MAX_USD}.`);
  }
  return Number(amount.toFixed(2));
}

function b64url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function signConfirmation(encodedPayload, secret) {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function quoteDigest(quote) {
  return createHash('sha256').update(JSON.stringify({
    stockId: quote.stockId,
    symbol: quote.symbol,
    bid: quote.bid,
    bidSize: quote.bidSize,
    bidExchange: quote.bidExchange,
    offer: quote.offer,
    offerSize: quote.offerSize,
    offerExchange: quote.offerExchange,
    timestamp: quote.timestamp,
  })).digest('hex');
}

export async function createLivePreTradeConfirmation({ userId, stockId, paymentAmount } = {}, env = process.env) {
  const config = getDinariConfig(env);
  const uid = clean(userId);
  if (!uid) throw new Error('An authenticated Voxel Vault user is required.');
  const amount = normalizeLiveAmount(paymentAmount);
  await verifyLiveDinariAccount(env);
  const quote = await getLiveRealEstateQuote({ stockId }, env);

  const issuedAt = Date.now();
  const expiresAt = issuedAt + DINARI_LIVE_CONFIRMATION_TTL_MS;
  const confirmationId = randomBytes(12).toString('hex');
  const payload = {
    v: 1,
    confirmationId,
    userId: uid,
    environment: 'live',
    accountHash: createHash('sha256').update(config.accountId).digest('hex'),
    stockId: quote.stockId,
    symbol: quote.symbol,
    paymentAmount: amount,
    quoteTimestamp: quote.timestamp,
    quoteDigest: quoteDigest(quote),
    disclosureVersion: config.disclosureVersion,
    issuedAt,
    expiresAt,
  };
  const encoded = b64url(JSON.stringify(payload));
  const signature = signConfirmation(encoded, config.confirmationSecret);

  return {
    confirmationToken: `${encoded}.${signature}`,
    confirmationId,
    paymentAmount: amount,
    quote,
    disclosureVersion: config.disclosureVersion,
    disclosurePageUrl: config.disclosurePageUrl,
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

function verifyLiveConfirmationToken(token, userId, env = process.env) {
  const config = getDinariConfig(env);
  const uid = clean(userId);
  const raw = clean(token);
  const [encoded, signature, extra] = raw.split('.');
  if (!encoded || !signature || extra) throw new Error('Live confirmation token is malformed.');
  if (!config.confirmationSecretReady) throw new Error('Live confirmation signing secret is unavailable.');
  const expected = signConfirmation(encoded, config.confirmationSecret);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error('Live confirmation signature is invalid.');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Live confirmation payload is invalid.');
  }

  if (payload?.v !== 1 || payload?.environment !== 'live') throw new Error('Live confirmation version/environment is invalid.');
  if (!uid || payload.userId !== uid) throw new Error('Live confirmation belongs to a different Voxel Vault user.');
  if (payload.accountHash !== createHash('sha256').update(config.accountId).digest('hex')) throw new Error('Live confirmation belongs to a different provider account.');
  if (payload.disclosureVersion !== config.disclosureVersion) throw new Error('Approved disclosure version changed; review a new confirmation.');
  if (!Number.isFinite(payload.expiresAt) || Date.now() > payload.expiresAt) throw new Error('Live pre-trade confirmation expired. Refresh the NBBO quote.');
  normalizeLiveAmount(payload.paymentAmount);
  return payload;
}

export async function createLiveMarketBuy({ userId, confirmationToken } = {}, env = process.env) {
  const config = getDinariConfig(env);
  if (!config.productionTradingEnabled) {
    throw new Error(`Live trading is locked: ${config.productionReadinessBlockers.join(' ') || 'production activation is incomplete.'}`);
  }
  const payload = verifyLiveConfirmationToken(confirmationToken, userId, env);
  await verifyLiveDinariAccount(env);
  const asset = await resolveLiveRealEstateAsset(payload.stockId, env);
  if (asset.symbol !== payload.symbol) throw new Error('Provider symbol changed since confirmation; refresh before trading.');

  const order = await dinariRequest(`/accounts/${encodeURIComponent(config.accountId)}/order_requests/market_buy`, {
    env,
    method: 'POST',
    body: {
      stock_id: asset.id,
      payment_amount: Number(payload.paymentAmount.toFixed(2)),
      client_order_id: `vv-live-${payload.confirmationId}`,
    },
  });

  return {
    order,
    confirmationId: payload.confirmationId,
    symbol: payload.symbol,
    paymentAmount: payload.paymentAmount,
    quoteTimestamp: payload.quoteTimestamp,
    realMoney: true,
    environment: 'live',
  };
}

export async function getDigitalReitSnapshot(env = process.env) {
  const config = getDinariConfig(env);
  const snapshot = {
    provider: config.provider,
    environment: config.environment,
    credentialsConfigured: config.credentialsConfigured,
    accountConfigured: config.accountConfigured,
    entityConfigured: config.entityConfigured,
    sandboxTradingEnabled: config.sandboxTradingEnabled,
    sandboxFaucetEnabled: config.sandboxFaucetEnabled,
    productionTradingEnabled: config.productionTradingEnabled,
    productionTradingImplementationReady: DINARI_LIVE_TRADING_IMPLEMENTATION_READY,
    productionReadinessBlockers: [...config.productionReadinessBlockers],
    disclosurePageUrl: config.disclosurePageUrl,
    disclosureVersion: config.disclosureVersion,
    liveOrderMaxUsd: DINARI_LIVE_ORDER_MAX_USD,
    symbols: config.symbols,
    catalog: [],
    portfolio: [],
    cash: [],
    dividends: [],
    errors: [],
  };

  if (!config.credentialsConfigured) return snapshot;

  try {
    snapshot.catalog = await listDigitalRealEstateAssets(env);
  } catch (error) {
    snapshot.errors.push(`catalog: ${error?.message || 'provider request failed'}`);
  }

  const results = await Promise.allSettled([
    getDigitalRealEstatePortfolio(env),
    getDigitalRealEstateCash(env),
    getDigitalRealEstateDividends(env, snapshot.catalog),
  ]);

  const keys = ['portfolio', 'cash', 'dividends'];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') snapshot[keys[index]] = result.value;
    else snapshot.errors.push(`${keys[index]}: ${result.reason?.message || 'provider request failed'}`);
  });

  return snapshot;
}

export async function mintSandboxFunds(env = process.env) {
  const config = getDinariConfig(env);
  if (config.environment !== 'sandbox') throw new Error('Sandbox faucet refuses non-sandbox Dinari environments.');
  if (!config.sandboxFaucetEnabled) throw new Error('Dinari sandbox faucet is not enabled.');

  await dinariRequest(`/accounts/${encodeURIComponent(config.accountId)}/faucet`, {
    env,
    method: 'POST',
    body: { chain_id: 'eip155:42161' },
  });

  return {
    minted: true,
    amount: DINARI_SANDBOX_FAUCET_AMOUNT,
    symbol: 'mockUSD',
    chainId: 'eip155:42161',
    realMoney: false,
  };
}

export async function createSandboxMarketBuy({ stockId, paymentAmount }, env = process.env) {
  const config = getDinariConfig(env);
  if (config.environment !== 'sandbox') throw new Error('Sandbox order endpoint refuses non-sandbox Dinari environments.');
  if (!config.sandboxTradingEnabled) throw new Error('Dinari sandbox trading is not enabled.');

  const amount = Number(paymentAmount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > DINARI_SANDBOX_ORDER_MAX_USD) {
    throw new Error(`Sandbox market buy must be greater than $0 and no more than $${DINARI_SANDBOX_ORDER_MAX_USD}.`);
  }

  const stock = clean(stockId);
  if (!stock) throw new Error('A Dinari stock_id is required.');

  return dinariRequest(`/accounts/${encodeURIComponent(config.accountId)}/order_requests/market_buy`, {
    env,
    method: 'POST',
    body: {
      stock_id: stock,
      payment_amount: Number(amount.toFixed(2)),
      client_order_id: `voxel-reit-sandbox-${Date.now()}`,
    },
  });
}
