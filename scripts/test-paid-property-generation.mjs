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

assert.match(route, /PropertyJourneyExact/, 'the /property route must use the strict preview -> voxel -> mint journey');
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
assert.match(property, /Pay \$\{CREATION_PRICE_LABEL\} & Make 3D Preview/, 'paid CTA promises the preview first, not an immediate generic voxel');
assert.match(property, /After payment, you will see the 3D preview before any voxel is built/, 'checkout handoff preserves the strict stage order');
assert.match(property, /you will not be charged again/i, 'missing local photo recovery must never charge twice');
assert.match(property, /PhotoReliefModelViewer imageUrl=\{pendingPreview\}/, 'paid flow shows a source-faithful photo-based 3D preview');
assert.match(property, /Looks right → Build the 3D Voxel/, 'the user explicitly approves the 3D preview before voxel conversion');
assert.match(property, /approvePreviewAndBuildVoxel/, 'preview approval owns the voxel-build transition');
assert.match(property, /createVoxelPoster\(pendingPhoto\)/, 'voxelization starts only after preview approval');
assert.match(property, /LocalVoxelModelViewer/, 'the separate voxel stage uses local interactive voxel geometry');
assert.match(property, /\/api\/property-local-voxel/, 'local voxel recipe is account-linked after rendering');
assert.match(property, /\/property\/mint\?draftId=/, 'finished local voxel exposes the dedicated digital mint path');
assert.match(property, /Mint this digital voxel/, 'mint CTA names the digital asset rather than the physical property');
assert.doesNotMatch(property, /\/api\/property-collectible\/checkout|collectAndSave|Collect voxel ·/, 'guided creation must not demand a second collectible checkout');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided paid property creation must not call metered Meshy endpoints');
assert.doesNotMatch(property, /insufficient funds|needs credits|add Meshy credits/i, 'guided UI must not expose provider-credit dead ends');

assert.match(photoPreview, /CanvasTexture/, 'recognizable preview keeps the real source photo as the visible texture');
assert.match(photoPreview, /PlaneGeometry/, 'preview is a real Three.js surface rather than a static label change');
assert.match(photoPreview, /setZ\(/, 'preview adds bounded relief before voxelization');
assert.match(photoPreview, /targetY = clamp/, 'preview rotation is deliberately bounded so unseen sides are not invented');

assert.match(viewer, /const GRID = 24/, 'photo-matched building uses a higher-detail local voxel grid');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'background cells become empty space');
assert.match(viewer, /if \(recipe\.depths\[index\] <= 0\) continue/, 'interactive voxel viewer does not instantiate background voxels');
assert.match(viewer, /sourceImageUrl/, 'voxel sampling uses the original property photo');
assert.match(viewer, /InstancedMesh/, 'local voxel is real WebGL geometry');
assert.doesNotMatch(viewer, /backingGeometry/, 'the old square backing slab must stay removed');

assert.match(localVoxel, /if \(recipe\.depths\[index\] <= 0\) continue/, 'saved glTF preserves the empty background');
assert.match(localVoxel, /silhouette-aware voxel recipe/, 'saved record documents the silhouette-aware model');
assert.match(localVoxel, /model\/gltf\+json/, 'a durable glTF can be rebuilt from the compact recipe');
assert.match(localStore, /Deliberately table-only/, 'local record persistence deliberately avoids Storage');
assert.doesNotMatch(localStore, /createBucket|storage\.from/, 'local record persistence must not touch a Storage bucket');

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
assert.match(mintPage, /Mint the voxel\.[\s\S]*Not the house\./, 'mint UI clearly distinguishes the digital voxel from real estate title');

console.log('Paid VoxelPop property regression passed: sign in -> photo -> one $4.99 payment -> recognizable 3D preview -> explicit approval -> local voxel -> optional Base mint, with no Meshy credits, hidden second paywall, or physical-property claim.');
