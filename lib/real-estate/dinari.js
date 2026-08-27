const SANDBOX_BASE_URL = 'https://api-enterprise.sandbox.dinari.com/api/v2';
const LIVE_BASE_URL = 'https://api-enterprise.sbt.dinari.com/api/v2';

export const DINARI_LIVE_TRADING_IMPLEMENTATION_READY = false;
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

function configuredSymbols(env = {}) {
  const raw = clean(env.DINARI_REAL_ESTATE_SYMBOLS);
  if (!raw) return [...DEFAULT_REAL_ESTATE_SYMBOLS];
  return [...new Set(raw.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean))].slice(0, 100);
}

export function getDinariConfig(env = {}) {
  const requestedEnvironment = clean(env.DINARI_ENVIRONMENT).toLowerCase();
  const environment = requestedEnvironment === 'live' ? 'live' : 'sandbox';
  const apiKeyId = clean(env.DINARI_API_KEY_ID);
  const apiSecretKey = clean(env.DINARI_API_SECRET_KEY);
  const accountId = clean(env.DINARI_ACCOUNT_ID);
  const entityId = clean(env.DINARI_ENTITY_ID);
  const sandboxOrderFlag = env.DINARI_SANDBOX_ORDER_EXECUTION_ENABLED === 'true';
  const sandboxFaucetFlag = env.DINARI_SANDBOX_FAUCET_ENABLED === 'true';
  const productionTradingFlag = env.DINARI_PRODUCTION_TRADING_ENABLED === 'true';
  const credentialsConfigured = Boolean(apiKeyId && apiSecretKey);
  const accountConfigured = Boolean(accountId);
  const symbols = configuredSymbols(env);

  return {
    provider: 'Dinari',
    environment,
    baseUrl: environment === 'live' ? LIVE_BASE_URL : SANDBOX_BASE_URL,
    apiKeyId,
    apiSecretKey,
    accountId,
    entityId,
    credentialsConfigured,
    accountConfigured,
    symbols,
    sandboxOrderFlag,
    sandboxFaucetFlag,
    sandboxTradingEnabled: Boolean(environment === 'sandbox' && credentialsConfigured && accountConfigured && sandboxOrderFlag),
    sandboxFaucetEnabled: Boolean(environment === 'sandbox' && credentialsConfigured && accountConfigured && sandboxFaucetFlag),
    productionTradingEnabled: Boolean(
      environment === 'live' &&
      credentialsConfigured &&
      accountConfigured &&
      productionTradingFlag &&
      DINARI_LIVE_TRADING_IMPLEMENTATION_READY
    ),
  };
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
    name: clean(stock.name || stock.display_name || stock.company_name || stock.symbol),
    cusip: clean(stock.cusip),
    isFractionable: stock.is_fractionable ?? stock.fractionable ?? null,
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

export async function getDigitalReitSnapshot(env = process.env) {
  const config = getDinariConfig(env);
  const snapshot = {
    provider: config.provider,
    environment: config.environment,
    credentialsConfigured: config.credentialsConfigured,
    accountConfigured: config.accountConfigured,
    sandboxTradingEnabled: config.sandboxTradingEnabled,
    sandboxFaucetEnabled: config.sandboxFaucetEnabled,
    productionTradingEnabled: config.productionTradingEnabled,
    productionTradingImplementationReady: DINARI_LIVE_TRADING_IMPLEMENTATION_READY,
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
