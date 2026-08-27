import assert from 'node:assert/strict';
import {
  DINARI_LIVE_TRADING_IMPLEMENTATION_READY,
  DINARI_SANDBOX_ORDER_MAX_USD,
  createSandboxMarketBuy,
  getDinariConfig,
  listDigitalRealEstateAssets,
} from '../lib/real-estate/dinari.js';

assert.equal(DINARI_LIVE_TRADING_IMPLEMENTATION_READY, false, 'production trading must remain code-locked');
assert.equal(DINARI_SANDBOX_ORDER_MAX_USD, 25, 'sandbox order cap changed unexpectedly');

const live = getDinariConfig({
  DINARI_ENVIRONMENT: 'live',
  DINARI_API_KEY_ID: 'test-key',
  DINARI_API_SECRET_KEY: 'test-secret',
  DINARI_ACCOUNT_ID: 'account-test',
  DINARI_PRODUCTION_TRADING_ENABLED: 'true',
});
assert.equal(live.environment, 'live');
assert.equal(live.productionTradingEnabled, false, 'environment variables must not unlock production trading');
assert.equal(live.sandboxTradingEnabled, false, 'live environment cannot use sandbox trading path');

const sandboxLocked = getDinariConfig({
  DINARI_ENVIRONMENT: 'sandbox',
  DINARI_API_KEY_ID: 'test-key',
  DINARI_API_SECRET_KEY: 'test-secret',
  DINARI_ACCOUNT_ID: 'account-test',
});
assert.equal(sandboxLocked.sandboxTradingEnabled, false, 'sandbox trading requires explicit enable flag');
assert.ok(sandboxLocked.symbols.includes('VNQ'), 'default real-estate watchlist should include VNQ');

const originalFetch = global.fetch;
const calls = [];
global.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (String(url).includes('/market_data/stocks/')) {
    return new Response(JSON.stringify({ data: [
      { id: 'stock-vnq', symbol: 'VNQ', name: 'Example REIT ETF', is_fractionable: true },
      { id: 'stock-aapl', symbol: 'AAPL', name: 'Not real estate' },
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (String(url).includes('/order_requests/market_buy')) {
    return new Response(JSON.stringify({ id: 'sandbox-order-1', status: 'PENDING' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error(`Unexpected fetch: ${url}`);
};

try {
  const env = {
    DINARI_ENVIRONMENT: 'sandbox',
    DINARI_API_KEY_ID: 'test-key',
    DINARI_API_SECRET_KEY: 'test-secret',
    DINARI_ACCOUNT_ID: 'account-test',
    DINARI_SANDBOX_ORDER_EXECUTION_ENABLED: 'true',
    DINARI_REAL_ESTATE_SYMBOLS: 'VNQ,SCHH',
  };

  const assets = await listDigitalRealEstateAssets(env);
  assert.equal(assets.length, 1, 'provider assets outside configured real-estate symbols must be filtered out');
  assert.equal(assets[0].symbol, 'VNQ');
  assert.ok(calls[0].url.startsWith('https://api-enterprise.sandbox.dinari.com/api/v2/'), 'sandbox adapter must use sandbox base URL');
  assert.equal(calls[0].options.headers['X-API-Key-Id'], 'test-key', 'provider auth header missing');

  const order = await createSandboxMarketBuy({ stockId: 'stock-vnq', paymentAmount: 5 }, env);
  assert.equal(order.id, 'sandbox-order-1');
  const orderCall = calls.find((call) => call.url.includes('/order_requests/market_buy'));
  assert.ok(orderCall, 'sandbox market buy endpoint was not called');
  assert.equal(orderCall.options.method, 'POST');
  const orderBody = JSON.parse(orderCall.options.body);
  assert.equal(orderBody.stock_id, 'stock-vnq');
  assert.equal(orderBody.payment_amount, 5);

  await assert.rejects(
    () => createSandboxMarketBuy({ stockId: 'stock-vnq', paymentAmount: 25.01 }, env),
    /no more than \$25/,
    'sandbox orders above the cap must fail closed',
  );

  await assert.rejects(
    () => createSandboxMarketBuy({ stockId: 'stock-vnq', paymentAmount: 5 }, { ...env, DINARI_ENVIRONMENT: 'live' }),
    /refuses non-sandbox/,
    'sandbox order function must refuse live environment',
  );
} finally {
  global.fetch = originalFetch;
}

console.log('Digital REIT safety checks passed: provider catalog filtering works, secrets stay server-side, sandbox orders are capped and explicitly enabled, and production trading remains code-locked.');
