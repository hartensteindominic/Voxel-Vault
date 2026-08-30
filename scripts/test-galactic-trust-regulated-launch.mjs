import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BANKING_LAUNCH_POLICY_VERSION,
  LIVE_BANKING_IMPLEMENTATION_READY,
  LIVE_CRYPTO_IMPLEMENTATION_READY,
  bankingEvidenceRequirements,
  bankingLaunchSnapshot,
} from '../lib/banking/regulated-launch.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const gate = read('app/bank/GalacticBankGate.js');
const enhancements = read('app/bank/GalacticDashboardEnhancements.js');
const readinessPage = read('app/bank/readiness/page.js');
const readinessApi = read('app/api/bank/readiness/route.ts');
const increaseSandbox = read('lib/banking/increase-sandbox.js');
const increaseStatusApi = read('app/api/admin/bank/increase/status/route.ts');
const integrationsApi = read('app/api/admin/integrations/status/route.ts');
const terms = read('app/terms/page.js');
const privacy = read('app/privacy/page.js');
const layout = read('app/layout.js');
const envExample = read('.env.example');

assert.match(BANKING_LAUNCH_POLICY_VERSION, /^2026-08-bank-fintech-v1$/, 'regulated banking policy version must be explicit');
assert.equal(LIVE_BANKING_IMPLEMENTATION_READY, false, 'live banking implementation must remain hard-locked until a reviewed provider integration exists');
assert.equal(LIVE_CRYPTO_IMPLEMENTATION_READY, false, 'live crypto must remain separately hard-locked');
assert.ok(bankingEvidenceRequirements.length >= 12, 'banking launch must require a complete external-authority evidence set');

for (const requirement of bankingEvidenceRequirements) {
  assert.ok(requirement.assertionEnvKey.startsWith('GALACTIC_'), `${requirement.gate} must use a scoped readiness assertion`);
  assert.ok(requirement.authority.length > 10, `${requirement.gate} must identify the real decision authority`);
  assert.ok(requirement.requiredEvidence.length >= 3, `${requirement.gate} must identify concrete external evidence`);
}

const allTrue = Object.fromEntries(bankingEvidenceRequirements.map((requirement) => [requirement.assertionEnvKey, 'true']));
const attemptedLive = bankingLaunchSnapshot({
  ...allTrue,
  GALACTIC_LIVE_BANKING_ENABLED: 'true',
  GALACTIC_LIVE_CRYPTO_ENABLED: 'true',
  GALACTIC_BANKING_PLATFORM: 'example-provider',
  GALACTIC_SPONSOR_BANK_LEGAL_NAME: 'Example Bank',
});
assert.equal(attemptedLive.allRequiredAssertionsPresent, true, 'test fixture should assert every external readiness input');
assert.equal(attemptedLive.liveBankingEnabled, false, 'environment assertions must never bypass the reviewed implementation lock');
assert.equal(attemptedLive.liveCryptoEnabled, false, 'banking approval must never imply live crypto authority');

assert.match(gate, /financial technology product, not a bank/i, 'onboarding must clearly identify Galactic Trust as a nonbank');
assert.match(gate, /No real deposits are held and no real money moves/i, 'onboarding must keep real deposits and money movement disabled');
assert.match(gate, /\/bank\/readiness/, 'onboarding must link to public regulated launch status');
assert.match(gate, /GalacticDashboardEnhancements onSignOut=\{activeSignOut\}/, 'dashboard enhancements must receive the real account sign-out handler');

assert.match(enhancements, /financial technology product, not a bank/i, 'dashboard trust strip must preserve the nonbank boundary');
assert.match(enhancements, /approved sponsor-bank program/i, 'dashboard must name the real launch authority instead of a founder toggle');
assert.match(enhancements, /\/bank\/readiness/, 'dashboard must expose regulated launch status');
assert.match(enhancements, /logout\.addEventListener\('click', handler, true\)/, 'visible Log Out control must be wired to the real account sign-out path');

assert.match(readinessPage, /Real banking stays locked/, 'readiness page must lead with the fail-closed launch posture');
assert.match(readinessPage, /No fake trust signals/, 'readiness page must forbid misleading trust claims');
assert.match(readinessApi, /Cache-Control.*no-store/s, 'readiness endpoint must not cache launch-state assertions');
assert.doesNotMatch(readinessApi, /API_KEY|SECRET|TOKEN/, 'public readiness endpoint must not expose provider credentials');

