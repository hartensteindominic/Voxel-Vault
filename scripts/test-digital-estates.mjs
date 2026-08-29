import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DIGITAL_ESTATE_ANCHOR_PRICE_CENTS,
  DIGITAL_ESTATE_ANCHOR_SQFT,
  DIGITAL_ESTATE_PRICING_MODEL,
  DIGITAL_ESTATES,
  STRIPE_MAX_USD_CENTS,
  formatUsdCents,
  relativeDigitalEstateIndexBps,
  relativeDigitalEstatePriceCents,
} from '../lib/digital-estates.js';

assert.ok(DIGITAL_ESTATES.length >= 6, 'The relative-price Digital Property catalog must keep a useful first district.');
assert.equal(new Set(DIGITAL_ESTATES.map((estate) => estate.id)).size, DIGITAL_ESTATES.length, 'Estate IDs must be unique.');
const anchor = DIGITAL_ESTATES.find((estate) => estate.pricingAnchor === true);
assert.ok(anchor, 'Exactly one founder pricing anchor must be present.');
assert.equal(DIGITAL_ESTATES.filter((estate) => estate.pricingAnchor === true).length, 1, 'The relative-price catalog must have one unambiguous founder anchor.');
assert.equal(anchor.purchasePriceCents, 199, 'The founder reference digital property must cost exactly $1.99.');
assert.equal(anchor.sqft, DIGITAL_ESTATE_ANCHOR_SQFT, 'The founder anchor must use the reviewed 2,016 modeled square-foot baseline.');
assert.equal(anchor.relativeIndexBps, 10_000, 'The founder anchor index must be exactly 1.00x.');
assert.equal(formatUsdCents(DIGITAL_ESTATE_ANCHOR_PRICE_CENTS), '$1.99', 'Small digital-property prices must retain cents in the UI.');
for (const estate of DIGITAL_ESTATES) {
  assert.equal(estate.pricingModel, DIGITAL_ESTATE_PRICING_MODEL, `${estate.id} must use the disclosed relative pricing model.`);
  assert.equal(estate.anchorPriceCents, DIGITAL_ESTATE_ANCHOR_PRICE_CENTS, `${estate.id} must point to the same $1.99 anchor.`);
  assert.equal(estate.relativeIndexBps, relativeDigitalEstateIndexBps(estate.sqft), `${estate.id} must derive its relative index from modeled size.`);
  assert.equal(estate.purchasePriceCents, relativeDigitalEstatePriceCents(estate.sqft), `${estate.id} must derive its server price from the public formula.`);
  assert.ok(Number.isInteger(estate.purchasePriceCents) && estate.purchasePriceCents > 0, `${estate.id} must have a valid server price.`);
  assert.ok(estate.purchasePriceCents <= STRIPE_MAX_USD_CENTS, `${estate.id} must stay within the hosted USD rail limit.`);
  assert.equal('referenceValueCents' in estate, false, `${estate.id} must not relabel a creative collectible price as a real-property reference value.`);
}

const earth = fs.readFileSync(new URL('../lib/earth-properties.ts', import.meta.url), 'utf8');
assert.match(earth, /BRIDGE_BASE_URL = 'https:\/\/api\.bridgedataoutput\.com\/api\/v2\/OData'/, 'Earth listings must keep the authorized Bridge API adapter.');
assert.match(earth, /MAX_RESULTS = 20/, 'Earth property views must cap provider results at 20.');
assert.match(earth, /cache:\s*'no-store'/, 'Provider listing payloads must not be cached by the application fetch.');
assert.match(earth, /configured:\s*false[\s\S]*listings:\s*\[\]/, 'Missing credentials must produce an empty real-property result, not fake listings.');
for (const type of ['mobile-home','storefront','warehouse','barn-farm','land','multifamily']) {
  assert.match(earth, new RegExp(`'${type}'`), `Earth normalization must support ${type}.`);
}
assert.doesNotMatch(earth, /fake listing|sample listing|demo property/i, 'Earth provider code must not fabricate real-property inventory.');

const earthApi = fs.readFileSync(new URL('../app/api/earth-properties/search/route.ts', import.meta.url), 'utf8');
assert.match(earthApi, /searchEarthProperties/, 'Earth search route must use the authorized provider federation.');
assert.match(earthApi, /Cache-Control.*private, no-store/s, 'Earth API responses must be no-store.');
assert.match(earthApi, /real-property acquisition requires/i, 'Earth API must preserve real closing/deed truth.');

