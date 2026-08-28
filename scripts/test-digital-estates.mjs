import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DIGITAL_ESTATES, STRIPE_MAX_USD_CENTS } from '../lib/digital-estates.js';

assert.ok(DIGITAL_ESTATES.length >= 5, 'Digital Estates should launch with a meaningful first district.');
assert.equal(new Set(DIGITAL_ESTATES.map((estate) => estate.id)).size, DIGITAL_ESTATES.length, 'Estate IDs must be unique.');
assert.equal(new Set(DIGITAL_ESTATES.map((estate) => estate.purchasePriceCents)).size, DIGITAL_ESTATES.length, 'Estate prices should be unique so direct USDC verification cannot ambiguously match two listings.');
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
assert.match(checkout, /previous\.payment_status === 'paid'/, 'An existing Stripe hold must be reconciled against Stripe paid state.');
assert.match(checkout, /previous\.status === 'expired'/, 'Expired Stripe holds must be releasable.');
assert.doesNotMatch(checkout, /payment_method_types\s*:/, 'Hosted Checkout should use dynamic eligible payment methods rather than a hard-coded card-only list.');
assert.match(checkout, /digital_only_no_real_property_rights/, 'Checkout metadata must preserve the digital-only rights boundary.');

const reservation = fs.readFileSync(new URL('../lib/digital-estate-reservations.ts', import.meta.url), 'utf8');
assert.match(reservation, /provider.*digital-estate-reservation|PROVIDER = 'digital-estate-reservation'/s, 'Reservations must use a dedicated provider namespace.');
assert.match(reservation, /if \(reservation\.state === 'checkout'\) return false;/, 'Stripe checkout holds must be resolved from Stripe rather than a local timer.');
assert.match(reservation, /primary key|commerce_webhook_events|event_id/, 'Reservations must use the existing unique commerce event key.');
assert.match(reservation, /Digital estate reservation changed concurrently/, 'Concurrent reservation writes must fail closed.');

const mint = fs.readFileSync(new URL('../lib/digital-estate-mint.ts', import.meta.url), 'utf8');
assert.match(mint, /voxel-vault:digital-estate:\$\{String\(estateId/, 'Voucher ID must be deterministic from the estate identity.');
assert.doesNotMatch(mint, /sessionId|txHash/, 'The unique estate voucher ID must not depend on a payment session or transaction hash.');
assert.match(mint, /usedVouchers/, 'Onchain inventory must be read from the VoxelFlip voucher registry.');
assert.match(mint, /signMessage/, 'Paid claims must use the existing VoxelFlip signed-voucher mint path.');

const claim = fs.readFileSync(new URL('../app/api/digital-estates/claim/route.ts', import.meta.url), 'utf8');
assert.match(claim, /session\.payment_status !== 'paid'/, 'Stripe claims must fail until Stripe reports paid.');
assert.match(claim, /Number\(session\.amount_total\) !== estate\.purchasePriceCents/, 'Stripe claims must verify the exact paid amount.');
assert.match(claim, /session\.metadata\?\.buyer_id !== user\.id/, 'Stripe claims must remain account-bound.');
assert.match(claim, /0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/, 'Base USDC verification must pin Circle native USDC.');
assert.match(claim, /getAddress\(transaction\.from\) !== wallet/, 'USDC claims must verify the transaction sender.');
assert.match(claim, /getAddress\(transaction\.to\) !== getAddress\(BASE_USDC\)/, 'USDC claims must verify the token contract.');
assert.match(claim, /from === wallet && to === recipient && value === expectedUnits/, 'USDC claims must verify exact sender, recipient and amount.');
assert.match(claim, /digital-estate-usdc-payment/, 'USDC transaction hashes must be one-time idempotency keys.');
assert.match(claim, /block\.timestamp < reservedAtSeconds - 120/, 'Old unrelated USDC transfers must not satisfy a new reservation.');
assert.match(claim, /buildDigitalEstateVoucher/, 'Only verified payment should reach voucher issuance.');

const crypto = fs.readFileSync(new URL('../app/api/digital-estates/crypto-config/route.ts', import.meta.url), 'utf8');
assert.match(crypto, /digitalEstateMintReady/, 'USDC transfer must preflight mint readiness.');
assert.match(crypto, /isDigitalEstateMinted/, 'USDC transfer must preflight onchain availability.');
assert.match(crypto, /acquireDigitalEstateReservation/, 'USDC transfer must reserve inventory before showing transfer details.');
assert.match(crypto, /BigInt\(estate\.purchasePriceCents\) \* 10_000n/, 'USD cents must convert exactly to 6-decimal USDC units.');
assert.match(crypto, /DIGITAL_ESTATE_USDC_RECIPIENT/, 'USDC payout recipient must support explicit server configuration.');

const metadata = fs.readFileSync(new URL('../app/api/digital-estates/metadata/route.ts', import.meta.url), 'utf8');
assert.match(metadata, /Real Property Rights.*None/s, 'NFT metadata must state that real-property rights are absent.');
assert.match(metadata, /reference_value_is_appraisal: false/, 'Metadata must never present the creative reference as an appraisal.');
assert.match(metadata, /purchase_price_matches_reference_value/, 'Metadata should disclose the intentional matching-price design.');

const page = fs.readFileSync(new URL('../app/vault/estates/page.js', import.meta.url), 'utf8');
assert.match(page, /REAL-WORLD REFERENCE/);
assert.match(page, /DIGITAL ESTATE LIST PRICE/);
assert.match(page, /Same nominal price by design/);
assert.match(page, /PAY SECURELY/);
assert.match(page, /PAY USDC ON BASE/);
assert.match(page, /usdc\.transfer\(getAddress\(config\.recipient\), amount\)/, 'USDC transfer must use server-preflight recipient and amount.');
assert.match(page, /claimAndMintUsdc/, 'USDC payment must pass through server verification before minting.');
assert.match(page, /mintVoxelFlip/, 'A verified purchase must mint through the reviewed VoxelFlip client path.');
assert.match(page, /No physical parcel, title, tenancy, rental income, security, appraisal, mortgage, or legal claim/i, 'The showroom must make the digital-only boundary unmistakable.');

const success = fs.readFileSync(new URL('../app/vault/estates/success/page.js', import.meta.url), 'utf8');
assert.match(success, /source: 'stripe'/, 'Hosted payment return must claim specifically from Stripe.');
assert.match(success, /VERIFY PAYMENT \+ MINT ON BASE/, 'Buyer must explicitly finish the onchain mint after payment verification.');
assert.match(success, /mintVoxelFlip/, 'Paid hosted checkout must feed the same reviewed voucher mint path.');

console.log(`Digital Estates safety checks passed for ${DIGITAL_ESTATES.length} unique listings.`);