assert.match(increaseSandbox, /https:\/\/sandbox\.increase\.com/, 'Increase integration must be pinned to the sandbox origin');
assert.doesNotMatch(increaseSandbox, /https:\/\/api\.increase\.com/, 'Increase sandbox adapter must not contain the production API origin');
assert.match(increaseSandbox, /INCREASE_SANDBOX_API_KEY/, 'Increase sandbox adapter must use the sandbox-specific key');
assert.doesNotMatch(increaseSandbox, /GALACTIC_BANKING_PROVIDER_API_KEY/, 'sandbox adapter must not fall back to a generic production provider key');
assert.match(increaseSandbox, /canMoveRealMoney:\s*false/, 'sandbox adapter must explicitly declare that it cannot move real money');
assert.match(increaseSandbox, /productionSupported:\s*false/, 'sandbox adapter must explicitly reject production support');
assert.match(increaseSandbox, /origin !== new URL\(INCREASE_SANDBOX_BASE_URL\)\.origin/, 'provider requests must be origin-pinned');

assert.match(increaseStatusApi, /requireVoxelVaultAdmin/, 'Increase sandbox status must be owner-authenticated');
assert.match(increaseStatusApi, /Cache-Control': 'private, no-store, max-age=0'/, 'Increase sandbox status must never be publicly cached');
assert.match(increaseStatusApi, /canMoveRealMoney:\s*false/, 'Increase status must preserve the sandbox-only boundary');
assert.match(increaseStatusApi, /never returns the API key/, 'Increase status must disclose its credential boundary');
assert.doesNotMatch(increaseStatusApi, /process\.env\.INCREASE_SANDBOX_API_KEY/, 'owner status route must not directly read or return the sandbox key');
assert.match(integrationsApi, /Increase sandbox/, 'owner integrations center must track the banking sandbox');
assert.match(integrationsApi, /sandbox · no real money/, 'owner integrations center must label the no-real-money mode');

assert.match(terms, /Galactic Trust itself is not an FDIC-insured institution/i, 'terms must keep FDIC attribution accurate');
assert.match(terms, /current crypto panel is simulated/i, 'terms must keep crypto separate from banking approval');
assert.match(privacy, /does not currently collect bank-program KYC documents/i, 'privacy notice must accurately describe current identity-data handling');
assert.match(privacy, /provider-hosted or tokenized workflows/i, 'privacy notice must prefer minimized provider-side handling for future KYC');
assert.match(layout, /Galactic Trust \| Financial App/, 'public metadata must avoid presenting Galactic Trust itself as a bank');
assert.match(layout, /Galactic Trust is not a bank/, 'metadata must preserve the nonbank boundary');
assert.doesNotMatch(`${gate}\n${enhancements}\n${layout}`, /Member FDIC|FDIC[- ]insured bank/i, 'public Galactic Trust UI must not claim FDIC status before a real sponsor-bank program exists');

for (const key of [
  'GALACTIC_SPONSOR_BANK_AGREEMENT_ACTIVE',
  'GALACTIC_PROGRAM_COMPLIANCE_APPROVED',
  'GALACTIC_KYC_CIP_AML_APPROVED',
  'GALACTIC_ACCOUNT_DISCLOSURES_APPROVED',
  'GALACTIC_REG_E_APPROVED',
  'GALACTIC_MONEY_MOVEMENT_APPROVED',
  'GALACTIC_CARD_PROGRAM_APPROVED',
  'GALACTIC_LEDGER_RECONCILIATION_APPROVED',
  'GALACTIC_DEPOSIT_INSURANCE_DISCLOSURE_APPROVED',
  'GALACTIC_PRIVACY_SECURITY_APPROVED',
  'GALACTIC_COMPLAINTS_DISPUTES_APPROVED',
  'GALACTIC_INCIDENT_RESPONSE_APPROVED',
  'GALACTIC_PROVIDER_PRODUCTION_ACCEPTED',
  'GALACTIC_LIVE_BANKING_ENABLED',
  'GALACTIC_LIVE_CRYPTO_ENABLED',
  'GALACTIC_INCREASE_SANDBOX_ENABLED',
]) {
  assert.match(envExample, new RegExp(`${key}=false`), `${key} must default to false in .env.example`);
}
assert.match(envExample, /INCREASE_SANDBOX_API_KEY=\n/, 'Increase sandbox API key must be documented as an empty server-only secret');
assert.doesNotMatch(envExample, /NEXT_PUBLIC_INCREASE/i, 'Increase credentials must never be exposed to browser code');

console.log('Galactic Trust regulated launch checks passed: nonbank disclosure, sponsor-bank authority, consumer-protection gates, owner-only Increase sandbox inspection, real sign-out and hard-locked live money/crypto are enforced.');