const earthPage = fs.readFileSync(new URL('../app/vault/earth/page.js', import.meta.url), 'utf8');
assert.match(earthPage, /Address, city, postcode/, 'Earth search must accept address/city-style queries.');
assert.match(earthPage, /NEAR ME/);
for (const label of ['Mobile','Storefronts','Farms','Warehouses','Multifamily','Land']) assert.match(earthPage, new RegExp(`'${label}'`));
assert.match(earthPage, /OPEN (?:REAL )?SOURCE LISTING/);
assert.match(earthPage, /MINTING RECOMMENDED AFTER VERIFICATION/, 'Minting must be downstream of verification.');
assert.match(earthPage, /does not replace the deed/i, 'Earth UI must never present the NFT/twin as the deed.');
assert.match(earthPage, /Physical-market value and digital twin resale value remain separate/i, 'Physical-market reference and digital-asset resale value must remain explicitly separate.');
assert.match(earthPage, /REALITY ≠ TITLE ≠ INVESTMENT/, 'photorealistic visualization must not be conflated with legal rights.');
assert.match(earthPage, /PropertyEvidencePanel/, 'visual evidence must remain its own layer rather than silently verifying ownership.');

const estatesMarket = fs.readFileSync(new URL('../app/vault/estates/page.js', import.meta.url), 'utf8');
assert.match(estatesMarket, /DIGITAL PROPERTY MARKET/, 'The Digital Estates route must expose the testable marketplace again.');
assert.match(estatesMarket, /formatUsdCents\(DIGITAL_ESTATE_ANCHOR_PRICE_CENTS\)/, 'The market hero must display the server catalog anchor rather than a duplicated client price.');
assert.match(estatesMarket, /pricingBasis/, 'Every selected property must disclose how its relative price was calculated.');
assert.match(estatesMarket, /I understand this is digital-only/, 'A real purchase must require a plain-language digital-only acknowledgement.');
assert.match(estatesMarket, /body: JSON\.stringify\(\{ estateId: selected\.id \}\)/, 'USD checkout must submit only the estate identity, never a browser price or wallet requirement.');
assert.doesNotMatch(estatesMarket, /redirect\('\/vault\/earth'\)/, 'The Digital Property market must no longer disappear behind the Earth explorer.');

