import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/PropertyJourneySimple.js');
const photoPreview = read('app/property/PhotoReliefModelViewer.js');
const rasterizer = read('app/property/rasterizeImageUrl.js');
const voxelPhotoRoute = read('app/api/property-voxel-photo/route.ts');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const mintPrepare = read('app/api/property-voxel-nft/prepare/route.ts');
const mintPage = read('app/property/mint/page.js');
const vault = read('app/vault/property-drafts/page.js');

assert.match(property, /async function payAndCreate\(\)/, 'the photo screen owns the single paid handoff');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'the approved photo is retained on-device before checkout when available');
assert.match(property, /propertyPhotoKey/, 'saved properties retain a stable private device-photo key');
assert.match(property, /loadSavedPropertyPhoto/, 'a saved property can reopen its device-local source photo');
assert.match(property, /Use a saved property instead/, 'saved-property reuse remains available without competing with the main photo action');
assert.match(property, /sourcePhotoRetainedOnDevice: true/, 'saved records keep the source-photo boundary explicit');
assert.match(property, /setPaidSessionId\('saved-property'\)/, 'a previously paid saved property is recognized as paid');
assert.match(property, /No second creation charge|not be charged twice|no second charge/i, 'saved paid properties never require a duplicate creation payment');

assert.match(rasterizer, /\/api\/property-voxel-photo/, 'the paid house photo is transformed through the dedicated VoxelPop image endpoint before review');
assert.match(rasterizer, /RENDER_MAP_KEY/, 'the approved generated image is cached for the final movable-voxel stage');
assert.match(rasterizer, /findDraftIdForPhoto/, 'the device photo is rebound to its paid property draft before provider generation');
assert.match(voxelPhotoRoute, /listPaidPropertyCollectiblesForBuyer/, 'image generation requires a permanently paid one-property reservation');
assert.match(voxelPhotoRoute, /MESHY_PROPERTY_CREDITS\.voxelImage/, 'the image stage uses only the bounded Meshy image-generation credit budget');
assert.match(voxelPhotoRoute, /reference_image_urls: \[reference\]/, 'the generated image stays conditioned on the authorized house photo');
assert.match(voxelPhotoRoute, /Preserve visible roof shape and pitch/, 'the generation prompt prioritizes the visible house identity');
assert.match(voxelPhotoRoute, /imageDataUrl/, 'the completed provider image is returned as a sampling-safe data URL for local 3D conversion');

assert.match(property, /PhotoReliefModelViewer/, 'the real 3D voxel photo remains a distinct review stage');
assert.match(photoPreview, /getImageData\(0, 0, columns, rows\)/, 'the generated VoxelPop image supplies voxel color data');
assert.match(photoPreview, /new THREE\.InstancedMesh/, 'the review uses real voxel instances');
assert.match(photoPreview, /new THREE\.BoxGeometry\(1, 1, 1\)/, 'the review is physical cube geometry');
assert.match(property, /Looks good · continue/, 'one explicit approval is required before movable-voxel generation');
assert.match(property, /function approvePreviewAndBuildVoxel\(\)/, 'movable-voxel generation has an explicit post-preview gate');
assert.doesNotMatch(property, /createVoxelPoster|voxelPoster/, 'no fake 2D voxel poster is inserted after approval');

assert.match(property, /LocalVoxelModelViewer imageUrl=\{pendingPreview\} sourceImageUrl=\{pendingPreview\}/, 'the movable voxel stays on the same approved creation handoff');
assert.match(property, /\/api\/property-local-voxel/, 'the finished local voxel is registered for continuity and minting');
assert.match(property, /const localSaved = savePropertyDraft\(finishedDraft\)/, 'the finished voxel is saved to Vault automatically');
assert.match(property, /Open Vault/, 'completion sends the user to the saved result with one primary action');
assert.match(property, /Mint NFT · optional/, 'mint remains optional and secondary');
assert.match(vault, /directMintHref/, 'saved local voxels can recover their optional mint route from Vault');
assert.match(vault, /MINT · OPTIONAL/, 'Vault keeps minting optional');

assert.match(viewer, /sampleRecipe/, 'the interactive local voxel derives from the approved creation image');
assert.match(viewer, /rawMask/, 'the viewer separates the building from background');
assert.match(viewer, /InstancedMesh/, 'the movable voxel uses actual Three.js voxel instances');
assert.match(viewer, /DRAG BUILDING · PINCH TO ZOOM/, 'the local voxel stays interactive on iPhone');
assert.match(localVoxel, /saveLocalVoxelRecord/, 'local voxel persists an account-bound record');
assert.match(localVoxel, /buildGltf\(recipe\)/, 'saved local recipes remain reconstructable as glTF');

assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout explicitly selects the paid creation entitlement');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout itself does not upload the source photo');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto/i, 'paid checkout never calls provider capacity checks');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|api\.meshy|image-to-3d|storage\.from/i, 'paid resume only verifies payment and never starts provider generation');
assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|collectAndSave/, 'normal creation has no second paid collectible funnel');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided creation does not call the old multi-pass metered provider routes');

assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint checks the exact account-owned finished voxel');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy|image-to-3d/i, 'mint does not reintroduce provider generation');
assert.match(mintPage, /Mint Later/, 'the mint page keeps minting optional');

console.log('VoxelPop creation regression passed: house photo + confirmed address -> one paid lock -> generated VoxelPop image -> real 3D voxel-photo review -> approval -> movable voxel -> automatic Vault save -> optional one-time mint.');
