import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/HouseVoxelJourney.js');
const voxelPhotoRoute = read('app/api/property-voxel-photo/route.ts');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const voxel3d = read('app/api/property-voxel-3d/route.ts');
const mintPrepare = read('app/api/property-voxel-nft/prepare/route.ts');
const mintMetadata = read('app/api/property-voxel-nft/metadata/route.ts');
const mintPage = read('app/property/mint/page.js');
const vault = read('app/vault/property-drafts/page.js');

assert.match(property, /async function payAndCreate\(\)/, 'the house screen owns the single paid handoff');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'the authorized photo is retained on-device across checkout');
assert.match(property, /\/api\/property-identity/, 'the property address is explicitly confirmed before checkout');
assert.match(property, /Confirm address/, 'address confirmation is a visible user step');
assert.match(property, /addressConfirmed/, 'generation remains gated by confirmed property identity');
assert.match(property, /one-of-one property lock/i, 'the one-property lock stays visible');

assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout preserves the paid generation receipt contract');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout does not upload the source photo');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient/i, 'checkout itself never spends provider credits');
assert.match(paidVerify, /paidPropertyGenerationReceipt/, 'post-checkout resume verifies the paid receipt before generation');
assert.doesNotMatch(paidVerify, /image-to-image|image-to-3d|MESHY_PROPERTY_CREDITS/i, 'receipt verification does not start provider work');

assert.match(voxelPhotoRoute, /listPaidPropertyCollectiblesForBuyer/, 'voxel-image generation requires the paid one-property reservation');
assert.match(voxelPhotoRoute, /MESHY_PROPERTY_CREDITS\.afterSource/, 'the image stage preflights enough credits to finish the image and final GLB');
assert.match(voxelPhotoRoute, /reference_image_urls: \[reference\]/, 'the authorized prepared house photo drives the voxel image');
assert.match(voxelPhotoRoute, /Preserve visible roof shape and pitch/, 'the voxel-image prompt preserves visible architectural identity');
assert.match(voxelPhotoRoute, /voxelImageTaskToken: final3dTaskToken/, 'the generated image receives the signed handoff needed by final 3D');
assert.match(voxelPhotoRoute, /imageUrl: providerImageUrl/, 'the finished voxel image remains a visible intermediate result');

assert.match(property, /\/api\/property-voxel-photo/, 'the browser starts and polls the dedicated voxel-image generation route');
assert.match(property, /prepareReferenceDataUrl\(photo\)/, 'the browser sends only a resized prepared reference to the image provider route');
assert.match(property, /voxelDone\.voxelImageTaskToken/, 'the signed generated-image handoff is passed into final 3D');
assert.match(property, /\/api\/property-voxel-3d/, 'the completed voxel image feeds the real final 3D provider route');
assert.match(property, /phase: 'voxel'/, 'the final GLB is built directly from the voxel image');
assert.doesNotMatch(property, /phase: 'source'/, 'there is no redundant generic first 3D pass');
assert.match(voxel3d, /verifiedVoxelImageUrl/, 'the final 3D backend verifies the generated voxel-image task');
assert.match(voxel3d, /meshy-property-voxel-style-to-3d/, 'the final model records that it came from the voxel-style image');
assert.match(voxel3d, /propertyDraftItemId\(auth\.user\.id, draftId, phase\)/, 'the final GLB is stored under the signed-in account voxel phase');

assert.match(property, /MeshyModelViewer modelUrl=\{final3d\.modelUrl\}/, 'the final generated GLB is the movable result shown to the user');
assert.match(property, /const localSaved = savePropertyDraft\(finishedDraft\)/, 'the final generated GLB saves to Vault automatically');
assert.match(property, /Open inventory/, 'completion offers the saved inventory as the primary destination');
assert.match(property, /Mint this voxel/, 'the exact finished voxel can be minted');
assert.doesNotMatch(property, /Looks good · continue|approvePreviewAndBuildVoxel/, 'there is no redundant approval screen between voxel image and final 3D');
assert.doesNotMatch(property, /\/api\/property-local-voxel|LocalVoxelModelViewer|PhotoReliefModelViewer/, 'the shipping creator does not fall back to the old local approximation path');

assert.match(vault, /mintHref/, 'inventory can recover mint-later for generated 3D voxels');
assert.match(vault, /Mint voxel/, 'mint-later is directly available from inventory');
assert.match(mintPage, /modelUrl: clean\(query\.get\('modelUrl'\)\)/, 'the mint page displays the saved generated GLB');
assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint checks that the model is the signed-in user\'s saved final voxel');
assert.match(mintPrepare, /listPaidPropertyCollectiblesForBuyer/, 'mint checks the paid one-property reservation');
assert.match(mintMetadata, /propertyGenerationModelUrl/, 'NFT metadata resolves the stable saved 3D model rather than the source photo');
assert.match(mintMetadata, /one_property_one_mint: true/, 'NFT metadata carries the one-property-one-mint boundary');

assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|collectAndSave/, 'normal creation has no second collectible checkout');

console.log('VoxelPop creation regression passed: house photo -> confirmed address -> one paid unlock -> generated voxel image -> real final 3D GLB -> Vault -> optional one-property mint.');