const checkout = fs.readFileSync(new URL('../app/api/digital-estates/checkout/route.ts', import.meta.url), 'utf8');
assert.match(checkout, /getDigitalEstate\(body\?\.estateId\)/, 'Checkout must load price from the server catalog.');
assert.match(checkout, /unit_amount: estate\.purchasePriceCents/, 'Checkout amount must remain server-authoritative.');
assert.doesNotMatch(checkout, /body\?\.(price|amount|purchasePrice)/, 'Browser-supplied prices must never drive checkout.');
assert.doesNotMatch(checkout, /body\?\.wallet|Connect a valid EVM wallet before checkout|getAddress\(/, 'Secure fiat checkout must not require a crypto wallet.');
assert.match(checkout, /customer_email: user\.email/, 'Hosted checkout must use the signed-in account email.');
assert.match(checkout, /receipt_email: user\.email/, 'Stripe PaymentIntent must explicitly send the receipt to the signed-in email.');
assert.match(checkout, /walletRequiredForCheckout: false/, 'Checkout response must explicitly describe walletless purchase support.');
assert.match(checkout, /pricing_model: estate\.pricingModel/, 'Checkout metadata must bind the disclosed pricing-model version.');
assert.match(checkout, /anchor_price_cents: String\(estate\.anchorPriceCents\)/, 'Checkout metadata must bind the $1.99 anchor price.');
assert.match(checkout, /relative_index_bps: String\(estate\.relativeIndexBps\)/, 'Checkout metadata must bind the selected property index.');
assert.match(checkout, /acquireDigitalEstateReservation\(\{ estateId: estate\.id, buyerId: user\.id, source: 'stripe' \}\)/, 'Fiat ownership reservation must bind to the account first.');
assert.doesNotMatch(checkout, /digitalEstateMintReady/, 'Mint readiness must never block buying.');
assert.doesNotMatch(checkout, /payment_method_types\s*:/, 'Hosted Checkout should keep dynamic eligible payment methods.');

const reservation = fs.readFileSync(new URL('../lib/digital-estate-reservations.ts', import.meta.url), 'utf8');
assert.match(reservation, /wallet = ''/, 'Reservations must support account-first purchases with no wallet.');
assert.match(reservation, /bindDigitalEstateReservationWallet/, 'A secured owner must be able to bind the optional mint wallet later.');
assert.match(reservation, /Only the owner of a secured purchase can bind its mint wallet/, 'Wallet binding must remain owner-only.');
assert.match(reservation, /\['paid', 'paid-usdc', 'minted'\]/, 'Paid states must remain permanent ownership locks.');
assert.match(reservation, /Digital estate wallet binding changed concurrently/, 'Wallet binding must fail closed on races.');

const purchase = fs.readFileSync(new URL('../lib/digital-estate-purchases.ts', import.meta.url), 'utf8');
assert.match(purchase, /session\.payment_status !== 'paid'/, 'Stripe purchase security must require paid state.');
assert.match(purchase, /Number\(session\.amount_total\) !== estate\.purchasePriceCents/, 'Stripe purchase security must verify exact amount.');
assert.match(purchase, /session\.metadata\?\.pricing_model/, 'Stripe purchase verification must reject a different pricing-model version.');
assert.match(purchase, /session\.metadata\?\.anchor_price_cents/, 'Stripe purchase verification must recheck the anchor price.');
assert.match(purchase, /session\.metadata\?\.relative_index_bps/, 'Stripe purchase verification must recheck the property index.');
assert.match(purchase, /expectedBuyerId && buyerId !== expectedBuyerId/, 'Stripe purchase security must remain account-bound.');
assert.match(purchase, /const wallet = walletRaw && ADDRESS_RE\.test\(walletRaw\) \? getAddress\(walletRaw\) : ''/, 'Stripe purchase verification must allow no pre-bound wallet.');
assert.match(purchase, /reservation\.buyerId !== buyerId/, 'Stripe ownership must match the reservation account.');
assert.match(purchase, /state: 'paid'/, 'Verified Stripe payment must lock ownership before optional minting.');
assert.doesNotMatch(purchase, /buildDigitalEstateVoucher|signMessage/, 'Payment verification must never mint or issue a voucher.');
assert.match(purchase, /0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/, 'Base USDC verification must remain pinned to native USDC.');

const webhook = fs.readFileSync(new URL('../app/api/stripe/webhook/route.ts', import.meta.url), 'utf8');
assert.match(webhook, /session\.metadata\?\.kind === 'digital_estate'/, 'Signed Stripe webhook must recognize Digital Estate payments.');
assert.match(webhook, /secureStripeDigitalEstatePurchase\(\{ session \}\)/, 'Signed webhook must secure the estate even if the browser never returns.');
assert.match(webhook, /stripe\.webhooks\.constructEvent/, 'Estate security must remain behind Stripe signature verification.');

const claim = fs.readFileSync(new URL('../app/api/digital-estates/claim/route.ts', import.meta.url), 'utf8');
assert.match(claim, /bindDigitalEstateReservationWallet/, 'Optional mint path must bind an unbound purchase wallet server-side.');
assert.match(claim, /if \(!reservation\.wallet\)/, 'Wallet binding must happen only when no mint wallet is already bound.');
assert.match(claim, /source === 'owned'/, 'Secured owners must be able to return later to mint.');
assert.match(claim, /digitalEstateMintReady\(\)/, 'Mint readiness must be checked only in optional mint preparation.');
assert.match(claim, /buildDigitalEstateVoucher/, 'Only the optional mint path may issue a mint voucher.');

const success = fs.readFileSync(new URL('../app/vault/estates/success/page.js', import.meta.url), 'utf8');
assert.match(success, /source: 'stripe', action: 'secure'/, 'Checkout return must confirm account ownership without minting.');
assert.match(success, /Not bound yet/, 'Receipt-return UI must treat an unbound wallet as normal.');
assert.match(success, /CONNECT WALLET \+ MINT · ENCOURAGED BACKUP/, 'Minting should be encouraged but optional.');
assert.match(success, /DO THIS LATER · OPEN MY DIGITAL TWINS/, 'Buyer must be able to leave without minting.');
assert.match(success, /mintVoxelFlip/, 'The optional mint button must still use the reviewed VoxelFlip client.');

const mineApi = fs.readFileSync(new URL('../app/api/digital-estates/mine/route.ts', import.meta.url), 'utf8');
assert.match(mineApi, /reservation\.buyerId !== user\.id/, 'My Digital Twins API must remain user-bound.');
const minePage = fs.readFileSync(new URL('../app/vault/estates/mine/page.js', import.meta.url), 'utf8');
assert.match(minePage, /Not bound yet/, 'Purchased assets must remain visible before wallet binding.');
assert.match(minePage, /item\.wallet && wallet\.toLowerCase\(\) !== String\(item\.wallet\)\.toLowerCase\(\)/, 'A previously bound wallet must not be silently replaced.');
assert.match(minePage, /CONNECT WALLET \+ MINT · ENCOURAGED/, 'My Digital Twins must encourage optional backup without requiring it.');

const docs = fs.readFileSync(new URL('../docs/EARTH_PROPERTIES.md', import.meta.url), 'utf8');
assert.match(docs, /does not scrape Zillow/i);
assert.match(docs, /BRIDGE_DATASET_ID=/);
assert.match(docs, /BRIDGE_ACCESS_TOKEN=/);
assert.match(docs, /real-property acquisition still requires/i);
assert.match(docs, /resale value are separate/i);

console.log('Earth Properties + $1.99 relative-price account-first Digital Property safety checks passed.');
