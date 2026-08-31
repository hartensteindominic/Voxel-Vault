import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/bank/GalacticIncreaseSandboxRecovery.js', import.meta.url), 'utf8');

assert.match(source, /const connected = Boolean\(statusResponse\.ok && status\?\.connected\)/, 'recovery takeover must require a confirmed Increase sandbox Accounts connection');
assert.match(source, /recoveryResponse\.ok &&\s*recovery\?\.recoveryAvailable/, 'recovery takeover must honor the owner recovery endpoint instead of depending only on hosted-onboarding capability detection');
assert.match(source, /if \(!canRecover && !privateFeatureBlocked\) return;/, 'safe owner recovery must be allowed even when the status snapshot itself did not report a private_feature_error');
assert.match(source, /takeOverLegacySetup\(\)/, 'the recovery UI must hide the legacy hosted-onboarding blocker when it owns the setup state');
assert.match(source, /Create sandbox test account/, 'the owner must get a direct sandbox Account recovery action');
assert.match(source, /SANDBOX_ACCOUNT_ONLY/, 'the UI must preserve the account-only, non-KYC marker');
assert.match(source, /Production money movement remains locked/, 'the recovery flow must remain fail-closed for real money');
assert.equal(source.includes('NEXT_PUBLIC_INCREASE'), false, 'the recovery UI must never depend on browser-exposed Increase credentials');

console.log('Galactic Trust recovery takeover regression passed: connected owner sandbox Accounts can use the dedicated Account-only recovery path without waiting for hosted-onboarding private-feature detection.');
