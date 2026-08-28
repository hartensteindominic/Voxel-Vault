import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DIGITAL_ESTATES, STRIPE_MAX_USD_CENTS } from '../lib/digital-estates.js';

assert.ok(DIGITAL_ESTATES.length >= 5, 'Digital Estates should launch with a meaningful first district.');
assert.equal(new Set(DIGITAL_ESTATES.map((estate) => estate.id)).size, DIGITAL_ESTATES.length, 'Estate IDs must be unique.');
assert.equal(new Set(DIGITAL_ESTATES.map((estate) => estate.purchasePriceCents)).size, DIGITAL_ESTATES.length, 'Estate prices should remain distinct.');
for (const estate of DIGITAL_ESTATES) {
  assert.equal(estate.purchasePriceCents, estate.referenceValueCents, `${estate.id} must keep matching digital/reference pricing in this phase.`);
  assert.ok(Number.isInteger(estate.purchasePriceCents) && estate.purchasePriceCents > 0, `${estate.id} must have a valid server price.`);
  assert.ok(estate.purchasePriceCents <= STRIPE_MAX_USD_CENTS, `${estate.id} must stay within the hosted USD rail limit.`);
}

const checkout = fs.readFileSync(new URL('../app/api/digital-estates/checkout/route.ts', import.meta.url), 'utf8');
assert.match(checkout, /getDigitalEstate\(body\?\.estateId\)/, 'Checkout must load the server catalog by estate ID.');
assert.match(checkout, /unit_amount: estate\.purchasePriceCents/, 'Checkout amount must come from the server catalog.');
assert.doesNotMatch(checkout, /body\?\.(price|amount|purchasePrice)/, 'Browser-supplied prices must never drive checkout.');
assert.match(checkout, /isDigitalEstateMinted\(estate\.id\)/, 'Checkout must verify onchain inventory before payment.');
assert.match(checkout, /acquireDigitalEstateReservation/, 'Checkout must acquire a unique reservation before payment.');
assert.match(checkout, /previous\.payment_status === 'paid'/, 'An existing Stripe hold must reconcile against Stripe paid state.');
assert.match(checkout, /previous\.status === 'expired'/, 'Expired Stripe holds must be releasable.');
assert.doesNotMatch(checkout, /payment_method_types\s*:/, 'Hosted Checkout should use dynamic eligible payment methods.');
assert.match(checkout, /digital_only_no_real_property_rights/, 'Checkout metadata must preserve the rights boundary.');
assert.match(checkout, /minting: 'optional_after_purchase'/, 'Checkout must record that minting is optional.');
assert.doesNotMatch(checkout, /digitalEstateMintReady/, 'Optional mint readiness must never block buying.');

const reservation = fs.readFileSync(new URL('../lib/digital-estate-reservations.ts', import.meta.url), 'utf8');
assert.match(reservation, /PROVIDER = 'digital-estate-reservation'/, 'Reservations must use a dedicated provider namespace.');
assert.match(reservation, /\['paid', 'paid-usdc', 'minted'\]/, 'Paid purchase states must remain permanent ownership locks.');
assert.match(reservation, /if \(reservation\.state === 'checkout'\) return false;/, 'Stripe checkout holds must be resolved from Stripe rather than a local timer.');
assert.match(reservation, /Digital estate reservation changed concurrently/, 'Concurrent reservation writes must fail closed.');

const purchase = fs.readFileSync(new URL('../lib/digital-estate-purchases.ts', import.meta.url), 'utf8');
assert.match(purchase, /session\.payment_status !== 'paid'/, 'Stripe purchase security must require Stripe paid state.');
assert.match(purchase, /Number\(session\.amount_total\) !== estate\.purchasePriceCents/, 'Stripe purchase security must verify exact amount.');
assert.match(purchase, /expectedBuyerId && buyerId !== expectedBuyerId/, 'Stripe purchase security must remain account-bound.');
assert.match(purchase, /0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/, 'Base USDC verification must pin Circle native USDC.');
assert.match(purchase, /getAddress\(transaction\.from\) !== wallet/, 'USDC verification must verify sender.');
assert.match(purchase, /getAddress\(transaction\.to\) !== getAddress\(BASE_USDC\)/, 'USDC verification must verify token contract.');
assert.match(purchase, /from === wallet && to === recipient && value === expectedUnits/, 'USDC verification must verify exact sender, recipient and amount.');
assert.match(purchase, /digital-estate-usdc-payment/, 'USDC transaction hashes must be one-time idempotency keys.');
assert.match(purchase, /state: 'paid'/, 'Verified Stripe payment must lock ownership before minting.');
assert.match(purchase, /state: 'paid-usdc'/, 'Verified USDC payment must lock ownership before minting.');
assert.doesNotMatch(purchase, /buildDigitalEstateVoucher|signMessage/, 'Payment security helper must not mint or issue mint vouchers.');

