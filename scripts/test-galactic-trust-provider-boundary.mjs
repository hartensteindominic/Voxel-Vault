import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  bankingEvidenceRequirements,
  LIVE_BANKING_IMPLEMENTATION_READY,
} from '../lib/banking/regulated-launch.js';
import { INCREASE_SANDBOX_BASE_URL } from '../lib/banking/increase-sandbox.js';
import { resolveBankingProvider } from '../lib/banking/providers/index.js';
import {
  INCREASE_PRODUCTION_BASE_URL,
  inspectIncreaseProduction,
} from '../lib/banking/providers/increase/production.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

assert.equal(LIVE_BANKING_IMPLEMENTATION_READY, false, 'production banking must remain hard-locked');
assert.notEqual(INCREASE_SANDBOX_BASE_URL, INCREASE_PRODUCTION_BASE_URL, 'sandbox and production Increase origins must be separate');
assert.equal(new URL(INCREASE_SANDBOX_BASE_URL).hostname, 'sandbox.increase.com', 'sandbox must stay pinned to sandbox.increase.com');
assert.equal(new URL(INCREASE_PRODUCTION_BASE_URL).hostname, 'api.increase.com', 'production origin belongs only to the locked production adapter');

const demo = resolveBankingProvider({});
assert.equal(demo.environment, 'demo', 'missing provider configuration must resolve to demo');
assert.equal(demo.canMoveRealMoney, false, 'demo provider must never move real money');

const sandbox = resolveBankingProvider({
  GALACTIC_INCREASE_SANDBOX_ENABLED: 'true',
  INCREASE_SANDBOX_API_KEY: 'test-only-placeholder',
});
assert.equal(sandbox.environment, 'sandbox', 'configured sandbox must resolve to the Increase sandbox provider');
assert.equal(sandbox.canMoveRealMoney, false, 'Increase sandbox provider must never move real money');
assert.equal(sandbox.productionSupported, false, 'sandbox provider must never advertise production support');

const allEvidence = Object.fromEntries(
  bankingEvidenceRequirements.map((requirement) => [requirement.assertionEnvKey, 'true'])
);
const attemptedProduction = resolveBankingProvider({
  ...allEvidence,
  GALACTIC_LIVE_BANKING_ENABLED: 'true',
  GALACTIC_BANKING_PLATFORM: 'increase',
  INCREASE_PRODUCTION_API_KEY: 'production-placeholder',
});
assert.equal(attemptedProduction.environment, 'demo', 'environment assertions must not bypass the implementation lock');
assert.equal(attemptedProduction.canMoveRealMoney, false, 'attempted production enablement must fail closed');

const productionStatus = inspectIncreaseProduction({
  ...allEvidence,
  GALACTIC_LIVE_BANKING_ENABLED: 'true',
  GALACTIC_BANKING_PLATFORM: 'increase',
  INCREASE_PRODUCTION_API_KEY: 'production-placeholder',
});
assert.equal(productionStatus.implementationReady, false, 'production adapter inspection must expose the hard implementation lock');
assert.equal(productionStatus.launchApproved, false, 'launch approval cannot become true while implementation is locked');
assert.equal(productionStatus.connected, false, 'production stub must not claim connectivity');
assert.equal(productionStatus.canMoveRealMoney, false, 'production stub must not claim money movement capability');

const sandboxSource = read('lib/banking/providers/increase/sandbox.js');
const productionSource = read('lib/banking/providers/increase/production.js');
const resolverSource = read('lib/banking/providers/index.js');
const gateSource = read('app/bank/GalacticBankGate.js');

assert.doesNotMatch(productionSource, /increase-sandbox/i, 'production adapter must not import or reuse sandbox request code');
assert.doesNotMatch(productionSource, /INCREASE_SANDBOX_API_KEY/, 'production adapter must not accept sandbox credentials');
assert.match(productionSource, /INCREASE_PRODUCTION_API_KEY/, 'production adapter must require a dedicated production credential');
assert.match(productionSource, /Production remains fail-closed/, 'production stub must fail explicitly until implementation exists');
assert.match(sandboxSource, /\.\.\/\.\.\/increase-sandbox\.js/, 'sandbox provider wrapper must delegate only to the pinned sandbox adapter');
assert.match(resolverSource, /launch\.liveBankingEnabled && platform === 'increase'/, 'resolver must require the regulated launch snapshot before production selection');
assert.match(gateSource, /new URL\('\/bank', window\.location\.origin\)/, 'Google and OTP auth must return directly to the Galactic Trust dashboard');

console.log('Galactic Trust provider boundary checks passed: demo, Increase sandbox, and locked production remain explicitly separated and auth returns to /bank.');
