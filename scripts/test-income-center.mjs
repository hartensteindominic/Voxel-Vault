import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeObservedIncome, summarizeObservedIncome } from '../lib/vault/income.js';

const records = normalizeObservedIncome([
  { id: 'usd-1', symbol: 'VNQ', amount: 1.25, currency: 'USD', payableDate: '2026-08-20', status: 'PAID' },
  { id: 'usd-2', symbol: 'O', amount: 0.75, currency: 'USD', payableDate: '2026-08-22', status: 'PAID' },
  { id: 'eur-1', symbol: 'REET', amount: 2, currency: 'EUR', payableDate: '2026-08-21', status: 'PROCESSED' },
  { id: 'zero', symbol: 'ZERO', amount: 0, currency: 'USD', payableDate: '2026-08-23' },
  { id: 'negative', symbol: 'NEG', amount: -4, currency: 'USD', payableDate: '2026-08-24' },
], {
  provider: 'Dinari',
  environment: 'sandbox',
  accountScope: 'user-bound',
});

assert.equal(records.length, 3, 'zero and negative provider amounts must not become Income Center objects');
assert.equal(records[0].id, 'usd-2', 'records should sort by provider payable date, newest first');
assert.equal(records.every((record) => record.truthLabel === 'USER-BOUND PROVIDER PAYMENT'), true);
assert.equal(records.every((record) => /not property rent or a deed-linked distribution/i.test(record.note)), true);
assert.equal(records.every((record) => /USER BOUND/.test(record.sourceLabel)), true);

const summary = summarizeObservedIncome(records);
assert.equal(summary.count, 3);
assert.equal(summary.usdObserved, 2, 'USD summary must add USD records only');
assert.equal(summary.currencyCount, 2);
assert.deepEqual(summary.currencies, [
  { currency: 'EUR', amount: 2 },
  { currency: 'USD', amount: 2 },
]);
assert.equal(summary.latestPayableDate, new Date('2026-08-22').toISOString());

const page = readFileSync(new URL('../app/vault/income/page.js', import.meta.url), 'utf8');
assert.match(page, /\/api\/vault\/digital-reits/, 'personal Income Center must use the authenticated user-bound provider endpoint');
assert.doesNotMatch(page, /fetch\(['"]\/api\/digital-reits['"]/, 'personal Income Center must never inherit the global pilot provider account');
assert.match(page, /does not project yield/i, 'Income Center must explicitly refuse yield projection');
assert.match(page, /does not manufacture an exchange rate/i, 'Income Center must not convert currencies using an invented FX rate');
assert.match(page, /DIRECT PROPERTY DISTRIBUTIONS · LOCKED/, 'direct-property distributions must remain visibly locked');
assert.match(page, /Rent is not a REIT dividend/, 'security dividends and property rent must remain distinct');
assert.match(page, /SANDBOX DATA/, 'sandbox provider records must be visibly identified as test data');

const portal = readFileSync(new URL('../app/vault/VaultPortalNav.js', import.meta.url), 'utf8');
assert.match(portal, /\/vault\/income/, 'My Vault must expose a persistent path into the Income Center');

console.log('Income Center checks passed: only positive user-bound provider payment records enter the room, currencies remain separate, no yield/FX is invented, and direct-property distributions stay locked.');
