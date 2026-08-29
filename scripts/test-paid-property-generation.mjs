import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const property = read('app/property/page.js');
const propertyLayout = read('app/property/layout.js');
const bridge = read('app/property/PropertyCheckoutPhotoBridge.js');
const browserStore = read('lib/property-generation-browser-store.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const photoHandoff = read('app/api/property-photo-upload/route.ts');
const payment = read('lib/property-generation-payment.ts');
const globe = read('app/vault/earth/PlanetStreamGlobe.js');

assert.match(payment, /PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499/, 'server-authoritative VoxelPop creation price must be $4.99');
assert.match(payment, /PROPERTY_VOXEL_GENERATION_KIND = 'property_voxel_generation_v1'/, 'paid property creation must have its own Stripe product rail');
assert.match(payment, /session\.payment_status !== 'paid'/, 'generation unlock must require a paid Stripe session');
assert.match(payment, /session\.client_reference_id !== auth\.user\.id/, 'paid generation must remain bound to the signed-in buyer');
assert.match(payment, /metadata\.voxelpop_user_id !== auth\.user\.id/, 'Stripe metadata must independently bind payment to the account');
assert.match(payment, /Number\(session\.amount_total \|\| 0\) !== PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the server must verify the exact paid amount');
assert.match(payment, /source_sha256/, 'the paid source must be cryptographically bound to Stripe');
assert.doesNotMatch(payment, /createBucket|storage\.from\(|listBuckets|BUCKET =/, 'payment verification must not depend on Supabase Storage');

assert.match(checkout, /requireVoxelVaultUser/, 'checkout must require a signed-in account');
assert.match(checkout, /createHash\('sha256'\)/, 'checkout must fingerprint the exact photo without retaining it');
assert.match(checkout, /MESHY_PROPERTY_CREDITS\.fullPipeline/, 'provider capacity must be checked before charging');
assert.match(checkout, /readMeshyCreditBalance\(apiKey\)/, 'checkout may read service credits without generating');
assert.match(checkout, /does not start a Meshy task/, 'checkout preflight must explicitly remain credit-free');
assert.match(checkout, /stripe\.checkout\.sessions\.create/, 'generation paywall must use server-created Stripe Checkout');
assert.match(checkout, /unit_amount: PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the client cannot choose the generation price');
assert.match(checkout, /source_retention: 'browser_indexeddb_until_paid_handoff'/, 'Stripe must record the device-local source retention model');
assert.match(checkout, /Digital creation only; no rights in physical real estate/, 'checkout copy must preserve the real-property boundary');
assert.match(checkout, /generation_session=\{CHECKOUT_SESSION_ID\}.*draftId=/, 'paid return must carry the local draft key');
assert.doesNotMatch(checkout, /storage\.from\(|createBucket|listBuckets|stagePaidPropertyPhoto/, 'checkout must never create or upload to a private bucket');

assert.match(propertyLayout, /PropertyCheckoutPhotoBridge/, 'property route must install the checkout bridge without changing the maker UI');
assert.match(browserStore, /indexedDB/, 'checkout photo must be retained privately in browser IndexedDB');
assert.match(browserStore, /MAX_AGE_MS = 24 \* 60 \* 60 \* 1000/, 'local checkout sources must expire');
assert.match(bridge, /savePropertyCheckoutPhoto/, 'exact checkout photo must be retained before leaving for Stripe');
assert.match(bridge, /loadPropertyCheckoutPhoto/, 'paid return must recover the same local photo');
assert.match(bridge, /body\.append\('photo', photo/, 'bridge must attach the recovered source after payment');
assert.match(bridge, /deletePropertyCheckoutPhoto/, 'local staging must be cleaned after success or cancellation');

assert.match(photoHandoff, /if \(!generationSessionId\)/, 'direct source generation must reject calls without payment');
assert.match(photoHandoff, /paymentRequired: true/, 'unpaid direct calls must expose payment-required');
assert.match(photoHandoff, /status: 402/, 'unpaid source-generation calls must fail closed');
assert.match(photoHandoff, /paidPropertyGenerationReceipt\(auth, stripe, generationSessionId\)/, 'Stripe receipt must be verified before any Meshy task starts');
assert.match(photoHandoff, /rightsConfirmed/, 'paid handoff must retain an explicit rights gate');
assert.match(photoHandoff, /const photo = form\.get\('photo'\)/, 'paid return must receive the browser-retained photo only after payment');
assert.match(photoHandoff, /verifiedDigest !== digest/, 'source bytes must match the Stripe-bound SHA-256');
assert.match(photoHandoff, /photo\.size !== receipt\.sizeBytes/, 'paid handoff must also bind source size');
assert.match(photoHandoff, /readCatalog3D\(itemId\)/, 'Stripe-return refreshes must reuse existing generation');
assert.match(photoHandoff, /existing\?\.source_image_url === sourceFingerprint/, 'idempotency must be tied to the exact paid photo');
assert.doesNotMatch(photoHandoff, /storage\.from\(|createBucket|listBuckets|deleteStagedPropertyPhoto|loadPaidPropertyGenerationPhoto/, 'paid source handoff must not depend on checkout Storage');

assert.match(property, /CREATION_PRICE_LABEL = '\$4\.99'/, 'maker must keep the $4.99 creation price');
assert.match(property, /\/api\/property-generation\/checkout/, 'photo approval must open paid generation checkout');
assert.match(property, /Pay \$4\.99 · Use photo → start build/, 'primary CTA must disclose the creation charge');
assert.match(property, /generation_session/, 'maker must resume after Stripe');
assert.match(property, /form\.append\('generationSessionId', generationSessionId\)/, 'paid return must pass the verified session');

assert.match(globe, /function selectedFocusPoint/, 'property map must preserve selected-location focus');
assert.match(globe, /if \(simpleMode\) focusSelected/, 'simple property World must automatically focus the selected property');
assert.match(globe, /scale = selected \? 1\.8 : 1/, 'selected property must remain visually prominent');
assert.match(globe, /PROPERTY WORLD · FOCUSED LOCATION/, 'property map should clearly describe its focused state');

console.log('Paid VoxelPop regression passed: same $4.99 maker -> device-local photo retention -> credit-free service preflight -> Stripe verification -> exact SHA/size/account/draft verification -> idempotent paid Meshy start, with no checkout bucket dependency and focused property-map behavior preserved.');
