import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../app/bank/integrations/page.js', import.meta.url), 'utf8');
const route = await readFile(new URL('../app/api/admin/bank/integration-health/route.ts', import.meta.url), 'utf8');
const enhancements = await readFile(new URL('../app/bank/GalacticDashboardEnhancements.js', import.meta.url), 'utf8');

assert.match(route, /requireGalacticTrustAdmin/, 'integration health API must be owner/admin authenticated');
assert.match(route, /inspectIncreaseSandbox/, 'integration health must inspect the configured Increase sandbox server-side');
assert.match(route, /getProviderAccountBinding\(auth\.admin, auth\.user\.id/, 'owner binding health must be scoped to the verified signed-in owner');
assert.match(route, /publicBindingSummary/, 'provider binding returned to the client must use the masked public summary');
assert.match(route, /ensureIncreaseSandboxWebhookSubscription/, 'integration health must inspect/ensure the sandbox webhook subscription server-side');
assert.match(route, /getIncreaseReconciliationStatus/, 'integration health must report reconciliation state');
assert.match(route, /pollIncreaseSandboxEvents\(\{ maxPages: 5, forceReconcile: true \}\)/, 'owner health center must support a bounded forced sandbox reconciliation');
assert.match(route, /bankingLaunchSnapshot/, 'integration health must derive the production lock from the regulated-launch policy');
assert.match(route, /canMoveRealMoney: false/, 'integration health must remain explicitly incapable of real-money movement');
assert.match(route, /SANDBOX_VALID_SIMULATION is not real KYC\/CIP\/AML approval/, 'integration health API must preserve the sandbox-validation boundary');
assert.equal(route.includes('INCREASE_SANDBOX_API_KEY'), false, 'integration health route must not embed or return provider secret names/values');
assert.equal(route.includes('eventId:'), false, 'client health payload must not expose provider event IDs');
assert.equal(route.includes('programId:'), false, 'client health payload must not expose provider Program IDs');
assert.equal(route.includes('entityId:'), false, 'client health payload must not expose provider Entity IDs');
assert.equal(route.includes('accountId:'), false, 'client health payload must not expose full provider Account IDs');

assert.match(page, /getSupabaseBrowserAsync/, 'integration health page must derive its bearer token from the authenticated Supabase session');
assert.match(page, /fetch\('\/api\/admin\/bank\/integration-health'/, 'integration health page must use the sanitized owner API');
assert.match(page, /Authorization: `Bearer \$\{token\}`/, 'integration health request must carry the verified session token');
assert.match(page, /OWNER OPERATIONS · SANDBOX ONLY/, 'owner operations surface must clearly identify the sandbox boundary');
assert.match(page, /REAL MONEY[^]*LOCKED/, 'integration health UI must visibly show real money as locked');
assert.match(page, /Production banking remains fail-closed/, 'integration health UI must preserve fail-closed production messaging');
assert.match(page, /Run sandbox reconciliation/, 'owner operations UI must expose the safe sandbox reconciliation action');
assert.match(page, /SANDBOX_VALID_SIMULATION is not real KYC\/CIP\/AML approval/, 'integration UI must not portray sandbox validation as regulated approval');
assert.equal(page.includes('/api/admin/bank/increase/onboarding'), false, 'browser must not consume the raw onboarding payload');
assert.equal(page.includes('/api/admin/bank/increase/reconciliation'), false, 'browser must not consume the raw reconciliation payload');
assert.equal(page.includes('/api/admin/bank/increase/status'), false, 'browser must consume only the sanitized integration-health summary');
assert.equal(page.includes('accountId'), false, 'integration health UI must not handle full provider Account IDs');
assert.equal(page.includes('entityId'), false, 'integration health UI must not handle full provider Entity IDs');
assert.equal(page.includes('programId'), false, 'integration health UI must not handle provider Program IDs');
assert.equal(page.includes('apiKey'), false, 'integration health UI must never handle provider API keys');

assert.match(enhancements, /id: 'integration-health'[^]*label: 'Integration health'/, 'dashboard command palette must expose the owner integration-health destination');
assert.match(enhancements, /window\.location\.assign\('\/bank\/integrations'\)/, 'integration health command must route to /bank/integrations');

console.log('Galactic Trust integration health checks passed: owner-only sanitized provider health, binding status, webhook/reconciliation operations, and fail-closed production state are available without exposing provider secrets or full provider identifiers to the browser.');
