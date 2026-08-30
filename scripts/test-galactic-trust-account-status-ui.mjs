import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../app/bank/status/page.js', import.meta.url), 'utf8');
const enhancements = await readFile(new URL('../app/bank/GalacticDashboardEnhancements.js', import.meta.url), 'utf8');
const lifecycleRoute = await readFile(new URL('../app/api/bank/lifecycle/route.ts', import.meta.url), 'utf8');

assert.match(page, /getSupabaseBrowserAsync/, 'account status UI must derive its bearer session from the authenticated Supabase browser session');
assert.match(page, /fetch\('\/api\/bank\/lifecycle'/, 'account status UI must read the server-derived lifecycle endpoint');
assert.match(page, /Authorization: `Bearer \$\{token\}`/, 'lifecycle request must send the authenticated session token');
assert.match(page, /DEMO ONLY/, 'account status UI must explicitly represent demo-only users');
assert.match(page, /INCREASE SANDBOX · TEST ACCOUNT/, 'owner-scoped sandbox state must be labeled as a test account');
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

assert.match(lifecycleRoute, /admin\.auth\.getUser\(token\)/, 'status UI source endpoint must continue to verify the session server-side');
assert.match(lifecycleRoute, /getProviderAccountBinding\(admin, user\.id/, 'status UI source endpoint must scope binding to the verified user');
assert.match(lifecycleRoute, /not a bank-account approval or production eligibility decision/, 'server lifecycle source must retain the production-eligibility disclaimer');

console.log('Galactic Trust account status UI checks passed: personal lifecycle and regulated launch readiness stay distinct, sandbox ownership is labeled as test-only, production banking remains visibly unsupported, provider IDs/secrets stay out of the client, and the dashboard exposes both destinations clearly.');