const mint = fs.readFileSync(new URL('../lib/digital-estate-mint.ts', import.meta.url), 'utf8');
assert.match(mint, /voxel-vault:digital-estate:\$\{String\(estateId/, 'Voucher ID must be deterministic from estate identity.');
assert.doesNotMatch(mint, /sessionId|txHash/, 'Estate voucher ID must not depend on payment identifiers.');
assert.match(mint, /usedVouchers/, 'Onchain uniqueness must read VoxelFlip voucher state.');
assert.match(mint, /signMessage/, 'Optional minting must use the reviewed signed-voucher path.');

const claim = fs.readFileSync(new URL('../app/api/digital-estates/claim/route.ts', import.meta.url), 'utf8');
assert.match(claim, /action === 'secure'/, 'Claim API must expose purchase security separately from minting.');
assert.match(claim, /ownershipSecured: true/, 'Secure and mint responses must preserve purchase ownership state.');
assert.match(claim, /source === 'owned'/, 'A secured owner must be able to return later for optional minting.');
assert.match(claim, /\['paid', 'paid-usdc', 'minted'\]/, 'Later minting must require a permanent paid ownership state.');
assert.match(claim, /digitalEstateMintReady\(\)/, 'Mint readiness must be checked only for optional mint preparation.');
assert.match(claim, /buildDigitalEstateVoucher/, 'Optional mint action must issue the reviewed voucher only after ownership checks.');

const crypto = fs.readFileSync(new URL('../app/api/digital-estates/crypto-config/route.ts', import.meta.url), 'utf8');
assert.doesNotMatch(crypto, /digitalEstateMintReady/, 'Optional mint readiness must not block a USDC purchase.');
assert.match(crypto, /isDigitalEstateMinted/, 'USDC purchase must preflight onchain uniqueness.');
assert.match(crypto, /acquireDigitalEstateReservation/, 'USDC purchase must reserve inventory before showing transfer details.');
assert.match(crypto, /BigInt\(estate\.purchasePriceCents\) \* BigInt\(10_000\)/, 'USD cents must convert exactly to 6-decimal USDC units.');
assert.match(crypto, /mintOptional: true/, 'USDC preflight must describe minting as optional.');

const metadata = fs.readFileSync(new URL('../app/api/digital-estates/metadata/route.ts', import.meta.url), 'utf8');
assert.match(metadata, /Real Property Rights.*None/s, 'NFT metadata must state that real-property rights are absent.');
assert.match(metadata, /reference_value_is_appraisal: false/, 'Metadata must never present reference pricing as an appraisal.');

const page = fs.readFileSync(new URL('../app/vault/estates/page.js', import.meta.url), 'utf8');
assert.match(page, /REAL-WORLD REFERENCE/);
assert.match(page, /DIGITAL ESTATE LIST PRICE/);
assert.match(page, /REAL PAYMENT · PAY SECURELY/);
assert.match(page, /REAL PAYMENT · PAY USDC ON BASE/);
assert.match(page, /action:'secure'/, 'USDC payment must stop at secured ownership.');
assert.match(page, /PURCHASED & SECURED/, 'Showroom must visibly distinguish purchase from minting.');
assert.match(page, /SAFE TESTNET LAND/, 'Showroom must provide a no-real-purchase testing path.');
assert.doesNotMatch(page, /mintVoxelFlip/, 'The purchase showroom must never auto-mint after payment.');

const success = fs.readFileSync(new URL('../app/vault/estates/success/page.js', import.meta.url), 'utf8');
assert.match(success, /source: 'stripe', action: 'secure'/, 'Hosted checkout return must secure purchase before minting.');
assert.match(success, /source: 'owned', action: 'mint'/, 'Optional mint must operate from the already-secured ownership record.');
assert.match(success, /MINT TO BASE NOW · OPTIONAL/, 'Minting must be clearly optional.');
assert.match(success, /DO THIS LATER · OPEN MY ESTATES/, 'Buyer must be able to leave without minting.');
assert.match(success, /mintVoxelFlip/, 'The optional button must still use the reviewed VoxelFlip mint client.');

const mineApi = fs.readFileSync(new URL('../app/api/digital-estates/mine/route.ts', import.meta.url), 'utf8');
assert.match(mineApi, /\['paid', 'paid-usdc', 'minted'\]/, 'My Estates API must expose only secured purchases.');
assert.match(mineApi, /reservation\.buyerId !== user\.id/, 'My Estates API must remain user-bound.');
const minePage = fs.readFileSync(new URL('../app/vault/estates/mine/page.js', import.meta.url), 'utf8');
assert.match(minePage, /Owned · Not minted/, 'Purchased unminted estates must remain visible.');
assert.match(minePage, /MINT TO BASE · OPTIONAL/, 'My Estates must offer optional later minting.');
assert.match(minePage, /does not guarantee appreciation/i, 'Minting must not be represented as guaranteed value creation.');

console.log(`Digital Estates purchase-first safety checks passed for ${DIGITAL_ESTATES.length} unique listings.`);
