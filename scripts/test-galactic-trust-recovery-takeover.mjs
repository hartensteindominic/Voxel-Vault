import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/bank/GalacticIncreaseSandboxRecovery.js', import.meta.url), 'utf8');
const legacySetup = await readFile(new URL('../app/bank/GalacticSandboxSetup.js', import.meta.url), 'utf8');
const recoveryRoute = await readFile(new URL('../app/api/admin/bank/increase/recovery/route.ts', import.meta.url), 'utf8');

assert.match(source, /const connected = Boolean\(statusResponse\.ok && status\?\.connected\)/, 'recovery takeover must require a confirmed Increase sandbox Accounts connection');
assert.match(source, /recoveryResponse\.ok &&\s*recovery\?\.recoveryAvailable/, 'recovery takeover must honor the owner recovery endpoint instead of depending only on hosted-onboarding capability detection');
assert.match(source, /if \(!canRecover && !privateFeatureBlocked\) return;/, 'safe owner recovery must be allowed even when the status snapshot itself did not report a private_feature_error');
assert.equal(source.includes('!storageBlocked'), false, 'provider-binding storage must not gate Account-only recovery');
assert.match(source, /Durable database binding is optional for this sandbox recovery/, 'the UI must explain that durable database binding is optional for owner sandbox recovery');
assert.match(source, /takeOverLegacySetup\(\)/, 'the recovery UI must hide the legacy hosted-onboarding blocker when it owns the setup state');
assert.match(source, /Create sandbox test account/, 'the owner must get a direct sandbox Account recovery action');
assert.match(source, /aria-busy=\{busy\}/, 'the recovery action must expose its busy state accessibly');
assert.match(source, /SANDBOX_ACCOUNT_ONLY/, 'the UI must preserve the account-only, non-KYC marker');
assert.match(source, /Production money movement remains locked/, 'the recovery flow must remain fail-closed for real money');
assert.equal(source.includes('NEXT_PUBLIC_INCREASE'), false, 'the recovery UI must never depend on browser-exposed Increase credentials');

assert.match(recoveryRoute, /bindingStorageReady: state \? !state\.setupRequired : false/, 'recovery status errors must distinguish provider trouble from durable binding-storage readiness');
assert.match(recoveryRoute, /dashboardReady: Boolean\(recovered\.dashboard\)/, 'recovery POST must report whether the owner sandbox dashboard was immediately readable');
assert.match(recoveryRoute, /canMoveRealMoney: false/, 'recovery API must remain sandbox-only and fail-closed for real money');

assert.match(legacySetup, /fetch\('\/api\/admin\/bank\/increase\/recovery'/, 'legacy hosted setup must consult the owner recovery endpoint directly');
assert.match(legacySetup, /const \[statusPayload, onboardingPayload, recoveryPayload\]/, 'legacy setup must evaluate recovery status alongside its own read-only setup status');
assert.match(legacySetup, /recoveryPayload\?\.binding\?\.status === 'verified' \|\| recoveryPayload\?\.recoveryAvailable/, 'verified or available owner recovery must own setup');
assert.match(legacySetup, /if \(!accessToken \|\| authorized !== true \|\| recoveryOwnsSetup\) return null;/, 'legacy hosted setup must render nothing when Account-only recovery owns the flow');
assert.match(legacySetup, /!returnedEntity/, 'a user returning from an already-started hosted onboarding session must still be allowed to finish that explicit flow');
assert.equal(legacySetup.includes('NEXT_PUBLIC_INCREASE'), false, 'legacy setup must not introduce browser-exposed provider credentials');

console.log('Galactic Trust recovery takeover regression passed: connected owner sandbox Accounts can use database-independent Account-only recovery, provider failures remain distinguishable, and the legacy hosted-onboarding panel defers to the dedicated owner path.');
