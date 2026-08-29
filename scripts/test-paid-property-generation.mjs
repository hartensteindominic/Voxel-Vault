import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const route = read('app/property/page.js');
const property = read('app/property/PropertyJourneySimple.js');
const photoPreview = read('app/property/PhotoReliefModelViewer.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const payment = read('lib/property-generation-payment.ts');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const mintPrepare = read('app/api/property-voxel-nft/prepare/route.ts');
const mintConfirm = read('app/api/property-voxel-nft/confirm/route.ts');
const mintMetadata = read('app/api/property-voxel-nft/metadata/route.ts');
const mintPage = read('app/property/mint/page.js');
const vault = read('app/vault/property-drafts/page.js');

assert.match(route, /PropertyJourneySimple/, 'the /property route must use the condensed creator');
assert.doesNotMatch(route, /PropertyIdentityGate/, 'paid creator must not add an extra property-address gate before the photo');
assert.match(property, /const PRICE = '\$4\.99'/, 'maker shows the $4.99 creation price');
assert.match(property, /const labels = \['PHOTO', 'REVIEW', 'BUILD', 'DONE'\]/, 'creator is condensed to four user-facing stages');
assert.match(property, /Sign in once\./, 'creator keeps one account gate');
assert.match(property, /Continue with Google/, 'creator has one clear sign-in action');
assert.match(property, /Choose one house photo\./, 'creator starts with one obvious photo action');
assert.match(property, /I took this photo or have permission to use it\./, 'photo rights confirmation remains required');
assert.match(property, /Pay \$\{PRICE\} & create/, 'the paid action stays explicit and simple');
assert.match(property, /indexedDB\.open\(DEVICE_DB/, 'source photo persists privately on-device across checkout');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'photo is retained on-device before checkout when available');
assert.match(property, /\/api\/property-generation\/checkout/, 'photo approval opens the paid generation checkout');
assert.match(property, /no second charge|no second creation charge|not be charged twice/i, 'paid recovery never asks for a second creation charge');

assert.match(payment, /PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499/, 'server-authoritative VoxelPop creation price stays $4.99');
assert.match(payment, /session\.payment_status !== 'paid'/, 'generation unlock requires a paid Stripe session');
assert.match(payment, /session\.client_reference_id !== auth\.user\.id/, 'generation remains bound to the signed-in buyer');
assert.match(payment, /Number\(session\.amount_total \|\| 0\) !== PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the exact paid amount is verified server-side');
assert.match(checkout, /requireVoxelVaultUser/, 'checkout requires a signed-in account');
assert.match(checkout, /stripe\.checkout\.sessions\.create/, 'checkout remains server-created');
assert.match(checkout, /unit_amount: PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the browser cannot choose the price');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout records the device-local photo boundary');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto|storage\.from/i, 'checkout cannot call Meshy or private photo staging');
assert.match(paidVerify, /paidPropertyGenerationReceipt\(auth, stripe, generationSessionId\)/, 'Stripe receipt is verified before creation unlocks');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|api\.meshy|storage\.from/i, 'paid verification does not upload the source photo or call Meshy');

assert.match(property, /PhotoReliefModelViewer imageUrl=\{pendingPreview\}/, 'paid flow shows the real 3D voxel-photo review');
assert.match(property, /Approve the photo-matched 3D voxel photo before the movable voxel is built\./, 'review happens before movable-voxel generation');
assert.match(property, /Looks good · continue/, 'one approval action gates the movable voxel');
assert.match(property, /approvePreviewAndBuildVoxel/, 'approval owns the transition to the movable voxel');
assert.doesNotMatch(property, /createVoxelPoster|voxelPoster/, 'there is no fake 2D poster step');
assert.match(photoPreview, /new THREE\.InstancedMesh/, '3D voxel photo uses real instanced cube geometry');
assert.match(photoPreview, /new THREE\.BoxGeometry\(1, 1, 1\)/, '3D voxel photo uses physical cubes');
assert.match(photoPreview, /voxels\.setColorAt\(instance, color\)/, 'voxel-photo colors stay tied to the source image');

assert.match(property, /LocalVoxelModelViewer imageUrl=\{pendingPreview\} sourceImageUrl=\{pendingPreview\}/, 'movable voxel builds directly from the approved source photo');
assert.match(property, /\/api\/property-local-voxel/, 'finished local voxel is account-linked');
assert.match(property, /const localSaved = savePropertyDraft\(finishedDraft\)/, 'finished voxel auto-saves before optional minting');
assert.match(property, /Done\. Your movable voxel is saved to Vault\./, 'completion explicitly confirms automatic saving');
assert.match(property, /Open Vault/, 'the primary completion action goes to the saved result');
assert.match(property, /Mint NFT · optional/, 'minting remains a secondary optional action');
assert.match(property, /\/property\/mint\?draftId=/, 'finished voxel retains its dedicated mint path');
assert.match(property, /Minting is optional/, 'creator states the optional mint boundary');
assert.match(vault, /MINT · OPTIONAL/, 'Vault keeps the optional mint action');
assert.doesNotMatch(property, /\/api\/property-collectible\/checkout|collectAndSave|Collect voxel ·/, 'normal creation has no second collectible checkout');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'normal creation does not call metered provider generation routes');

assert.match(viewer, /const GRID = 32/, 'movable voxel keeps the high-detail local grid');
assert.match(viewer, /InstancedMesh/, 'movable voxel is real WebGL geometry');
assert.match(localVoxel, /const MAX_SIDE = 32/, 'saved local recipe accepts the high-detail model');
assert.match(localVoxel, /model\/gltf\+json/, 'saved voxel can reopen as glTF');

assert.match(mintPrepare, /requireVoxelVaultUser/, 'mint preparation requires the signed-in account');
assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint verifies the account-owned final model');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy|image-to-3d/i, 'mint does not reintroduce Meshy');
assert.match(mintConfirm, /verifyPropertyVoxelMint/, 'mint confirmation verifies the final chain result');
assert.match(mintMetadata, /animation_url/, 'NFT metadata points to the finished 3D model');
assert.match(mintPage, /Mint Later/, 'mint page still lets the user leave without minting');

console.log('Paid VoxelPop regression passed: sign in -> one photo -> one $4.99 payment -> real 3D voxel-photo review -> one approval -> automatic movable voxel -> automatic Vault save -> optional mint.');
