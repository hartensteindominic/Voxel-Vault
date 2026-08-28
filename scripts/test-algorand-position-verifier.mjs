import assert from 'node:assert/strict';
import {
  ALGORAND_ISSUER_PROPERTY_MAPPING_VERIFIER_IMPLEMENTATION_READY,
  ALGORAND_ONCHAIN_HOLDING_VERIFIER_IMPLEMENTATION_READY,
  ALGORAND_WALLET_CONTROL_VERIFIER_IMPLEMENTATION_READY,
  getAlgorandVerifierConfig,
  normalizeAlgorandAssetId,
  publicAlgorandVerifierStatus,
  validateAlgorandAddress,
  verifyAlgorandAssetHolding,
} from '../lib/real-estate/algorand-position-verifier.js';

const ZERO_ADDRESS = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';
const env = {
  ALGORAND_INDEXER_BASE_URL: 'https://indexer.example.test',
  ALGORAND_INDEXER_API_TOKEN: 'server-only-test-token',
  ALGORAND_INDEXER_API_TOKEN_HEADER: 'X-Indexer-API-Token',
  ALGORAND_READONLY_POSITION_VERIFICATION_ENABLED: 'true',
};

assert.equal(ALGORAND_ONCHAIN_HOLDING_VERIFIER_IMPLEMENTATION_READY, true);
assert.equal(ALGORAND_WALLET_CONTROL_VERIFIER_IMPLEMENTATION_READY, false);
assert.equal(ALGORAND_ISSUER_PROPERTY_MAPPING_VERIFIER_IMPLEMENTATION_READY, false);
assert.equal(validateAlgorandAddress(ZERO_ADDRESS), ZERO_ADDRESS);
assert.throws(() => validateAlgorandAddress(`${ZERO_ADDRESS.slice(0, -1)}A`), /checksum is invalid/);
assert.equal(normalizeAlgorandAssetId('123'), '123');
assert.throws(() => normalizeAlgorandAssetId('0'), /outside the uint64 range/);
assert.throws(() => normalizeAlgorandAssetId('-1'), /positive integer/);
assert.throws(() => normalizeAlgorandAssetId('18446744073709551616'), /outside the uint64 range/);

const config = getAlgorandVerifierConfig(env);
assert.equal(config.productionReady, true);
assert.equal(config.baseUrl, 'https://indexer.example.test');
assert.equal(config.token, 'server-only-test-token');
assert.throws(() => getAlgorandVerifierConfig({ ALGORAND_INDEXER_BASE_URL: 'http://unsafe.example' }), /must use HTTPS/);

const calls = [];
const mockFetch = async (url, options = {}) => {
  calls.push({ url: String(url), headers: options.headers || {} });
  assert.equal(options.method, 'GET');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.headers['X-Indexer-API-Token'], 'server-only-test-token');

  if (String(url).startsWith(`https://indexer.example.test/v2/accounts/${ZERO_ADDRESS}/assets?`)) {
    const parsed = new URL(String(url));
    assert.equal(parsed.searchParams.get('asset-id'), '123');
    assert.equal(parsed.searchParams.get('limit'), '1');
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          assets: [{
            'asset-id': 123,
            amount: 2500,
            'is-frozen': false,
          }],
        };
      },
    };
  }

  if (String(url) === 'https://indexer.example.test/v2/assets/123') {
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          asset: {
            index: 123,
            deleted: false,
            params: {
              creator: ZERO_ADDRESS,
              decimals: 2,
              name: 'Example Property Share',
              'unit-name': 'PROP',
              total: 100000,
              url: 'https://issuer.example/property/123',
              manager: ZERO_ADDRESS,
              reserve: ZERO_ADDRESS,
              freeze: ZERO_ADDRESS,
              clawback: ZERO_ADDRESS,
            },
          },
        };
      },
    };
  }

  throw new Error(`Unexpected URL: ${url}`);
};

const result = await verifyAlgorandAssetHolding(
  { walletAddress: ZERO_ADDRESS, assetId: '123' },
  { env, fetchImpl: mockFetch }
);

assert.equal(calls.length, 2);
assert.equal(result.network, 'algorand');
assert.equal(result.walletAddress, ZERO_ADDRESS);
assert.equal(result.assetId, '123');
assert.equal(result.holding.found, true);
assert.equal(result.holding.positive, true);
assert.equal(result.holding.amountAtomic, '2500');
assert.equal(result.holding.quantity, '25');
assert.equal(result.holding.decimals, 2);
assert.equal(result.asset.name, 'Example Property Share');
assert.equal(result.asset.unitName, 'PROP');
assert.equal(result.evidence.onChainHoldingVerified, true);
assert.equal(result.evidence.walletControlVerified, false);
assert.equal(result.evidence.issuerPropertyMappingVerified, false);
assert.equal(result.evidence.legalPropertyRightsVerified, false);
assert.equal(result.evidence.rightsType, 'reference_only');
assert.equal(result.evidence.targetRightsType, 'provider_fractional_security');
assert.ok(Object.values(result.legalEffects).every((value) => value === false));
assert.ok(result.blockers.some((value) => value.includes('wallet-control proof')));
assert.ok(result.blockers.some((value) => value.includes('issuer/legal-entity-to-property mapping')));

const publicStatus = publicAlgorandVerifierStatus(env);
assert.equal(publicStatus.implementationReady, true);
assert.equal(publicStatus.configured, true);
assert.equal(publicStatus.canVerifyPublicHolding, true);
assert.equal(publicStatus.canVerifyLegalPropertyRights, false);
assert.equal(publicStatus.indexerTokenConfigured, true);

const disabledStatus = publicAlgorandVerifierStatus({ ALGORAND_INDEXER_BASE_URL: 'https://indexer.example.test' });
assert.equal(disabledStatus.canVerifyPublicHolding, false);
assert.ok(disabledStatus.blockers.includes('ALGORAND_READONLY_POSITION_VERIFICATION_ENABLED is not true'));

console.log('Algorand position verifier safety checks passed: checksum-valid public addresses only, exact read-only asset lookup, server-only Indexer token, positive holding verification, no wallet signing/fund movement, and no legal property-rights upgrade without separate wallet-control and issuer/property mapping evidence.');
