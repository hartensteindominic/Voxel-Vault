import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MONEY_LAYERS, MONEY_ROUTES, getMoneyRoute } from '../lib/money-routes.js';

assert.deepEqual(MONEY_LAYERS.map((layer) => layer.id), ['usd', 'crypto', 'property'], 'Money Hub must keep exactly three visibly separate source/ledger layers.');
assert.equal(MONEY_LAYERS.find((layer) => layer.id === 'usd')?.custody, 'regulated-partner-required', 'USD custody must fail closed until a regulated partner exists.');
assert.equal(MONEY_LAYERS.find((layer) => layer.id === 'crypto')?.custody, 'user-controlled-wallet', 'Crypto must remain self-custodied.');
assert.equal(MONEY_LAYERS.find((layer) => layer.id === 'property')?.custody, 'account-first-optional-chain', 'Digital property must remain account-first with optional blockchain portability.');

assert.equal(MONEY_ROUTES.length, 5, 'The conversion desk must cover the requested USD, crypto, NFT and property paths.');
assert.ok(MONEY_ROUTES.every((route) => route.guarantee === false), 'No value-conversion route may promise a buyer, price, liquidity or payout.');
assert.equal(getMoneyRoute('usd-to-digital-property')?.live, true, 'Server-authoritative USD digital-property checkout may be presented as available with review.');
assert.equal(getMoneyRoute('digital-property-to-nft')?.live, true, 'An owner may choose the existing optional mint path.');
assert.equal(getMoneyRoute('nft-to-usdc')?.live, false, 'NFT cash-out must not be called live without a real market sale and buyer.');
assert.equal(getMoneyRoute('usdc-to-usd')?.state, 'regulated-offramp-required', 'Crypto-to-USD must remain behind an approved off-ramp.');
assert.equal(getMoneyRoute('property-security-to-cash')?.state, 'regulated-market-required', 'Property-security liquidity must remain controlled by the approved provider/market.');

const page = fs.readFileSync(new URL('../app/vault/money/page.js', import.meta.url), 'utf8');
assert.match(page, /MONEY HUB · ONE VIEW, THREE SEPARATE SYSTEMS/, 'Money Hub must lead with separated-system truth.');
assert.match(page, /No fake “total balance.”/, 'Money Hub must refuse to invent an aggregate value across unlike assets.');
assert.match(page, /No bank balance connected/, 'USD must not display a fabricated balance.');
assert.match(page, /Voxel Vault is not the bank and does not hold customer USD/, 'USD UI must state the custody boundary plainly.');
assert.match(page, /\/api\/digital-estates\/mine/, 'Account-owned Digital Properties must come from the authenticated ownership API.');
assert.match(page, /0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/, 'Wallet view must read native Base USDC.');
assert.match(page, /provider\.getBalance\(checksum\)/, 'Wallet ETH must come from the Base provider rather than a mock balance.');
assert.match(page, /usdc\.balanceOf\(checksum\)/, 'Wallet USDC must come from the token contract rather than a mock balance.');
assert.doesNotMatch(page, /eth_sendTransaction|wallet_sendCalls|transfer\(/, 'Money Hub balance display and routing cards must never initiate a wallet transfer.');
assert.match(page, /cannot move funds without a separate wallet approval/, 'Self-custody boundary must be visible beside wallet balances.');
assert.match(page, /It is not itself a chartered bank, exchange, broker-dealer, money transmitter, custodian or guaranteed buyer/, 'Product boundary must remain explicit.');

console.log('Money Hub checks passed: USD provider, self-custody crypto and account/NFT property stay separate; cash-out routes disclose their actual market or regulated-provider dependency.');
