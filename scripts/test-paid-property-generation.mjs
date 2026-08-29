import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const property = read('app/property/page.js');
const propertyCss = read('app/property/property.module.css');
const propertyLayout = read('app/property/layout.js');
const bridge = read('app/property/PropertyCheckoutPhotoBridge.js');
const browserStore = read('lib/property-generation-browser-store.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const photoHandoff = read('app/api/property-photo-upload/route.ts');
const payment = read('lib/property-generation-payment.ts');

assert.match(payment, /PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499/, 'server-authoritative VoxelPop creation price must be $4.99');
assert.match(payment, /PROPERTY_VOXEL_GENERATION_KIND = 'property_voxel_generation_v1'/, 'paid property creation must have its own Stripe product rail');
assert.match(payment, /session\.payment_status !== 'paid'/, 'generation unlock must require a paid Stripe session');
assert.match(payment, /session\.client_reference_id !== auth\.user\.id/, 'paid generation must remain bound to the signed-in buyer');
assert.match(payment, /metadata\.voxelpop_user_id !== auth\.user\.id/, 'Stripe metadata must independently bind the payment to the account');
assert.match(payment, /Number\(session\.amount_total \|\| 0\) !== PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the server must verify the exact paid amount');
assert.match(payment, /source_sha256/, 'the paid source must be cryptographically bound to Stripe');
assert.doesNotMatch(payment, /createBucket|storage\.from\(|listBuckets/, 'payment verification must not depend on a Supabase Storage bucket');

assert.match(checkout, /requireVoxelVaultUser/, 'checkout must require a signed-in Voxel Vault account');
assert.match(checkout, /createHash\('sha256'\)/, 'checkout must fingerprint the exact selected photo without retaining it');
assert.match(checkout, /MESHY_PROPERTY_CREDITS\.fullPipeline/, 'provider capacity must be checked before charging');
assert.match(checkout, /readMeshyCreditBalance\(apiKey\)/, 'checkout must read the live Meshy service-credit balance before Stripe');
assert.match(checkout, /does not start a Meshy task\s*\n\s*\/\/ or spend credits/i, 'checkout preflight must explicitly remain credit-free');
assert.match(checkout, /stripe\.checkout\.sessions\.create/, 'the generation paywall must use server-created Stripe Checkout');
assert.match(checkout, /unit_amount: PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the client cannot choose the generation price');
assert.match(checkout, /source_retention: 'browser_indexeddb_until_paid_handoff'/, 'Stripe metadata must record the device-local source retention model');
assert.match(checkout, /VoxelPop 3D Voxel Creation/, 'Stripe must identify exactly what is being purchased');
assert.match(checkout, /Digital creation only; no rights in physical real estate/, 'checkout copy must preserve the real-property boundary');
assert.match(checkout, /generation_session=\{CHECKOUT_SESSION_ID\}.*draftId=/, 'successful payment must return with the local draft key needed to recover the photo');
assert.doesNotMatch(checkout, /storage\.from\(|createBucket|listBuckets/, 'checkout must never create or upload to a private Supabase bucket');

assert.match(propertyLayout, /PropertyCheckoutPhotoBridge/, 'the property route must install its checkout photo bridge without changing the maker UI');
assert.match(browserStore, /indexedDB/, 'the checkout photo must be retained privately in browser IndexedDB');
assert.match(browserStore, /MAX_AGE_MS = 24 \* 60 \* 60 \* 1000/, 'device-local checkout photos must expire instead of becoming permanent app storage');
assert.match(bridge, /savePropertyCheckoutPhoto/, 'the exact checkout photo must be retained on device before leaving for Stripe');
assert.match(bridge, /loadPropertyCheckoutPhoto/, 'the paid return must recover the same local photo');
assert.match(bridge, /body\.append\('photo', photo/, 'the bridge must attach the recovered source to the paid server handoff');
assert.match(bridge, /deletePropertyCheckoutPhoto/, 'local checkout staging must be cleaned after success or cancellation');

assert.match(photoHandoff, /if \(!generationSessionId\)/, 'direct source generation must reject calls without a payment session');
assert.match(photoHandoff, /paymentRequired: true/, 'unpaid direct calls must expose an explicit payment-required response');
assert.match(photoHandoff, /status: 402/, 'unpaid source-generation calls must fail closed');
assert.match(photoHandoff, /paidPropertyGenerationReceipt\(auth, stripe, generationSessionId\)/, 'the paid Stripe receipt must be verified before any Meshy task starts');
assert.match(photoHandoff, /const photo = form\.get\('photo'\)/, 'paid return must receive the browser-retained photo only after payment');
assert.match(photoHandoff, /verifiedDigest !== digest/, 'source bytes must be re-verified against the Stripe-bound SHA-256 fingerprint');
assert.match(photoHandoff, /photo\.size !== receipt\.sizeBytes/, 'paid handoff must also bind source size');
assert.match(photoHandoff, /readCatalog3D\(itemId\)/, 'Stripe-return refreshes must check for an existing generation before spending credits again');
assert.match(photoHandoff, /existing\?\.source_image_url === sourceFingerprint/, 'idempotency must be tied to the exact paid source photo');
assert.doesNotMatch(photoHandoff, /storage\.from\(|createBucket|listBuckets/, 'paid source handoff must not depend on checkout Storage');

assert.match(property, /CREATION_PRICE_LABEL = '\$4\.99'/, 'the maker must show the $4.99 creation price');
assert.match(property, /\/api\/property-generation\/checkout/, 'photo approval must open paid generation checkout instead of calling Meshy directly');
assert.match(property, /Pay \$4\.99 · Use photo → start build/, 'the primary CTA must clearly disclose the creation charge');
assert.match(property, /generation_session/, 'the maker must resume a successfully paid creation after Stripe');
assert.match(property, /form\.append\('generationSessionId', generationSessionId\)/, 'Stripe return must pass the verified session into the source-generation gate');
assert.match(property, /generation_checkout.*cancelled/, 'the maker must recognize canceled creation checkout');
assert.match(property, /The \{CREATION_PRICE_LABEL\} charge is for one digital VoxelPop creation/, 'UI copy must explain that $4.99 buys digital generation rather than real estate');

assert.match(propertyCss, /\.worldCard\{[^}]*height:500px/, 'desktop World preview must have more useful map space');
assert.match(propertyCss, /DRAG TO EXPLORE\s+·\s+PINCH TO ZOOM/, 'map must expose simple touch guidance');
assert.match(propertyCss, /\.worldBadge\{[^}]*bottom:16px/, 'private World state should remain visible without covering globe controls');
assert.match(propertyCss, /@media\(max-width:640px\)[\s\S]*\.worldCard\{height:430px\}/, 'iPhone map should retain a large touchable globe surface');

console.log('Paid VoxelPop property-generation regression passed: signed-in photo -> device-local private retention -> credit-free Meshy balance preflight -> server-authoritative $4.99 Stripe checkout -> paid account/draft/SHA verification -> idempotent Meshy start -> automatic voxel pipeline, with no checkout bucket dependency and improved mobile World-map framing.');
