import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GALACTIC_ACCOUNT_LIFECYCLE_VERSION,
  buildGalacticAccountLifecycle,
} from '../lib/banking/account-lifecycle.js';

const noBinding = { binding: null, setupRequired: false, error: '' };
const sandboxBinding = {
  binding: {
    provider: 'increase',
    environment: 'sandbox',
    status: 'verified',
    kycStatus: 'SANDBOX_VALID_SIMULATION',
    accountId: 'sandbox_account_private',
    entityId: 'sandbox_entity_private',
  },
  setupRequired: false,
  error: '',
};

const signedOut = buildGalacticAccountLifecycle({ signedIn: false, bindingState: noBinding, env: {} });
assert.equal(signedOut.lifecycleVersion, GALACTIC_ACCOUNT_LIFECYCLE_VERSION);
assert.equal(signedOut.stage, 'signed-out');
assert.equal(signedOut.canMoveRealMoney, false);
assert.equal(signedOut.canOpenProductionAccount, false);

const demoOnly = buildGalacticAccountLifecycle({ signedIn: true, bindingState: noBinding, env: {} });
assert.equal(demoOnly.stage, 'demo-only');
assert.equal(demoOnly.sandbox.ownerBindingReady, false);
assert.equal(demoOnly.production.customerAccountOpeningSupported, false);
assert.equal(demoOnly.production.customerMoneyMovementSupported, false);

const infrastructureBlocked = buildGalacticAccountLifecycle({
  signedIn: true,
  bindingState: { binding: null, setupRequired: true, error: 'migration missing' },
  env: {},
});
assert.equal(infrastructureBlocked.stage, 'infrastructure-setup-required');
assert.equal(infrastructureBlocked.sandbox.bindingStorageReady, false);
assert.equal(infrastructureBlocked.canMoveRealMoney, false);

const sandboxOwner = buildGalacticAccountLifecycle({ signedIn: true, bindingState: sandboxBinding, env: {} });
assert.equal(sandboxOwner.stage, 'sandbox-owner-bound');
assert.equal(sandboxOwner.sandbox.ownerBindingReady, true);
assert.equal(sandboxOwner.sandbox.validationKind, 'sandbox-simulation');
assert.equal(sandboxOwner.sandbox.canMoveRealMoney, false);
assert.equal(JSON.stringify(sandboxOwner).includes('sandbox_account_private'), false, 'lifecycle response must not expose full provider Account IDs');
assert.equal(JSON.stringify(sandboxOwner).includes('sandbox_entity_private'), false, 'lifecycle response must not expose full provider Entity IDs');

const misleadingBinding = buildGalacticAccountLifecycle({
  signedIn: true,
  bindingState: {
    ...sandboxBinding,
    binding: { ...sandboxBinding.binding, kycStatus: 'PASS' },
  },
  env: {},
});
assert.equal(misleadingBinding.stage, 'demo-only', 'Increase sandbox binding must require the explicit simulation marker');
assert.equal(misleadingBinding.sandbox.ownerBindingReady, false);

const allEvidenceEnv = {
  GALACTIC_LIVE_BANKING_ENABLED: 'true',
  GALACTIC_BANKING_PLATFORM: 'increase',
  GALACTIC_SPONSOR_BANK_LEGAL_NAME: 'Example Sponsor Bank',
  GALACTIC_SPONSOR_BANK_AGREEMENT_ACTIVE: 'true',
  GALACTIC_PROGRAM_COMPLIANCE_APPROVED: 'true',
  GALACTIC_KYC_CIP_AML_APPROVED: 'true',
  GALACTIC_ACCOUNT_DISCLOSURES_APPROVED: 'true',
  GALACTIC_REG_E_APPROVED: 'true',
  GALACTIC_MONEY_MOVEMENT_APPROVED: 'true',
  GALACTIC_CARD_PROGRAM_APPROVED: 'true',
  GALACTIC_LEDGER_RECONCILIATION_APPROVED: 'true',
  GALACTIC_DEPOSIT_INSURANCE_DISCLOSURE_APPROVED: 'true',
  GALACTIC_PRIVACY_SECURITY_APPROVED: 'true',
  GALACTIC_COMPLAINTS_DISPUTES_APPROVED: 'true',
  GALACTIC_INCIDENT_RESPONSE_APPROVED: 'true',
  GALACTIC_PROVIDER_PRODUCTION_ACCEPTED: 'true',
};
const envCannotPromoteUser = buildGalacticAccountLifecycle({
  signedIn: true,
  bindingState: sandboxBinding,
  env: allEvidenceEnv,
});
assert.equal(envCannotPromoteUser.production.evidenceAssertionsPresent, true);
assert.equal(envCannotPromoteUser.production.liveSwitchRequested, true);
assert.equal(envCannotPromoteUser.production.implementationReady, false, 'reviewed production implementation lock must remain false');
assert.equal(envCannotPromoteUser.production.status, 'production-gated');
assert.equal(envCannotPromoteUser.production.customerAccountOpeningSupported, false);
assert.equal(envCannotPromoteUser.production.customerMoneyMovementSupported, false);
assert.equal(envCannotPromoteUser.canOpenProductionAccount, false);
assert.equal(envCannotPromoteUser.canMoveRealMoney, false, 'environment assertions must never promote a sandbox user to real-money banking');

const helperSource = await readFile(new URL('../lib/banking/account-lifecycle.js', import.meta.url), 'utf8');
assert.match(helperSource, /bankingLaunchSnapshot/, 'lifecycle must derive production state from the regulated launch boundary');
assert.match(helperSource, /customerAccountOpeningSupported: false/, 'customer production account opening must remain explicitly unsupported');
assert.match(helperSource, /customerMoneyMovementSupported: false/, 'customer production money movement must remain explicitly unsupported');
assert.match(helperSource, /canMoveRealMoney: false/, 'lifecycle must fail closed on real-money movement');
assert.equal(helperSource.includes('GALACTIC_LIVE_BANKING_ENABLED ='), false, 'lifecycle must not mutate or redefine live-banking switches');

const routeSource = await readFile(new URL('../app/api/bank/lifecycle/route.ts', import.meta.url), 'utf8');
assert.match(routeSource, /admin\.auth\.getUser\(token\)/, 'lifecycle API must verify the bearer session server-side');
assert.match(routeSource, /getProviderAccountBinding\(admin, user\.id/, 'binding lookup must use the verified auth user ID');
assert.match(routeSource, /provider: 'increase',[\s\S]*environment: 'sandbox'/, 'lifecycle binding lookup must remain Increase sandbox scoped');
assert.match(routeSource, /private, no-store/, 'lifecycle API must prohibit caching');
assert.match(routeSource, /not a bank-account approval or production eligibility decision/, 'lifecycle API must disclose that the derived state is not approval');
assert.equal(routeSource.includes('request.json()'), false, 'lifecycle GET must not accept client-supplied lifecycle or user state');
assert.equal(routeSource.includes('accountId'), false, 'lifecycle route must not expose provider Account IDs');
assert.equal(routeSource.includes('entityId'), false, 'lifecycle route must not expose provider Entity IDs');

console.log('Galactic Trust account lifecycle checks passed: lifecycle is server-derived, auth-scoped, sandbox-aware, provider IDs stay private, missing binding infrastructure fails closed, and no environment assertion can promote a user into production banking or real-money movement.');
