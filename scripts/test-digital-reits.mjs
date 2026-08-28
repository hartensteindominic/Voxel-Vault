import assert from 'node:assert/strict';
import {
  DINARI_LIVE_ORDER_MAX_USD,
  DINARI_LIVE_TRADING_IMPLEMENTATION_READY,
  DINARI_SANDBOX_FAUCET_AMOUNT,
  DINARI_SANDBOX_ORDER_MAX_USD,
  createLiveMarketBuy,
  createLivePreTradeConfirmation,
  createSandboxMarketBuy,
  getDigitalRealEstateCash,
  getDigitalRealEstateDividends,
  getDinariConfig,
  inspectLiveDinariAccount,
  listDigitalRealEstateAssets,
  mintSandboxFunds,
} from '../lib/real-estate/dinari.js';
import { reconcileDigitalReitPosition } from '../lib/real-estate/reconciliation.js';

assert.equal(DINARI_LIVE_TRADING_IMPLEMENTATION_READY, true, 'live trading implementation should be present');
assert.equal(DINARI_LIVE_ORDER_MAX_USD, 700, 'live per-order cap changed unexpectedly');
assert.equal(DINARI_SANDBOX_ORDER_MAX_USD, 25, 'sandbox order cap changed unexpectedly');
assert.equal(DINARI_SANDBOX_FAUCET_AMOUNT, 1000, 'sandbox faucet amount changed unexpectedly');

const liveLocked = getDinariConfig({
  DINARI_ENVIRONMENT: 'live',
  DINARI_API_KEY_ID: 'test-key',
  DINARI_API_SECRET_KEY: 'test-secret',
  DINARI_ENTITY_ID: 'entity-test',
  DINARI_ACCOUNT_ID: 'account-test',
  DINARI_PRODUCTION_TRADING_ENABLED: 'true',
  DINARI_SANDBOX_FAUCET_ENABLED: 'true',
});
assert.equal(liveLocked.environment, 'live');
assert.equal(liveLocked.productionTradingEnabled, false, 'credentials and a single env flag must not unlock production trading');
assert.ok(liveLocked.productionReadinessBlockers.some((item) => item.includes('DINARI_LIVE_PARTNER_APPROVED')), 'live partner approval gate missing');
assert.equal(liveLocked.sandboxTradingEnabled, false, 'live environment cannot use sandbox trading path');
assert.equal(liveLocked.sandboxFaucetEnabled, false, 'live environment cannot use sandbox faucet path');

