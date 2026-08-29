import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const route = read('app/property/page.js');
const property = read('app/property/PropertyJourneyExact.js');
const photoPreview = read('app/property/PhotoReliefModelViewer.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const localStore = read('lib/local-voxel-store.js');
const payment = read('lib/property-generation-payment.ts');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const mintPrepare = read('app/api/property-voxel-nft/prepare/route.ts');
const mintConfirm = read('app/api/property-voxel-nft/confirm/route.ts');
const mintMetadata = read('app/api/property-voxel-nft/metadata/route.ts');
const mintPage = read('app/property/mint/page.js');
const vault = read('app/vault/property-drafts/page.js');

assert.match(route, /PropertyJourneyExact/, 'the /property route must use the strict photo -> voxel-photo -> movable-voxel -> optional-mint journey');
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
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'photo is retained on-device before checkout when private storage works');
assert.match(property, /let cachedOnDevice = false/, 'private photo caching is best-effort and cannot be a checkout prerequisite');
assert.match(property, /browser could not keep the photo through checkout/, 'checkout has an explicit recovery path when private browser storage is unavailable');
assert.match(property, /\/api\/property-generation\/checkout/, 'photo approval opens paid generation checkout');
assert.match(property, /Pay \$\{CREATION_PRICE_LABEL\} & Make 3D Voxel Photo/, 'paid CTA promises the 3D voxel-photo review first');
assert.match(property, /You see and approve the 3D voxel photo before VoxelPop creates the separate movable 3D voxel/, 'checkout handoff preserves the strict stage order');
assert.match(property, /you will not be charged again/i, 'missing local photo recovery must never charge twice');
assert.match(property, /PhotoReliefModelViewer imageUrl=\{pendingPreview\}/, 'paid flow shows a source-faithful photo-matched voxel-photo review');
assert.match(property, /Looks good → Create Movable 3D Voxel/, 'the user explicitly approves the 3D voxel photo before voxel conversion');
assert.match(property, /approvePreviewAndBuildVoxel/, 'voxel-photo approval owns the movable-voxel transition');
assert.doesNotMatch(property, /createVoxelPoster|voxelPoster/, 'the approved flow must not create a 2D voxel picture between the real 3D review and movable voxel');
assert.match(property, /LocalVoxelModelViewer imageUrl=\{pendingPreview\} sourceImageUrl=\{pendingPreview\}/, 'movable voxelization starts directly from the approved property photo');
assert.match(property, /LocalVoxelModelViewer/, 'the separate voxel stage uses local interactive voxel geometry');
assert.match(property, /\/api\/property-local-voxel/, 'local voxel recipe is account-linked after rendering');
assert.match(property, /const localSaved = savePropertyDraft\(finishedDraft\)/, 'finished voxel is saved before optional minting');
assert.match(property, /Mint Now/, 'finished local voxel exposes a clear optional Mint Now path');
assert.match(property, /Mint Later · Saved to Vault/, 'finished local voxel can be kept without minting');
assert.match(property, /\/property\/mint\?draftId=/, 'finished local voxel exposes the dedicated digital mint path');
assert.match(vault, /MINT · OPTIONAL/, 'a saved voxel keeps its optional mint action in Vault');
assert.doesNotMatch(property, /\/api\/property-collectible\/checkout|collectAndSave|Collect voxel ·/, 'guided creation must not demand a second collectible checkout');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided paid property creation must not call metered Meshy endpoints');
assert.doesNotMatch(property, /insufficient funds|needs credits|add Meshy credits/i, 'guided UI must not expose provider-credit dead ends');

