import assert from 'node:assert/strict';
import {
  DINARI_LIVE_TRADING_IMPLEMENTATION_READY,
  DINARI_SANDBOX_FAUCET_AMOUNT,
  DINARI_SANDBOX_ORDER_MAX_USD,
  createSandboxMarketBuy,
  getDigitalRealEstateCash,
  getDigitalRealEstateDividends,
  getDinariConfig,
  listDigitalRealEstateAssets,
  mintSandboxFunds,
} from '../lib/real-estate/dinari.js';
import { reconcileDigitalReitPosition } from '../lib/real-estate/reconciliation.js';

assert.equal(DINARI_LIVE_TRADING_IMPLEMENTATION_READY, false, 'production trading must remain code-locked');
assert.equal(DINARI_SANDBOX_ORDER_MAX_USD, 25, 'sandbox order cap changed unexpectedly');
assert.equal(DINARI_SANDBOX_FAUCET_AMOUNT, 1000, 'sandbox faucet amount changed unexpectedly');

const live = getDinariConfig({
  DINARI_ENVIRONMENT: 'live',
  DINARI_API_KEY_ID: 'test-key',
  DINARI_API_SECRET_KEY: 'test-secret',
  DINARI_ACCOUNT_ID: 'account-test',
  DINARI_PRODUCTION_TRADING_ENABLED: 'true',
  DINARI_SANDBOX_FAUCET_ENABLED: 'true',
});
assert.equal(live.environment, 'live');
assert.equal(live.productionTradingEnabled, false, 'environment variables must not unlock production trading');
assert.equal(live.sandboxTradingEnabled, false, 'live environment cannot use sandbox trading path');
assert.equal(live.sandboxFaucetEnabled, false, 'live environment cannot use sandbox faucet path');

const sandboxLocked = getDinariConfig({
  DINARI_ENVIRONMENT: 'sandbox',
  DINARI_API_KEY_ID: 'test-key',
  DINARI_API_SECRET_KEY: 'test-secret',
  DINARI_ACCOUNT_ID: 'account-test',
});
assert.equal(sandboxLocked.sandboxTradingEnabled, false, 'sandbox trading requires explicit enable flag');
assert.equal(sandboxLocked.sandboxFaucetEnabled, false, 'sandbox faucet requires explicit enable flag');
assert.ok(sandboxLocked.symbols.includes('VNQ'), 'default real-estate watchlist should include VNQ');

const confirmedReconciliation = reconcileDigitalReitPosition({
  stockId: 'stock-vnq',
  symbol: 'VNQ',
  previousAmount: 1,
  portfolio: [{ stockId: 'stock-vnq', symbol: 'VNQ', amount: 1.125 }],
});
assert.equal(confirmedReconciliation.confirmed, true, 'a provider-reported position increase should confirm ownership');
assert.equal(confirmedReconciliation.increase, 0.125);
assert.equal(confirmedReconciliation.source, 'provider-portfolio');

const pendingReconciliation = reconcileDigitalReitPosition({
  stockId: 'stock-vnq',
  symbol: 'VNQ',
  previousAmount: 1,
  portfolio: [{ stockId: 'stock-vnq', symbol: 'VNQ', amount: 1 }],
});
assert.equal(pendingReconciliation.confirmed, false, 'order submission alone must not confirm ownership');
assert.equal(pendingReconciliation.increase, 0);

assert.throws(
  () => reconcileDigitalReitPosition({ stockId: 'stock-vnq', previousAmount: -1, portfolio: [] }),
  /non-negative/,
  'invalid reconciliation baselines must fail closed',
);

const originalFetch = global.fetch;
const calls = [];
global.fetch = async (url, options = {}) => {
  const href = String(url);
  calls.push({ url: href, options });

  if (href.includes('/market_data/stocks/')) {
    return new Response(JSON.stringify({ data: [
      { id: 'stock-vnq', symbol: 'VNQ', name: 'Example REIT ETF', is_fractionable: true },
      { id: 'stock-aapl', symbol: 'AAPL', name: 'Not real estate' },
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (href.endsWith('/accounts/account-test/cash')) {
    return new Response(JSON.stringify([
      { symbol: 'mockUSD', amount: 1000, chain_id: 'eip155:42161', token_address: '0xmock' },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (href.includes('/dividend_payments?')) {
    return new Response(JSON.stringify({ data: [
      { stock_id: 'stock-vnq', amount: 1.25, currency: 'USD', payment_date: '2026-08-01' },
      { stock_id: 'stock-aapl', amount: 9.99, currency: 'USD', payment_date: '2026-08-01' },
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (href.endsWith('/accounts/account-test/faucet')) {
    return new Response(null, { status: 204 });
  }
  if (href.includes('/order_requests/market_buy')) {
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
    DINARI_SANDBOX_FAUCET_ENABLED: 'true',
    DINARI_REAL_ESTATE_SYMBOLS: 'VNQ,SCHH',
  };

  const assets = await listDigitalRealEstateAssets(env);
  assert.equal(assets.length, 1, 'provider assets outside configured real-estate symbols must be filtered out');
  assert.equal(assets[0].symbol, 'VNQ');
  assert.ok(calls[0].url.startsWith('https://api-enterprise.sandbox.dinari.com/api/v2/'), 'sandbox adapter must use sandbox base URL');
  assert.equal(calls[0].options.headers['X-API-Key-Id'], 'test-key', 'provider auth header missing');

  const cash = await getDigitalRealEstateCash(env);
  assert.equal(cash.length, 1);
  assert.equal(cash[0].symbol, 'MOCKUSD');
  assert.equal(cash[0].amount, 1000);

  const dividends = await getDigitalRealEstateDividends(env, assets);
  assert.equal(dividends.length, 1, 'dividends for non-real-estate stocks must be excluded');
  assert.equal(dividends[0].stockId, 'stock-vnq');
  assert.equal(dividends[0].symbol, 'VNQ');
  const dividendCall = calls.find((call) => call.url.includes('/dividend_payments?'));
  assert.ok(dividendCall?.url.includes('start_date='), 'Dinari dividend request must include required start_date');
  assert.ok(dividendCall?.url.includes('end_date='), 'Dinari dividend request must include required end_date');

  const funding = await mintSandboxFunds(env);
  assert.equal(funding.realMoney, false);
  assert.equal(funding.amount, 1000);
  const faucetCall = calls.find((call) => call.url.endsWith('/accounts/account-test/faucet'));
  assert.ok(faucetCall, 'sandbox faucet endpoint was not called');
  assert.equal(faucetCall.options.method, 'POST');
  assert.deepEqual(JSON.parse(faucetCall.options.body), { chain_id: 'eip155:42161' });

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

  await assert.rejects(
    () => mintSandboxFunds({ ...env, DINARI_ENVIRONMENT: 'live' }),
    /refuses non-sandbox/,
    'sandbox faucet must refuse live environment',
  );
} finally {
  global.fetch = originalFetch;
}

console.log('Digital REIT safety checks passed: provider catalog/dividends are real-estate filtered, cash and sandbox faucet flows are modeled, sandbox orders remain capped, provider position increases are reconciled before ownership confirmation, and production trading/funding remain code-locked.');
