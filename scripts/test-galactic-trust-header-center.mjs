import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const center = await readFile(new URL('../app/bank/GalacticHeaderCenter.js', import.meta.url), 'utf8');
const gate = await readFile(new URL('../app/bank/GalacticBankGate.js', import.meta.url), 'utf8');

assert.match(center, /document\.querySelector\('\.gt-notification'\)/, 'header center must attach to the existing notification bell');
assert.match(center, /document\.querySelector\('\.gt-profile'\)/, 'header center must attach to the existing profile control');
assert.match(center, /fetch\('\/api\/bank\/lifecycle'/, 'notification state must reuse the sanitized personal lifecycle endpoint');
assert.match(center, /Authorization: `Bearer \$\{accessToken\}`/, 'signed-in lifecycle notifications must authenticate with the existing session token');
assert.match(center, /Increase sandbox test account connected/, 'notification center must clearly identify owner-bound sandbox state as test-only');
assert.match(center, /Production banking is locked/, 'notification center must keep the production lock visible');
assert.match(center, /Crypto is practice-only/, 'notification center must keep the crypto-practice boundary visible');
assert.match(center, /No production account opening or real-money movement is enabled in this build/, 'notification copy must not imply live-money capability');
assert.match(center, /href="\/bank\/status"/, 'header center must navigate to the personal account-status page');
assert.match(center, /href="\/privacy"/, 'profile menu must provide Privacy Center navigation');
assert.match(center, /href="\/bank\/readiness"/, 'profile menu must provide regulated launch-readiness navigation');
assert.match(center, /onSignOut\?\.\(\)/, 'profile menu must use the existing authenticated sign-out callback');
assert.equal(center.includes('/api/admin/'), false, 'header center must not consume owner/admin banking endpoints');
assert.equal(center.includes('accountId'), false, 'header center must never handle full provider Account IDs');
assert.equal(center.includes('entityId'), false, 'header center must never handle provider Entity IDs');
assert.equal(center.includes('INCREASE_SANDBOX_API_KEY'), false, 'header center must never handle provider credentials');
assert.equal(center.includes('NEXT_PUBLIC_'), false, 'header center must not depend on client-exposed banking secrets');

assert.match(gate, /import GalacticHeaderCenter from '\.\/GalacticHeaderCenter'/, 'dashboard gate must load the polished header center');
assert.match(gate, /<GalacticHeaderCenter accessToken=\{accessToken\} demoAccess=\{demoAccess\} accountLabel=\{label\} onSignOut=\{activeSignOut\} \/>/, 'dashboard gate must wire header center to the existing session and sign-out flow');

console.log('Galactic Trust header center checks passed: the notification bell and profile control now provide safe lifecycle/status navigation using only the personal lifecycle endpoint, while provider IDs, admin APIs, and banking secrets remain out of the header UI.');
