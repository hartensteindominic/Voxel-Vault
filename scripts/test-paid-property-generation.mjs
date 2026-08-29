import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const route = read('app/property/page.js');
const property = read('app/property/PropertyJourneySimple.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const localStore = read('lib/local-voxel-store.js');
const payment = read('lib/property-generation-payment.ts');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const mintPrepare = read('app/api/property-local-voxel/nft/prepare/route.ts');

assert.match(route, /PropertyJourneySimple/, 'the /property route must use the simplified paid journey');
assert.match(payment, /PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499/, 'server-authoritative VoxelPop creation price must stay $4.99');
assert.match(payment, /PROPERTY_VOXEL_GENERATION_KIND = 'property_voxel_generation_v1'/, 'paid creation keeps its dedicated Stripe rail');
assert.match(payment, /PROPERTY_VOXEL_GENERATION_ENGINE = 'browser-local-v1'/, 'paid creation must identify the no-credit local engine');
assert.match(payment, /session\.payment_status !== 'paid'/, 'generation unlock still requires a paid Stripe session');
assert.match(payment, /session\.client_reference_id !== auth\.user\.id/, 'paid generation remains bound to the signed-in buyer');
assert.match(payment, /Number\(session\.amount_total \|\| 0\) !== PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the exact paid amount is verified server-side');
assert.match(payment, /metadata\.source_storage !== 'device-local'/, 'the paid receipt must be for the device-local source path');

assert.match(checkout, /requireVoxelVaultUser/, 'checkout requires a signed-in Voxel Vault account');
assert.match(checkout, /stripe\.checkout\.sessions\.create/, 'the $4.99 paywall still uses server-created Stripe Checkout');
assert.match(checkout, /unit_amount: PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the browser cannot choose the generation price');
assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout pins the local no-credit engine');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout records that the photo stays on device');
assert.match(checkout, /generation_session=\{CHECKOUT_SESSION_ID\}/, 'successful payment returns through the paid resume path');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto|createBucket|storage\.from/i, 'checkout must not call Meshy or private photo staging');

assert.match(paidVerify, /paidPropertyGenerationReceipt\(auth, stripe, generationSessionId\)/, 'Stripe receipt is verified before local creation unlocks');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|storage\.from|createBucket/i, 'paid verification must not start a provider job or use Storage');

assert.match(property, /CREATION_PRICE_LABEL = '\$4\.99'/, 'maker shows the $4.99 creation price');
assert.match(property, /indexedDB\.open\(DEVICE_DB/, 'the authorized photo persists across Stripe on the same device');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'photo is retained on-device before checkout');
assert.match(property, /\/api\/property-generation\/checkout/, 'photo approval opens paid generation checkout');
assert.match(property, /Pay \$\{CREATION_PRICE_LABEL\} & Create 3D Picture/, 'primary CTA clearly says the paid output is the review picture first');
assert.match(property, /The \$4\.99 purchase includes the 3D picture review, the movable VoxelPop voxel, mapping, and saving to My World/, 'one payment includes the useful creation journey');
assert.match(property, /The voxel is not built until you review the picture and choose to continue/i, 'payment must not silently skip the review stage');
assert.match(property, /Saving is included in the \$4\.99 creation\. No second payment is required/i, 'the guided journey must not introduce a second creation paywall');
assert.match(property, /generation_session/, 'maker resumes a successful paid creation after Stripe');
assert.match(property, /form\.append\('generationSessionId', generationSessionId\)/, 'Stripe return passes the session into the payment verifier');
assert.match(property, /you will not be charged again/i, 'missing local photo recovery must never charge twice');
assert.match(property, /createVoxelPoster/, 'the VoxelPop 3D picture is created locally');
assert.match(property, /LocalVoxelModelViewer/, 'the paid flow uses the local interactive voxel viewer after review');
assert.match(property, /\/api\/property-local-voxel/, 'reviewed local model recipe is account-linked after rendering');
assert.match(property, /saveToMyWorld/, 'post-map continuation saves directly to My World');
assert.match(property, /Mint this 3D voxel · optional/, 'minting is a separate optional final step rather than a second creation purchase');
assert.doesNotMatch(property, /\/api\/property-collectible\/checkout|collectAndSave|Collect voxel ·/, 'guided creation must not demand a second collectible checkout');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided paid property creation must not call metered Meshy endpoints');
assert.doesNotMatch(property, /insufficient funds|needs credits|add Meshy credits/i, 'guided UI must not expose provider-credit dead ends');

assert.match(viewer, /const GRID_WIDTH = 32/, 'photo-matched building keeps more horizontal facade detail');
assert.match(viewer, /const GRID_HEIGHT = 24/, 'local grid stays bounded for mobile performance');
assert.match(viewer, /const previewUrl = imageUrl \|\| sourceImageUrl/, 'generated 3D picture is shown before the voxel');
assert.match(viewer, /Create 3D Voxel from this picture/, 'user must explicitly approve voxelization after seeing the picture');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'background cells must become empty space');
assert.match(viewer, /if \(recipe\.depths\[index\] <= 0\) continue/, 'interactive viewer must not instantiate background voxels');
assert.match(viewer, /sourceImageUrl/, '3D sampling uses the original property photo rather than only the styled review picture');
assert.match(viewer, /InstancedMesh/, 'local voxel is real WebGL geometry');
assert.doesNotMatch(viewer, /backingGeometry/, 'the old square backing slab must stay removed');

assert.match(localVoxel, /if \(recipe\.depths\[index\] <= 0\) continue/, 'saved glTF must preserve the empty background too');
assert.match(localVoxel, /reviewed facade voxel recipe/, 'saved record documents the review-first model');
assert.match(localVoxel, /model\/gltf\+json/, 'a durable glTF can be rebuilt from the compact recipe');
assert.match(localStore, /Deliberately table-only/, 'local record persistence deliberately avoids Storage');
assert.doesNotMatch(localStore, /createBucket|storage\.from/, 'local record persistence must not touch a Storage bucket');

assert.match(mintPrepare, /requireVoxelVaultUser/, 'optional mint preparation remains account-authenticated');
assert.match(mintPrepare, /readCatalog3DByTask/, 'optional mint uses the exact persisted local voxel');
assert.match(mintPrepare, /does not represent the deed or physical-property rights/i, 'digital NFT mint cannot be presented as physical property ownership');

console.log('Paid VoxelPop property regression passed: sign in -> photo -> one $4.99 payment -> visible 3D picture review -> explicit photo-matched local voxel -> address/map -> save to My World -> optional mint, with no second creation paywall, Meshy credits, or checkout bucket.');
