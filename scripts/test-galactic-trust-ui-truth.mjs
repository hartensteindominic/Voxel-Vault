import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/bank/BankClient.js', import.meta.url), 'utf8');

assert.equal(source.includes("['pay-bills',"), false, 'unfinished Pay Bills must not appear as a finished primary-nav item');
assert.equal(source.includes("['investments',"), false, 'unfinished Investments must not appear as a finished primary-nav item');
assert.equal(source.includes("['goals',"), false, 'unfinished Goals must not appear as a finished primary-nav item');

assert.equal(source.includes('12.4%'), false, 'demo balance must not show a fabricated monthly growth percentage');
assert.equal(source.includes('8.7%'), false, 'spending insights must not show a fabricated monthly comparison');
assert.equal(source.includes('$623.10'), false, 'spending category totals must not be hard-coded');
assert.equal(source.includes('$312.45'), false, 'spending category totals must not be hard-coded');
assert.equal(source.includes('$210.75'), false, 'spending category totals must not be hard-coded');
assert.equal(source.includes('$198.50'), false, 'spending category totals must not be hard-coded');
assert.equal(source.includes('$241.54'), false, 'spending category totals must not be hard-coded');

assert.match(source, /const spendingCategories = useMemo\(/, 'spending categories should be derived from loaded transactions');
assert.match(source, /Derived from Increase sandbox activity/, 'sandbox spending provenance must be explicit');
assert.match(source, /Derived from demo activity/, 'demo spending provenance must be explicit');
assert.match(source, /DEMO BALANCE/, 'illustrative balances must be labeled as demo');
assert.match(source, /Demo Checking/, 'illustrative checking account must be labeled as demo');
assert.match(source, /Demo Savings/, 'illustrative savings account must be labeled as demo');
assert.match(source, /DEMO CARD/, 'visual card must be labeled as demo');
assert.match(source, /PREVIEW/, 'visual card must be labeled as preview');
assert.equal(source.includes("{pink ? 'MC' : 'VISA'}"), false, 'demo card must not imply a live card-network relationship');
assert.match(source, /Search coming soon/, 'inactive search must be presented honestly');

console.log('Galactic Trust UI truth checks passed.');
