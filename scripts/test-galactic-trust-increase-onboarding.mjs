import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getIncreaseSandboxConfig } from '../lib/banking/increase-sandbox.js';

const disabled = getIncreaseSandboxConfig({});
assert.equal(disabled.environment, 'sandbox');
assert.equal(disabled.canMoveRealMoney, false);
assert.equal(disabled.productionSupported, false);

const configured = getIncreaseSandboxConfig({ GALACTIC_INCREASE_SANDBOX_ENABLED: 'true', INCREASE_SANDBOX_API_KEY: 'test-only' });
assert.equal(configured.enabled, true);
assert.equal(configured.credentialsConfigured, true);
assert.equal(configured.canMoveRealMoney, false);

const routeSource = await readFile(new URL('../app/api/admin/bank/increase/onboarding/route.ts', import.meta.url), 'utf8');
assert.match(routeSource, /requireGalacticTrustAdmin/, 'onboarding must be Galactic Trust owner-only');
assert.match(routeSource, /lib\/banking\/provider-account-binding\.js/, 'onboarding must use the Galactic Trust banking binding module');
assert.match(routeSource, /bindIncreaseSandboxAccount/, 'successful sandbox setup must bind the Increase account to the authenticated owner');
assert.match(routeSource, /auth\.user\.id/, 'provider binding must use the verified session user ID');
assert.match(routeSource, /not a real KYC\/CIP\/AML decision/, 'sandbox validation simulation must be disclosed');
assert.match(routeSource, /This is not real KYC approval/, 'sandbox completion must not imply production KYC');
assert.equal(routeSource.includes('NEXT_PUBLIC_INCREASE'), false, 'provider credentials must stay server-side');

const bindingSource = await readFile(new URL('../lib/banking/provider-account-binding.js', import.meta.url), 'utf8');
assert.match(bindingSource, /provider: 'increase'/);
assert.match(bindingSource, /environment: 'sandbox'/);
assert.match(bindingSource, /provider_kyc_status: 'SANDBOX_VALID_SIMULATION'/);
assert.doesNotMatch(bindingSource, /Dinari|dinari/, 'Galactic Trust provider binding must not carry the old securities provider implementation');

const setupSource = await readFile(new URL('../app/bank/GalacticSandboxSetup.js', import.meta.url), 'utf8');
assert.match(setupSource, /\/api\/admin\/bank\/increase\/onboarding/);
assert.match(setupSource, /This is not real KYC approval/);
assert.match(setupSource, /setProviderNextStep\(String\(onboardingPayload\?\.nextStep \|\| statusPayload\?\.nextStep/, 'dashboard setup must surface the server-provided provider next step');
assert.match(setupSource, /status\?\.capabilities\?\.programs\?\.available !== false/, 'hosted onboarding must respect Programs capability health');
assert.match(setupSource, /status\?\.capabilities\?\.entities\?\.available !== false/, 'hosted onboarding must respect Entities capability health');
assert.match(setupSource, /const canStartOwnerOnboarding = connected && onboardingReady/, 'dashboard must not offer hosted onboarding while provider onboarding capability is blocked');
assert.match(setupSource, /disabled=\{busy \|\| !onboardingReady/, 'onboarding controls must fail closed when provider capability is not ready');
assert.match(setupSource, /Increase sandbox onboarding is blocked/, 'dashboard must show an actionable blocked-onboarding state');
assert.match(setupSource, /Next step:/, 'blocked setup state must present a concrete next step');
assert.match(setupSource, /href="\/bank\/integrations"/, 'owner setup panel must link to the sanitized Integration Health center');
assert.equal(setupSource.includes('NEXT_PUBLIC_INCREASE'), false);

console.log('Galactic Trust Increase sandbox onboarding boundary passed.');