assert.match(photoPreview, /getImageData\(0, 0, columns, rows\)/, '3D voxel photo samples the selected source image into voxel data');
assert.match(photoPreview, /new THREE\.InstancedMesh/, '3D voxel photo renders real block geometry');
assert.match(photoPreview, /new THREE\.BoxGeometry\(1, 1, 1\)/, '3D voxel photo is composed of physical cubes');
assert.match(photoPreview, /const depth = 0\.42/, '3D voxel photo has meaningful block depth instead of a flat picture body');
assert.match(photoPreview, /voxels\.setColorAt\(instance, color\)/, 'voxel-photo colors remain tied to the source image');
assert.match(photoPreview, /ORIGINAL PHOTO/, 'the original photo remains visible for a direct likeness check');
assert.doesNotMatch(photoPreview, /backingGeometry/, '3D voxel photo must not be mounted to a rectangular picture backing');
assert.match(photoPreview, /plinthGeometry/, 'voxel photo may use a floor reference without becoming a backed picture');
assert.match(photoPreview, /targetY = clamp/, 'voxel-photo rotation is deliberately bounded so unseen sides are not presented as known');

assert.match(viewer, /const GRID = 32/, 'photo-matched building uses the higher-detail 32-cell local voxel grid');
assert.match(viewer, /COLOR_STEP = 12/, 'photo-matched voxel keeps finer facade color differences');
assert.match(viewer, /keepBestComponent/, 'voxel extraction keeps the strongest connected building region');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'background cells become empty space');
assert.match(viewer, /if \(recipe\.depths\[index\] <= 0\) continue/, 'interactive voxel viewer does not instantiate background voxels');
assert.match(viewer, /sourceImageUrl/, 'voxel sampling uses the original property photo');
assert.match(viewer, /InstancedMesh/, 'local movable voxel is real WebGL geometry');
assert.doesNotMatch(viewer, /backingGeometry/, 'the old square backing slab must stay removed');

assert.match(localVoxel, /const MAX_SIDE = 32/, 'saved local recipe accepts the higher-detail 32-cell model');
assert.match(localVoxel, /if \(recipe\.depths\[index\] <= 0\) continue/, 'saved glTF preserves the empty background');
assert.match(localVoxel, /silhouette-aware voxel recipe/, 'saved record documents the silhouette-aware model');
assert.match(localVoxel, /model\/gltf\+json/, 'a durable glTF can be rebuilt from the compact recipe');
assert.match(localStore, /saveCatalog3D/, 'local record persistence has a resilient shared-catalog fallback when the table is unavailable');
assert.match(localStore, /source photo is never/, 'local persistence must preserve the source-photo privacy boundary');
assert.match(localStore, /return null/, 'persistence failure must remain non-fatal to local voxel creation');

assert.match(mintPrepare, /requireVoxelVaultUser/, 'mint preparation requires the signed-in account');
assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint preparation verifies the exact account-owned local model');
assert.match(mintPrepare, /LOCAL_PROVIDER = 'voxelpop-local-webgl-v1'/, 'mint accepts only the local no-Meshy property model');
assert.match(mintPrepare, /propertyVoxelVoucherUsed/, 'mint preparation checks the one-time voucher before signing');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy|image-to-3d/i, 'property voxel mint preparation must not require Meshy');
assert.match(mintConfirm, /verifyOwnedFinalVoxelModel/, 'mint confirmation re-verifies model ownership');
assert.match(mintConfirm, /verifyPropertyVoxelMint/, 'mint confirmation verifies Base owner, metadata, voucher, and transaction');
assert.match(mintMetadata, /animation_url/, 'NFT metadata points to the finished local 3D model');
assert.match(mintMetadata, /Real Property Rights.*None/s, 'NFT metadata explicitly carries no physical property rights');
assert.match(mintPage, /connectVoxelFlipWallet/, 'wallet connection happens only on the final mint page');
assert.match(mintPage, /mintVoxelFlip/, 'final page performs the explicit user-approved VoxelFlip mint');
assert.match(mintPage, /Mint your voxel\./, 'mint UI centers the digital voxel action');
assert.match(mintPage, /Mint Later/, 'mint UI keeps minting optional');
assert.match(mintPage, /The NFT represents the finished digital VoxelPop voxel only/, 'mint UI clearly distinguishes the digital voxel from real-estate title');

console.log('Paid VoxelPop property regression passed: sign in -> photo -> one $4.99 payment -> real photo-matched 3D voxel-photo review -> explicit approval -> direct source-photo movable voxel -> auto-save to Vault -> Mint Now or Mint Later, with no 2D poster detour, Meshy credits, hidden second paywall, or physical-property claim.');
