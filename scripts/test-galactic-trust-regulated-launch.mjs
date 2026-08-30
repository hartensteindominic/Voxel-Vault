import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  LIVE_BANKING_IMPLEMENTATION_READY,
  LIVE_CRYPTO_IMPLEMENTATION_READY,
  bankingEvidenceRequirements,
  bankingLaunchSnapshot,
} from '../lib/banking/regulated-launch.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

assert.equal(LIVE_BANKING_IMPLEMENTATION_READY, false, 'live banking implementation must remain hard-locked');
assert.equal(LIVE_CRYPTO_IMPLEMENTATION_READY, false, 'live crypto implementation must remain separately hard-locked');
assert.ok(bankingEvidenceRequirements.length >= 12, 'production banking must require external evidence gates');

const allTrue = Object.fromEntries(bankingEvidenceRequirements.map(({ assertionEnvKey }) => [assertionEnvKey, 'true']));
const attemptedLive = bankingLaunchSnapshot({ ...allTrue, GALACTIC_LIVE_BANKING_ENABLED: 'true', GALACTIC_LIVE_CRYPTO_ENABLED: 'true', GALACTIC_BANKING_PLATFORM: 'candidate', GALACTIC_SPONSOR_BANK_LEGAL_NAME: 'Candidate Bank' });
assert.equal(attemptedLive.allRequiredAssertionsPresent, true);
assert.equal(attemptedLive.liveBankingEnabled, false, 'environment flags must never bypass the reviewed implementation lock');
assert.equal(attemptedLive.liveCryptoEnabled, false, 'banking readiness must never imply crypto readiness');

const gate = await read('app/bank/GalacticBankGate.js');
const layout = await read('app/layout.js');
const sandbox = await read('lib/banking/increase-sandbox.js');
const status = await read('app/api/admin/bank/increase/status/route.ts');
const dashboard = await read('app/api/admin/bank/increase/dashboard/route.ts');
const fund = await read('app/api/admin/bank/increase/fund/route.ts');
const transfer = await read('app/api/admin/bank/increase/transfer/route.ts');
const envExample = await read('.env.example');

assert.match(gate, /financial technology product, not a bank/i);
assert.match(gate, /No real deposits are held and no real money moves/i);
assert.match(layout, /Galactic Trust is not a bank/i);
assert.doesNotMatch(`${gate}\n${layout}`, /Member FDIC|FDIC[- ]insured bank/i);

assert.match(sandbox, /https:\/\/sandbox\.increase\.com/);
assert.doesNotMatch(sandbox, /https:\/\/api\.increase\.com/);
assert.match(sandbox, /canMoveRealMoney:\s*false/);
assert.match(sandbox, /productionSupported:\s*false/);

for (const source of [status, dashboard, fund, transfer]) {
  assert.match(source, /requireGalacticTrustAdmin/, 'Increase sandbox routes must remain owner-authenticated');
  assert.match(source, /private, no-store, max-age=0/, 'Increase sandbox routes must remain private and uncached');
  assert.doesNotMatch(source, /process\.env\.INCREASE_SANDBOX_API_KEY/, 'routes must not directly expose provider credentials');
}
assert.match(dashboard, /pretend money/i);
assert.match(fund, /No external bank account was debited/i);
assert.match(transfer, /No real recipient or bank account is used/i);

for (const requirement of bankingEvidenceRequirements) {
  assert.match(envExample, new RegExp(`${requirement.assertionEnvKey}=false`), `${requirement.assertionEnvKey} must default false`);
}
for (const key of ['GALACTIC_LIVE_BANKING_ENABLED', 'GALACTIC_LIVE_CRYPTO_ENABLED', 'GALACTIC_INCREASE_SANDBOX_ENABLED']) {
  assert.match(envExample, new RegExp(`${key}=false`), `${key} must default false`);
}
assert.match(envExample, /INCREASE_SANDBOX_API_KEY=\n/);
assert.doesNotMatch(envExample, /NEXT_PUBLIC_INCREASE/i);

console.log('Galactic Trust regulated launch boundary passed.');
