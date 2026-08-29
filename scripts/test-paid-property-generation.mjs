import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const property = read('app/property/page.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const localStore = read('lib/local-voxel-store.js');
const payment = read('lib/property-generation-payment.ts');
const viewer = read('app/property/LocalVoxelModelViewer.js');

assert.match(payment, /PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499/, 'server-authoritative VoxelPop creation price must stay $4.99');
assert.match(payment, /PROPERTY_VOXEL_GENERATION_KIND = 'property_voxel_generation_v1'/, 'paid creation keeps its dedicated Stripe rail');
assert.match(payment, /PROPERTY_VOXEL_GENERATION_ENGINE = 'browser-local-v1'/, 'paid creation must identify the no-credit local engine');
assert.match(payment, /session\.payment_status !== 'paid'/, 'generation unlock still requires a paid Stripe session');
assert.match(payment, /session\.client_reference_id !== auth\.user\.id/, 'paid generation remains bound to the signed-in buyer');
assert.match(payment, /metadata\.voxelpop_user_id !== auth\.user\.id/, 'Stripe metadata independently binds the payment to the account');
assert.match(payment, /Number\(session\.amount_total \|\| 0\) !== PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the exact paid amount is verified server-side');
assert.match(payment, /metadata\.source_storage !== 'device-local'/, 'the paid receipt must be for the device-local source path');
assert.doesNotMatch(payment, /storage\.|createBucket|source_sha256|source_storage_path/, 'payment verification must not depend on Supabase photo staging');

assert.match(checkout, /requireVoxelVaultUser/, 'checkout requires a signed-in Voxel Vault account');
assert.match(checkout, /stripe\.checkout\.sessions\.create/, 'the $4.99 paywall still uses server-created Stripe Checkout');
assert.match(checkout, /unit_amount: PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the browser cannot choose the generation price');
assert.match(checkout, /VoxelPop 3D Voxel Creation/, 'Stripe identifies exactly what is purchased');
assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout pins the no-credit generation engine');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout explicitly records that the photo stays on device');
assert.match(checkout, /generation_session=\{CHECKOUT_SESSION_ID\}/, 'successful payment returns through the paid resume path');
assert.match(checkout, /generation_checkout=cancelled/, 'canceled checkout returns safely');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto|createBucket|storage\.from/i, 'checkout must not call Meshy credits/capacity or private checkout storage');

assert.match(paidVerify, /if \(!generationSessionId\)/, 'paid verification rejects calls without a payment session');
assert.match(paidVerify, /paymentRequired: true/, 'unpaid calls expose an explicit payment-required response');
assert.match(paidVerify, /status: 402/, 'unpaid verification fails closed');
assert.match(paidVerify, /paidPropertyGenerationReceipt\(auth, stripe, generationSessionId\)/, 'Stripe receipt is verified before the local build unlocks');
assert.match(paidVerify, /source stays in this browser device storage/, 'privacy copy must describe the device-local source accurately');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|storage\.from|createBucket/i, 'paid verification must not start a provider job or use Storage');

assert.match(property, /CREATION_PRICE_LABEL = '\$4\.99'/, 'maker still shows $4.99');
assert.match(property, /indexedDB\.open\(DEVICE_DB/, 'the authorized photo must persist across Stripe on the same device');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'photo must be safely persisted on-device before leaving for checkout');
assert.match(property, /\/api\/property-generation\/checkout/, 'photo approval still opens paid generation checkout');
assert.match(property, /Pay \$\{CREATION_PRICE_LABEL\} · Use photo → start build/, 'primary CTA clearly discloses the creation charge');
assert.match(property, /generation_session/, 'maker resumes a successful paid creation after Stripe');
assert.match(property, /form\.append\('generationSessionId', generationSessionId\)/, 'Stripe return passes the session into the server payment verifier');
assert.match(property, /Payment is verified\. Choose the property photo again on this device; you will not be charged again\./, 'missing local photo recovery must never charge twice');
assert.match(property, /createVoxelPoster/, 'the VoxelPop image is generated locally');
assert.match(property, /LocalVoxelModelViewer/, 'the paid flow uses the local interactive 3D viewer');
assert.match(property, /\/api\/property-local-voxel/, 'local model recipe is account-linked after rendering');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided paid property creation must not call metered Meshy endpoints');
assert.doesNotMatch(property, /insufficient funds|needs credits|add Meshy credits/i, 'guided UI must not expose the old provider-credit dead end');

assert.match(viewer, /3D IMAGE · BUILDING LOCAL 3D/, 'the image must visibly precede interactive 3D');
assert.match(viewer, /3D IMAGE → INTERACTIVE 3D/, 'the viewer must explicitly stage image then 3D');
assert.match(viewer, /NO MESHY CREDITS/, 'local interactive 3D should make the no-credit behavior explicit');
assert.match(viewer, /InstancedMesh/, 'local 3D is real WebGL voxel geometry rather than a fake loading state');

assert.match(localVoxel, /voxelpop-local-webgl-v1/, 'server records the deterministic local model provider');
assert.match(localVoxel, /local-voxel-recipe-v1:/, 'server persists only a compact voxel recipe');
assert.match(localVoxel, /model\/gltf\+json/, 'a durable glTF can be rebuilt from the compact recipe');
assert.match(localVoxel, /propertyDraftItemId\(auth\.user\.id, draftId, 'voxel'\)/, 'local model remains account/draft bound');
assert.match(localStore, /Deliberately table-only/, 'local record persistence must deliberately avoid Storage');
assert.doesNotMatch(localStore, /createBucket|storage\.from/, 'local record persistence must not touch a Storage bucket');

console.log('Paid VoxelPop property regression passed: signed-in photo -> device-local persistence -> server-authoritative $4.99 Stripe checkout -> paid account verification -> image-first local WebGL voxel -> compact account-bound glTF recipe, with no Meshy-credit or checkout-bucket dependency.');
