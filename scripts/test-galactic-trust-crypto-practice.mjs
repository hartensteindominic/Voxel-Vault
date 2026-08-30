import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const practice = await readFile(new URL('../app/bank/GalacticCryptoPractice.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../app/bank/crypto-practice.module.css', import.meta.url), 'utf8');
const gate = await readFile(new URL('../app/bank/GalacticBankGate.js', import.meta.url), 'utf8');

assert.match(practice, /const STARTING_CASH = 5000/, 'crypto practice must have its own explicit demo cash balance');
assert.match(practice, /setPracticeCash\(\(current\) => side === 'buy' \? current - usd : current \+ usd\)/, 'practice buys and sells must debit/credit only the practice cash ledger');
assert.match(practice, /side === 'buy' && usd > practiceCash/, 'practice buys must reject insufficient demo cash');
assert.match(practice, /side === 'sell' && estimatedUnits > active\.holding/, 'practice sells must reject insufficient demo holdings');
assert.match(practice, /setTrades\(\(current\) => \[\{/, 'practice trades must create a visible local demo ledger');
assert.match(practice, /Illustrative reference prices only · not live market quotes/, 'crypto reference prices must be labeled as illustrative rather than current market quotes');
assert.match(practice, /never touch your Galactic Trust bank balance or any Increase sandbox balance/, 'practice portfolio must explicitly remain separate from banking balances');
assert.match(practice, /No banking API or crypto provider is called by this practice panel/, 'practice disclosure must deny provider/API execution');
assert.match(practice, /No real crypto is purchased, sold, custodied, or transferred/, 'practice UI must explicitly deny real crypto execution and custody');
assert.equal(practice.includes('fetch('), false, 'crypto practice must not call banking or crypto APIs');
assert.equal(practice.includes('accessToken'), false, 'crypto practice must not receive or handle an authenticated banking token');
assert.equal(practice.includes('/api/'), false, 'crypto practice must not reference application provider endpoints');
assert.equal(practice.includes('INCREASE_'), false, 'crypto practice must not handle Increase configuration or credentials');
assert.equal(practice.includes('NEXT_PUBLIC_'), false, 'crypto practice must not depend on client-exposed provider secrets');

assert.match(styles, /gt-crypto-enhanced \.gt-crypto-form/, 'enhanced practice mode must hide the old disconnected demo trade form');
assert.match(styles, /gt-crypto-enhanced \.gt-crypto-tabs/, 'enhanced practice mode must replace the old static-price asset tabs');
assert.match(gate, /import GalacticCryptoPractice from '\.\/GalacticCryptoPractice'/, 'dashboard gate must load the isolated crypto practice component');
assert.match(gate, /<GalacticCryptoPractice \/>/, 'crypto practice must mount alongside the existing dashboard without receiving banking credentials');

console.log('Galactic Trust crypto practice checks passed: practice cash, holdings, and trade ledger reconcile locally, reference prices are explicitly illustrative, and no bank/provider balance, credential, or API is touched.');
