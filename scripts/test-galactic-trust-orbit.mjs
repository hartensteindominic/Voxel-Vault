import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const orbit = await readFile(new URL('../lib/banking/orbit-chat.js', import.meta.url), 'utf8');
const route = await readFile(new URL('../app/api/bank/orbit/route.ts', import.meta.url), 'utf8');
const bankClient = await readFile(new URL('../app/bank/BankClient.js', import.meta.url), 'utf8');

assert.match(orbit, /OrbitAsyncReply/, 'Orbit must support async conversational replies without replacing the dashboard component');
assert.match(orbit, /fetch\('\/api\/bank\/orbit'/, 'Orbit must use the server-side conversational endpoint');
assert.match(orbit, /orbitConversation/, 'Orbit must preserve bounded recent conversation context for follow-up questions');
assert.match(orbit, /previousIntent/, 'local fallback must understand basic follow-up context');
assert.match(orbit, /local\.intent === 'sensitive-data'/, 'sensitive credential questions must stay local instead of being sent to the AI endpoint');
assert.match(orbit, /transactions: Array\.isArray\(context\.transactions\)[^]*slice\(0, 6\)/, 'Orbit must send only a bounded sanitized activity snapshot');
assert.doesNotMatch(orbit, /accountId|entityId|programId|apiKey/, 'client Orbit context must not contain provider IDs or API keys');

assert.match(route, /https:\/\/api\.openai\.com\/v1\/responses/, 'server Orbit must use the Responses API directly without adding an SDK dependency');
assert.match(route, /process\.env\.OPENAI_API_KEY/, 'the AI credential must remain server-only');
assert.match(route, /process\.env\.ORBIT_OPENAI_MODEL/, 'the production model must be server-configurable');
assert.match(route, /store: false/, 'Orbit responses must opt out of API response storage');
assert.match(route, /MAX_REQUESTS = 18/, 'public/demo Orbit must have a bounded server-side abuse guard');
assert.match(route, /SECRET_CUE/, 'the server must independently reject secret-bearing prompts');
assert.match(route, /canMoveRealMoney: false/, 'Orbit must explicitly remain unable to move real money');
assert.match(route, /You are read-only conversational help/, 'Orbit system instructions must forbid transaction execution claims');
assert.match(route, /financial technology product, not a bank/, 'Orbit must preserve the non-bank disclosure in its AI instructions');
assert.match(route, /Increase sandbox only/, 'Orbit must preserve the pretend-money sandbox boundary');
assert.doesNotMatch(route, /\/api\/admin\/bank\/increase\/(?:fund|transfer)/, 'the conversational route must not call money-action endpoints');

assert.match(bankClient, /buildOrbitResponse/, 'the existing dashboard must continue to use the Orbit response boundary');
assert.equal(bankClient.includes('OPENAI_API_KEY'), false, 'the dashboard bundle must never reference the server AI key');

console.log('Galactic Trust Orbit checks passed: conversational AI is server-side, context-aware, bounded, secret-safe, read-only, and retains the local fintech-safe fallback.');