const liveEnv = {
  DINARI_ENVIRONMENT: 'live',
  DINARI_API_KEY_ID: 'test-key',
  DINARI_API_SECRET_KEY: 'test-secret',
  DINARI_ENTITY_ID: 'entity-test',
  DINARI_ACCOUNT_ID: 'account-test',
  DINARI_REAL_ESTATE_SYMBOLS: 'VNQ,SCHH',
  DINARI_LIVE_PARTNER_APPROVED: 'true',
  DINARI_LIVE_MANAGED_ORDERS_APPROVED: 'true',
  DINARI_US_DISCLOSURES_APPROVED: 'true',
  DINARI_US_NBBO_APPROVED: 'true',
  DINARI_US_DISCLOSURE_VERSION: 'test-v1',
  DINARI_US_DISCLOSURE_PAGE_URL: 'https://example.com/dinari-disclosures',
  DINARI_LIVE_CONFIRMATION_SECRET: 'test-live-confirmation-secret-that-is-at-least-32-characters',
  DINARI_PRODUCTION_TRADING_ENABLED: 'true',
};
const liveReadyConfig = getDinariConfig(liveEnv);
assert.equal(liveReadyConfig.productionTradingEnabled, true, 'all explicit production configuration gates should enable the code path');
assert.deepEqual(liveReadyConfig.productionReadinessBlockers, []);

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
  const parsed = new URL(href);
  const path = parsed.pathname;

  if (path.endsWith('/market_data/stocks/')) {
    return new Response(JSON.stringify({ data: [
      { id: 'stock-vnq', symbol: 'VNQ', name: 'Example REIT ETF', is_fractionable: true, is_tradable: true },
      { id: 'stock-aapl', symbol: 'AAPL', name: 'Not real estate', is_fractionable: true, is_tradable: true },
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (path.endsWith('/market_data/stocks/stock-vnq/current_quote')) {
    return new Response(JSON.stringify({
      stock_id: 'stock-vnq',
      symbol: 'VNQ',
      bid_price: 99.9,
      bid_size: 10,
      bid_exchange: 'NYSE',
      ask_price: 100.1,
      ask_size: 11,
      ask_exchange: 'NASDAQ',
      timestamp: new Date().toISOString(),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (path === '/api/v2/entities/entity-test') {
    return new Response(JSON.stringify({ id: 'entity-test', is_kyc_complete: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (path === '/api/v2/entities/entity-test/kyc') {
    return new Response(JSON.stringify({ id: 'kyc-test', status: 'PASS', jurisdiction: 'US' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (path === '/api/v2/entities/entity-test/accounts') {
    return new Response(JSON.stringify({ data: [
      { id: 'account-test', entity_id: 'entity-test', is_active: true, jurisdiction: 'US' },
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (path === '/api/v2/accounts/account-test/wallet') {
    return new Response(JSON.stringify({
      address: '0x0000000000000000000000000000000000000001',
      chain_id: 'eip155:42161',
      is_managed_wallet: true,
      is_aml_flagged: false,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (path === '/api/v2/accounts/account-test/portfolio') {
    return new Response(JSON.stringify({ assets: [
      { stock_id: 'stock-vnq', symbol: 'VNQ', amount: 1.125, chain_id: 'eip155:42161', token_address: '0xvnq' },
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (path === '/api/v2/accounts/account-test/cash') {
    return new Response(JSON.stringify([
      { symbol: 'mockUSD', amount: 1000, chain_id: 'eip155:42161', token_address: '0xmock' },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (path.endsWith('/dividend_payments')) {
    return new Response(JSON.stringify({ data: [
      { stock_id: 'stock-vnq', amount: 1.25, currency: 'USD', payment_date: '2026-08-01' },
      { stock_id: 'stock-aapl', amount: 9.99, currency: 'USD', payment_date: '2026-08-01' },
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (path === '/api/v2/accounts/account-test/faucet') {
    return new Response(null, { status: 204 });
  }
  if (path === '/api/v2/accounts/account-test/order_requests/market_buy') {
    const body = JSON.parse(options.body || '{}');
    const liveOrder = String(body.client_order_id || '').startsWith('vv-live-');
    return new Response(JSON.stringify({ id: liveOrder ? 'live-order-1' : 'sandbox-order-1', status: 'PENDING' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error(`Unexpected fetch: ${url}`);
};

try {
  const sandboxEnv = {
    DINARI_ENVIRONMENT: 'sandbox',
    DINARI_API_KEY_ID: 'test-key',
    DINARI_API_SECRET_KEY: 'test-secret',
    DINARI_ACCOUNT_ID: 'account-test',
    DINARI_SANDBOX_ORDER_EXECUTION_ENABLED: 'true',
    DINARI_SANDBOX_FAUCET_ENABLED: 'true',
    DINARI_REAL_ESTATE_SYMBOLS: 'VNQ,SCHH',
  };

  const assets = await listDigitalRealEstateAssets(sandboxEnv);
  assert.equal(assets.length, 1, 'provider assets outside configured real-estate symbols must be filtered out');
  assert.equal(assets[0].symbol, 'VNQ');
  assert.equal(assets[0].isTradable, true);
  assert.ok(calls[0].url.startsWith('https://api-enterprise.sandbox.dinari.com/api/v2/'), 'sandbox adapter must use sandbox base URL');
  assert.equal(calls[0].options.headers['X-API-Key-Id'], 'test-key', 'provider auth header missing');

  const cash = await getDigitalRealEstateCash(sandboxEnv);
  assert.equal(cash.length, 1);
  assert.equal(cash[0].symbol, 'MOCKUSD');
  assert.equal(cash[0].amount, 1000);

  const dividends = await getDigitalRealEstateDividends(sandboxEnv, assets);
  assert.equal(dividends.length, 1, 'dividends for non-real-estate stocks must be excluded');
  assert.equal(dividends[0].stockId, 'stock-vnq');
  assert.equal(dividends[0].symbol, 'VNQ');
  const dividendCall = calls.find((call) => call.url.includes('/dividend_payments?'));
  assert.ok(dividendCall?.url.includes('start_date='), 'Dinari dividend request must include required start_date');
  assert.ok(dividendCall?.url.includes('end_date='), 'Dinari dividend request must include required end_date');

  const funding = await mintSandboxFunds(sandboxEnv);
  assert.equal(funding.realMoney, false);
  assert.equal(funding.amount, 1000);
  const faucetCall = calls.find((call) => call.url.endsWith('/accounts/account-test/faucet'));
  assert.ok(faucetCall, 'sandbox faucet endpoint was not called');
  assert.equal(faucetCall.options.method, 'POST');
  assert.deepEqual(JSON.parse(faucetCall.options.body), { chain_id: 'eip155:42161' });

  const sandboxOrder = await createSandboxMarketBuy({ stockId: 'stock-vnq', paymentAmount: 5 }, sandboxEnv);
  assert.equal(sandboxOrder.id, 'sandbox-order-1');
  const sandboxOrderCall = calls.find((call) => call.url.includes('/order_requests/market_buy') && JSON.parse(call.options.body).client_order_id?.startsWith('voxel-reit-sandbox-'));
  assert.ok(sandboxOrderCall, 'sandbox market buy endpoint was not called');
  assert.equal(sandboxOrderCall.options.method, 'POST');
  const sandboxOrderBody = JSON.parse(sandboxOrderCall.options.body);
  assert.equal(sandboxOrderBody.stock_id, 'stock-vnq');
  assert.equal(sandboxOrderBody.payment_amount, 5);

  await assert.rejects(
    () => createSandboxMarketBuy({ stockId: 'stock-vnq', paymentAmount: 25.01 }, sandboxEnv),
    /no more than \$25/,
    'sandbox orders above the cap must fail closed',
  );

  await assert.rejects(
    () => createSandboxMarketBuy({ stockId: 'stock-vnq', paymentAmount: 5 }, { ...sandboxEnv, DINARI_ENVIRONMENT: 'live' }),
    /refuses non-sandbox/,
    'sandbox order function must refuse live environment',
  );

  await assert.rejects(
    () => mintSandboxFunds({ ...sandboxEnv, DINARI_ENVIRONMENT: 'live' }),
    /refuses non-sandbox/,
    'sandbox faucet must refuse live environment',
  );

  const providerState = await inspectLiveDinariAccount(liveEnv);
  assert.equal(providerState.ready, true, 'mocked live provider account should pass KYC/account/wallet verification');
  assert.equal(providerState.kycStatus, 'PASS');
  assert.equal(providerState.accountJurisdiction, 'US');
  assert.equal(providerState.managedWallet, true);
  assert.equal(providerState.amlFlagged, false);

  const confirmation = await createLivePreTradeConfirmation({
    userId: 'owner-user',
    stockId: 'stock-vnq',
    paymentAmount: 700,
  }, liveEnv);
  assert.equal(confirmation.paymentAmount, 700);
  assert.equal(confirmation.quote.symbol, 'VNQ');
  assert.equal(confirmation.quote.bid, 99.9);
  assert.equal(confirmation.quote.offer, 100.1);
  assert.ok(confirmation.confirmationToken.includes('.'), 'pre-trade confirmation must be signed');
  const quoteCall = calls.find((call) => call.url.includes('/current_quote?'));
  assert.ok(quoteCall?.url.includes('feed=sip'), 'live quote must request the SIP feed');
  assert.ok(quoteCall?.url.includes('entity_id=entity-test'), 'live quote must be scoped to the provider Entity');

  const liveBuy = await createLiveMarketBuy({
    userId: 'owner-user',
    confirmationToken: confirmation.confirmationToken,
  }, liveEnv);
  assert.equal(liveBuy.realMoney, true);
  assert.equal(liveBuy.environment, 'live');
  assert.equal(liveBuy.order.id, 'live-order-1');
  const liveOrderCall = calls.find((call) => call.url.includes('/order_requests/market_buy') && JSON.parse(call.options.body).client_order_id?.startsWith('vv-live-'));
  assert.ok(liveOrderCall, 'live market buy endpoint was not called');
  const liveOrderBody = JSON.parse(liveOrderCall.options.body);
  assert.equal(liveOrderBody.stock_id, 'stock-vnq');
  assert.equal(liveOrderBody.payment_amount, 700);
  assert.ok(/^vv-live-[a-f0-9]{24}$/.test(liveOrderBody.client_order_id), 'live order must use the signed confirmation ID for provider duplicate protection');

  await assert.rejects(
    () => createLiveMarketBuy({ userId: 'different-user', confirmationToken: confirmation.confirmationToken }, liveEnv),
    /different Voxel Vault user/,
    'a live confirmation must never be transferable to another authenticated user',
  );

  await assert.rejects(
    () => createLivePreTradeConfirmation({ userId: 'owner-user', stockId: 'stock-vnq', paymentAmount: 700.01 }, liveEnv),
    /between \$1 and \$700/,
    'live orders above the owner budget cap must fail closed',
  );
} finally {
  global.fetch = originalFetch;
}

console.log('Digital REIT checks passed: sandbox remains isolated/capped, live execution requires explicit production gates plus verified KYC/account/wallet state, the U.S. path requires a fresh SIP/NBBO pre-trade confirmation and approved disclosure version, live orders are owner-authenticated and capped at $700, and provider positions remain the source of ownership confirmation.');
