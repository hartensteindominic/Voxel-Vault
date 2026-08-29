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
const photo3d = read('app/property/PropertyPhoto3DPreview.js');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const mintPrepare = read('app/api/property-local-voxel/mint/prepare/route.ts');
const mintMetadata = read('app/api/property-local-voxel/mint/metadata/route.ts');
const mintHelper = read('lib/property-local-mint.ts');

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
assert.match(property, /Pay \$\{CREATION_PRICE_LABEL\} & Make 3D Picture/, 'primary CTA accurately starts with the 3D picture stage');
assert.match(property, /The \$4\.99 purchase includes the 3D picture preview, your approved 3D voxel, and saving it to My World/, 'one payment includes both visual creation stages and world save');
assert.match(property, /There is no second creation payment required just to continue/, 'a second paywall cannot block the normal creation journey');
assert.match(property, /generation_session/, 'maker resumes a successful paid creation after Stripe');
assert.match(property, /form\.append\('generationSessionId', generationSessionId\)/, 'Stripe return passes the session into the payment verifier');
assert.match(property, /you will not be charged again/i, 'missing local photo recovery must never charge twice');

assert.match(property, /PropertyPhoto3DPreview/, 'the paid flow has a distinct 3D picture preview before voxels');
assert.match(property, /Looks like my house → Create 3D Voxel/, 'user must explicitly approve the 3D picture before voxelization');
assert.match(property, /createApprovedVoxel/, 'voxel creation is separated from paid return');
assert.match(property, /createVoxelPoster/, 'the approved photo is converted locally only after approval');
assert.match(property, /LocalVoxelModelViewer/, 'the approved second stage uses the local interactive voxel viewer');
assert.match(property, /\/api\/property-local-voxel/, 'local model recipe is account-linked after rendering');
assert.match(property, /Mint this voxel on Base/, 'mint is presented only after the finished local voxel');
assert.match(property, /connectVoxelFlipWallet/, 'wallet connection is deferred to the mint action');
assert.match(property, /mintVoxelFlip/, 'finished local voxel hands off to the existing Base NFT contract client');
assert.match(property, /Mapping to My World is optional and does not block minting/, 'map placement cannot block minting');
assert.match(property, /saveToMyWorld/, 'optional post-voxel continuation can still save to My World');
assert.doesNotMatch(property, /\/api\/property-collectible\/checkout|collectAndSave|Collect voxel ·/, 'guided creation must not demand a second collectible checkout');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided paid property creation must not call metered Meshy endpoints');
assert.doesNotMatch(property, /insufficient funds|needs credits|add Meshy credits/i, 'guided UI must not expose provider-credit dead ends');

assert.match(photo3d, /PlaneGeometry/, '3D picture is real interactive Three.js geometry');
assert.match(photo3d, /new THREE\.Texture\(image\)/, '3D picture uses the actual source photo as its texture');
assert.match(photo3d, /object-fit:contain/, 'the original photo is not cover-cropped in the 3D picture stage');
assert.match(viewer, /const MAX_GRID = 24/, 'photo-matched voxel uses a detailed local grid');
assert.match(viewer, /recipeDimensions/, 'voxel dimensions preserve the source photo aspect ratio');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'background cells become empty space');
assert.match(viewer, /if \(!activeCount\) throw new Error/, 'low-confidence separation stops instead of inventing a house');
assert.doesNotMatch(viewer, /Fallback to a simple house-like silhouette/, 'generic house fallback must stay removed');
assert.match(viewer, /sourceImageUrl/, 'voxel sampling uses the original approved property photo');
assert.match(viewer, /InstancedMesh/, 'local voxel is real WebGL voxel geometry');
assert.doesNotMatch(viewer, /backingGeometry/, 'the old square backing slab must stay removed');

assert.match(localVoxel, /if \(recipe\.depths\[index\] <= 0\) continue/, 'saved glTF preserves empty background too');
assert.match(localVoxel, /silhouette-aware voxel recipe/, 'saved record documents the silhouette-aware model');
assert.match(localVoxel, /model\/gltf\+json/, 'a durable glTF can be rebuilt from the compact recipe');
assert.match(localStore, /Deliberately table-only/, 'local record persistence deliberately avoids Storage');
assert.doesNotMatch(localStore, /createBucket|storage\.from/, 'local record persistence must not touch a Storage bucket');

assert.match(mintPrepare, /paidPropertyGenerationReceipt/, 'mint preparation independently verifies the $4.99 entitlement');
assert.match(mintPrepare, /readCatalog3D\(itemId\)/, 'mint preparation verifies the durable local voxel record');
assert.match(mintPrepare, /model\.task_id !== taskId/, 'mint cannot switch to a different 3D asset');
assert.match(mintPrepare, /isPropertyLocalVoucherUsed/, 'duplicate voucher use is checked before minting');
assert.match(mintPrepare, /buildPropertyLocalMintVoucher/, 'mint voucher is signed server-side');
assert.match(mintHelper, /VOXELFLIP_MINT_SIGNER_PRIVATE_KEY/, 'property mint uses the existing secure VoxelFlip signer');
assert.match(mintMetadata, /animation_url: modelUrl/, 'minted metadata exposes the exact local glTF as the 3D asset');
assert.match(mintMetadata, /sourcePhotoStoredByVoxelVault: false/, 'mint metadata preserves source-photo privacy');
assert.match(mintMetadata, /Physical property rights', value: 'None'/, 'mint metadata does not imply real-property ownership');

console.log('Paid VoxelPop property regression passed: sign in -> photo -> one $4.99 payment -> full-photo 3D picture -> user approval -> photo-derived voxel -> optional Base mint, with My World optional and no Meshy credits, generic house, or second creation paywall.');
