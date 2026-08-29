import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const property = read('app/property/page.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const photoHandoff = read('app/api/property-photo-upload/route.ts');
const payment = read('lib/property-generation-payment.ts');
const clientPhoto = read('lib/property-checkout-photo-client.js');

assert.match(payment, /PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499/, 'server-authoritative optional enhanced VoxelPop creation price must remain $4.99');
assert.match(payment, /PROPERTY_VOXEL_GENERATION_KIND = 'property_voxel_generation_v1'/, 'paid enhanced property creation keeps its Stripe product rail');
assert.match(payment, /session\.payment_status !== 'paid'/, 'generation unlock must require a paid Stripe session');
assert.match(payment, /session\.client_reference_id !== auth\.user\.id/, 'paid generation remains bound to the signed-in buyer');
assert.match(payment, /metadata\.voxelpop_user_id !== auth\.user\.id/, 'Stripe metadata independently binds payment to the account');
assert.match(payment, /Number\(session\.amount_total \|\| 0\) !== PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'server verifies the exact paid amount');
assert.match(payment, /describePaidPropertyPhoto/, 'checkout must hash and validate the source without storing it');
assert.match(payment, /createHash\('sha256'\)/, 'source photo must be fingerprinted before Stripe');
assert.match(payment, /verifyPaidPropertyPhoto/, 'Stripe return must cryptographically re-check the on-device source');
assert.match(payment, /digest !== receipt\.digest/, 'source bytes must be re-verified after returning from Stripe');
assert.doesNotMatch(payment, /createBucket|storage\.from\(|Private VoxelPop checkout storage could not be prepared/, 'paid checkout must not create or require server photo storage');

assert.match(clientPhoto, /indexedDB\.open/, 'the browser must preserve the optional paid source across Stripe locally');
assert.match(clientPhoto, /savePropertyCheckoutPhoto/, 'browser checkout helper must save the source photo');
assert.match(clientPhoto, /readPropertyCheckoutPhoto/, 'browser checkout helper must restore the source photo');
assert.match(clientPhoto, /removePropertyCheckoutPhoto/, 'browser checkout helper must clean the local checkout photo');

assert.match(checkout, /requireVoxelVaultUser/, 'checkout must require a signed-in Voxel Vault account');
assert.match(checkout, /MESHY_PROPERTY_CREDITS\.fullPipeline/, 'optional enhanced checkout checks provider capacity before charging');
assert.match(checkout, /readMeshyCreditBalance\(apiKey\)/, 'optional enhanced checkout reads live Meshy service-credit balance before Stripe');
assert.match(checkout, /describePaidPropertyPhoto\(draftId, photo\)/, 'checkout hashes the authorized photo in request memory instead of staging it');
assert.match(checkout, /source_storage: 'browser_only_until_payment'/, 'Stripe metadata must explicitly record browser-only source handling');
assert.match(checkout, /stripe\.checkout\.sessions\.create/, 'enhanced generation paywall uses server-created Stripe Checkout');
assert.match(checkout, /unit_amount: PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'client cannot choose the enhanced generation price');
assert.match(checkout, /VoxelPop Enhanced 3D Creation/, 'Stripe identifies the optional enhanced product precisely');
assert.match(checkout, /Digital creation only; no rights in physical real estate/, 'checkout copy preserves the real-property boundary');
assert.match(checkout, /generation_session=\{CHECKOUT_SESSION_ID\}.*draftId=/, 'successful payment returns with enough context to restore the on-device source');
assert.doesNotMatch(checkout, /stagePaidPropertyPhoto|source_storage_path|createBucket/, 'checkout must not server-stage the original source photo');

assert.match(photoHandoff, /if \(!generationSessionId\)/, 'enhanced source generation rejects calls without a payment session');
assert.match(photoHandoff, /paymentRequired: true/, 'unpaid direct calls expose explicit payment-required status');
assert.match(photoHandoff, /status: 402/, 'unpaid enhanced source-generation calls fail closed');
assert.match(photoHandoff, /paidPropertyGenerationReceipt\(auth, stripe, generationSessionId\)/, 'paid Stripe receipt is verified before any Meshy task starts');
assert.match(photoHandoff, /readCatalog3D\(itemId\)/, 'Stripe-return refreshes check for an existing generation before spending credits again');
assert.match(photoHandoff, /existing\?\.source_image_url === sourceFingerprint/, 'idempotency remains tied to the exact paid source photo');
assert.match(photoHandoff, /verifyPaidPropertyPhoto\(receipt, photo\)/, 'new paid generation verifies the restored browser photo against Stripe fingerprint');
assert.match(photoHandoff, /data:\$\{paidInput\.contentType\};base64/, 'verified paid source is sent to the provider inline without Storage');
assert.doesNotMatch(photoHandoff, /loadPaidPropertyGenerationPhoto|deleteStagedPropertyPhoto|storage\.from\(/, 'paid provider handoff must not depend on checkout Storage');

assert.match(property, /CREATION_PRICE_LABEL = '\$4\.99'/, 'maker keeps the optional $4.99 enhanced creation price');
assert.match(property, /Continue with Map Voxel · no AI credits/, 'no-credit map representation must be the primary available path');
assert.match(property, /Optional enhanced AI 3D · \$4\.99/, 'existing paid enhanced path remains available');
assert.match(property, /savePropertyCheckoutPhoto\(draftId, pendingPhoto\)/, 'paid source must be preserved locally before Stripe redirect');
assert.match(property, /readPropertyCheckoutPhoto\(returnDraftId\)/, 'Stripe return must restore the same source from the device');
assert.match(property, /if \(checkoutPhoto\) form\.append\('photo', checkoutPhoto\)/, 'restored source must be sent only after payment verification');
assert.match(property, /removePropertyCheckoutPhoto/, 'local source must be cleaned after success, cancellation, or reset');
assert.match(property, /\/api\/property-generation\/checkout/, 'optional enhanced path still opens paid generation checkout');
assert.match(property, /generation_session/, 'maker resumes a successfully paid enhanced creation after Stripe');
assert.match(property, /The no-credit Map Voxel is a digital map representation/, 'UI explains the no-credit representation truthfully');
assert.doesNotMatch(property, /staged privately for checkout/, 'UI must not claim the photo is server-staged');

console.log('Paid VoxelPop generation regression passed: no-credit Map Voxel stays available; optional enhanced AI 3D uses server-authoritative $4.99 Stripe checkout, browser-held source photo, SHA-256 re-verification, Meshy capacity checks, and no runtime checkout Storage bucket.');
