import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../app/bank/status/page.js', import.meta.url), 'utf8');
const enhancements = await readFile(new URL('../app/bank/GalacticDashboardEnhancements.js', import.meta.url), 'utf8');
const dashboardState = await readFile(new URL('../app/bank/GalacticDashboardAccountState.js', import.meta.url), 'utf8');
const bankGate = await readFile(new URL('../app/bank/GalacticBankGate.js', import.meta.url), 'utf8');
const lifecycleRoute = await readFile(new URL('../app/api/bank/lifecycle/route.ts', import.meta.url), 'utf8');

assert.match(page, /getSupabaseBrowserAsync/, 'account status UI must derive its bearer session from the authenticated Supabase browser session');
assert.match(page, /fetch\('\/api\/bank\/lifecycle'/, 'account status UI must read the server-derived lifecycle endpoint');
assert.match(page, /Authorization: `Bearer \$\{token\}`/, 'lifecycle request must send the authenticated session token');
assert.match(page, /DEMO MODE · SIMULATED/, 'account status UI must explicitly identify simulated demo mode');
assert.match(page, /Demo Mode — simulated balances and transfers/, 'demo status must explain what is simulated');
assert.match(page, /INCREASE SANDBOX · TEST ACCOUNT/, 'owner-scoped sandbox state must be labeled as a test account');
assert.match(page, /INCREASE SANDBOX · ACCOUNT-ONLY TEST/, 'account-only owner recovery must have a distinct sandbox-only state');
assert.match(page, /sandbox-account-only/, 'account status UI must recognize the lifecycle account-only validation kind');
assert.match(page, /ACCOUNT-ONLY RECOVERY/, 'account-only recovery must never fall through to a NONE validation label');
assert.match(page, /SETUP REQUIRED/, 'binding infrastructure failure must have a visible setup-required state');
assert.match(page, /This is not a production bank account/, 'sandbox-bound state must disclaim production banking');
assert.match(page, /Real money[^]*NO/, 'sandbox provider card must explicitly deny real-money capability');
assert.match(page, /Customer account opening[^]*NOT SUPPORTED/, 'production account opening must be shown as unsupported by default');
assert.match(page, /Real-money movement[^]*NOT SUPPORTED/, 'production money movement must be shown as unsupported by default');
assert.match(page, /Production remains fail-closed/, 'status page must show a fail-closed production summary');
assert.match(page, /not a bank-account approval, KYC decision, credit decision/, 'status page must disclose that lifecycle state is not regulated approval');
assert.match(page, /href="\/bank\/readiness"/, 'account status UI must keep regulated launch readiness as a separate destination');
assert.equal(page.includes('accountId'), false, 'personal status UI must never handle full provider Account IDs');
assert.equal(page.includes('entityId'), false, 'personal status UI must never handle full provider Entity IDs');
assert.equal(page.includes('INCREASE_SANDBOX_API_KEY'), false, 'personal status UI must never read provider credentials');
assert.equal(page.includes('NEXT_PUBLIC_'), false, 'personal status UI must not depend on client-exposed banking secrets');

assert.match(enhancements, /id: 'account-status'[^]*label: 'My account status'/, 'dashboard command palette must expose the personal account-status destination');
assert.match(enhancements, /id: 'launch-status'[^]*label: 'Regulated launch status'/, 'dashboard must preserve a separate launch-readiness destination');
assert.match(enhancements, /window\.location\.assign\('\/bank\/status'\)/, 'personal account-status command must route to /bank/status');
assert.match(enhancements, /window\.location\.assign\('\/bank\/readiness'\)/, 'regulated launch command must route to /bank/readiness');
assert.match(enhancements, /View your account status →/, 'dashboard trust strip must link to personal account status');
assert.match(enhancements, /View regulated launch status →/, 'dashboard trust strip must separately link to regulated launch readiness');
assert.match(enhancements, /Illustrative demo trend/, 'balance enhancement must label its synthetic trend as illustrative demo data');

assert.match(dashboardState, /document\.querySelector\('\.gt-balance-hero'\)/, 'dashboard account state must attach to the primary balance hero');
assert.match(dashboardState, /fetch\('\/api\/bank\/lifecycle'/, 'dashboard account state must reuse the server-derived lifecycle endpoint');
assert.match(dashboardState, /Authorization: `Bearer \$\{accessToken\}`/, 'dashboard account state must authenticate lifecycle reads with the signed-in session token');
assert.match(dashboardState, /DEMO MODE/, 'dashboard must visibly distinguish demo mode');
assert.match(dashboardState, /INCREASE SANDBOX/, 'dashboard must visibly distinguish an Increase sandbox test-account state');
assert.match(dashboardState, /SETUP REQUIRED/, 'dashboard must visibly distinguish infrastructure setup-required state');
assert.match(dashboardState, /REAL MONEY LOCKED/, 'dashboard account-state indicator must keep the real-money lock visible');
assert.match(dashboardState, /href="\/bank\/status"/, 'dashboard account-state indicator must link to the full personal status page');
assert.equal(dashboardState.includes('accountId'), false, 'dashboard account-state indicator must not handle full provider Account IDs');
assert.equal(dashboardState.includes('entityId'), false, 'dashboard account-state indicator must not handle provider Entity IDs');
assert.equal(dashboardState.includes('INCREASE_SANDBOX_API_KEY'), false, 'dashboard account-state indicator must not read provider credentials');
assert.equal(dashboardState.includes('NEXT_PUBLIC_'), false, 'dashboard account-state indicator must not depend on client-exposed banking secrets');
assert.match(bankGate, /GalacticDashboardAccountState accessToken=\{accessToken\} demoAccess=\{demoAccess\}/, 'authenticated dashboard gate must mount the server-derived account-state indicator');

assert.match(lifecycleRoute, /admin\.auth\.getUser\(token\)/, 'status UI source endpoint must continue to verify the session server-side');
assert.match(lifecycleRoute, /getProviderAccountBinding\(admin, user\.id/, 'status UI source endpoint must scope binding to the verified user');
assert.match(lifecycleRoute, /not a bank-account approval or production eligibility decision/, 'server lifecycle source must retain the production-eligibility disclaimer');

console.log('Galactic Trust account status UI checks passed: demo, hosted sandbox simulation, and account-only recovery states are distinct; personal lifecycle and regulated launch readiness stay separate; production banking remains visibly unsupported; and provider IDs/secrets stay out of the client.');
