import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const route = read('app/property/page.js');
const property = read('app/property/PropertyJourneyPhotoVoxelMint.js');
const depthPreview = read('app/property/PhotoDepthPreview.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const localStore = read('lib/local-voxel-store.js');
const payment = read('lib/property-generation-payment.ts');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const mintPrepare = read('app/api/property-local-voxel/mint/prepare/route.ts');
const mintMetadata = read('app/api/property-local-voxel/mint/metadata/route.ts');
const mintConfirm = read('app/api/property-local-voxel/mint/confirm/route.ts');

assert.match(route, /PropertyJourneyPhotoVoxelMint/, 'the /property route must use the staged picture -> voxel -> mint journey');
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
assert.match(checkout, /source_storage: 'device-local'/, 'checkout records that the photo stays on device');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto|createBucket|storage\.from/i, 'checkout must not call Meshy or private photo staging');
assert.match(paidVerify, /paidPropertyGenerationReceipt\(auth, stripe, generationSessionId\)/, 'Stripe receipt is verified before local creation unlocks');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|storage\.from|createBucket/i, 'paid verification must not start a provider job or use Storage');

assert.match(property, /const labels = \['PHOTO', 'PAY', '3D PICTURE', '3D VOXEL', 'MINT'\]/, 'the customer sees the requested five explicit stages');
assert.match(property, /Pay \$\{CREATION_PRICE_LABEL\} & Create 3D Picture/, 'payment unlocks the 3D picture, not an automatic voxel');
assert.match(property, /PhotoDepthPreview/, 'the original house photo has its own interactive 3D-picture checkpoint');
assert.match(property, /setPhoto3dReady\(true\)/, 'the 3D picture must render before approval can continue');
assert.match(property, /disabled=\{!photo3dReady \|\| Boolean\(busy\)\}/, 'voxel creation stays locked until the 3D picture is ready');
assert.match(property, /Create 3D Voxel/, 'the voxel begins only from an explicit user action');
assert.match(property, /setVoxelRequested\(true\)/, 'voxelization has its own explicit state transition');
assert.match(property, /This looks right → Mint/, 'finished voxel has a review checkpoint before mint');
assert.match(property, /Mint this 3D voxel on Base/, 'the finished digital voxel exposes a real optional Base mint action');
assert.match(property, /connectVoxelFlipWallet/, 'minting requires an explicit wallet connection');
assert.match(property, /mintVoxelFlip/, 'property mint uses the reviewed VoxelFlip wallet contract rail');
assert.match(property, /Resume mint verification/, 'submitted mints are resumed instead of duplicated');
assert.match(property, /you will not be charged again/i, 'missing local photo recovery must never charge twice');
assert.match(property, /indexedDB\.open\(DEVICE_DB/, 'the source photo remains private on-device across Stripe');
assert.match(property, /createVoxelPoster/, 'voxel styling is created locally only after picture approval');
assert.match(property, /LocalVoxelModelViewer/, 'the paid flow uses real local interactive voxel geometry');
assert.match(property, /\/api\/property-local-voxel/, 'local model recipe is account-linked after rendering');
assert.match(property, /saveToMyWorld/, 'mapping remains available after voxel/mint without blocking mint');
assert.doesNotMatch(property, /\/api\/property-collectible\/checkout|collectAndSave/, 'the requested flow does not add a second collectible checkout');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided paid property creation must not call metered Meshy endpoints');

assert.match(depthPreview, /new THREE\.PlaneGeometry/, '3D picture uses real WebGL geometry');
assert.match(depthPreview, /new THREE\.Texture\(image\)/, 'the actual house photo remains the visible texture');
assert.match(depthPreview, /pointerdown/, '3D picture is draggable');
assert.match(depthPreview, /pinchDistance/, '3D picture supports mobile pinch depth viewing');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'background cells must become empty space in the voxel');
assert.match(viewer, /InstancedMesh/, 'local 3D is real WebGL voxel geometry');
assert.match(viewer, /sourceImageUrl/, 'voxel sampling uses the original house photo');
assert.doesNotMatch(viewer, /backingGeometry/, 'the old square backing slab must stay removed');
assert.match(localVoxel, /model\/gltf\+json/, 'the compact local recipe reopens as a real glTF');
assert.match(localStore, /Deliberately table-only/, 'local record persistence avoids source-photo Storage');

assert.match(mintPrepare, /paidPropertyGenerationReceipt\(auth, stripe, generationSessionId\)/, 'mint prepare re-verifies the same paid property creation');
assert.match(mintPrepare, /propertyDraftItemId\(auth\.user\.id, draftId, 'voxel'\)/, 'mint prepare verifies exact account/draft voxel ownership');
assert.match(mintPrepare, /findExistingPropertyVoxelMint/, 'mint prepare checks the one-time voucher before a transaction');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy|image-to-3d/i, 'property mint preparation is independent of Meshy');
assert.match(mintMetadata, /source_photo_included: false/, 'NFT metadata explicitly excludes the private source photo');
assert.match(mintMetadata, /animation_url: modelUrl/, 'NFT metadata points to the finished 3D voxel');
assert.match(mintConfirm, /verifyPropertyVoxelMintOnBase/, 'mint confirmation verifies the Base result');
assert.match(mintConfirm, /does not create ownership or other rights in the physical property/i, 'mint confirmation preserves the digital-versus-deed boundary');

console.log('Paid VoxelPop property regression passed: sign in -> photo -> one $4.99 payment -> inspect actual 3D picture -> explicitly create/review 3D voxel -> optional verified Base mint -> optional My World mapping, with no Meshy credits or second creation paywall.');
