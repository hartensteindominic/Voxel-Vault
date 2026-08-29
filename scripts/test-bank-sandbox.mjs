import fs from 'node:fs';
import assert from 'node:assert/strict';

const page = fs.readFileSync(new URL('../app/bank/page.js', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../app/bank/BankClient.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/bank/bank.css', import.meta.url), 'utf8');

assert.match(page, /sandbox/i, 'bank metadata must identify the experience as a sandbox');
assert.match(page, /No real funds move/i, 'metadata must preserve the no-real-funds boundary');

assert.match(client, /DEMO · NOT MONEY|SANDBOX FINANCE · NOT MONEY/, 'bank UI must visibly identify demo balances as not money');
assert.match(client, /No deposit is held, no payment is sent, and no debit or credit card is issued/, 'bank UI must explain the regulated execution boundary');
assert.match(client, /Simulate transfer/, 'money movement CTA must remain explicitly simulated');
assert.match(client, /No ACH, wire, card payment/, 'transfer flow must disclose that no payment rail is invoked');
assert.match(client, /Payment account number[\s\S]*NOT ISSUED/, 'digital card details must state that no PAN is issued');
assert.match(client, /Security code[\s\S]*NOT ISSUED/, 'digital card details must state that no security code is issued');
assert.match(client, /does not generate a PAN, CVV, expiry, payment-network credential, or usable card/, 'digital-card creation must disclose that it is UI-only');
assert.match(client, /Regulated banking \/ money-movement partner/, 'production gate must name the regulated banking rail');
assert.match(client, /Identity, KYC, and eligibility/, 'production gate must name identity and eligibility controls');
assert.match(client, /Ledger, reconciliation, and fraud controls/, 'production gate must name ledger and fraud controls');
assert.match(client, /Approved card issuer \/ processor/, 'production gate must name the card issuer or processor requirement');

assert.doesNotMatch(client, /\bVISA\b|\bMASTERCARD\b|\bAMEX\b/i, 'sandbox must not claim a live card network');
assert.doesNotMatch(client, /\b(?:\d[ -]*?){13,19}\b/, 'sandbox source must not contain a realistic 13-19 digit payment card number');
assert.doesNotMatch(client, /fetch\s*\(|XMLHttpRequest|eth_sendTransaction|checkout\.sessions\.create/, 'sandbox UI must not initiate network or payment execution');
assert.match(css, /safe-area-inset-bottom|@media/, 'bank UI should keep responsive mobile behavior');

console.log('Voxel Bank sandbox safety test passed.');
