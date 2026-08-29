import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/PropertyJourneySimple.js');
const photoPreview = read('app/property/PhotoReliefModelViewer.js');
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

assert.match(property, /PhotoReliefModelViewer/, 'the real 3D voxel photo remains a distinct review stage');
assert.match(photoPreview, /getImageData\(0, 0, columns, rows\)/, 'the source image supplies voxel color data');
assert.match(photoPreview, /new THREE\.InstancedMesh/, 'the review uses real voxel instances');
assert.match(photoPreview, /new THREE\.BoxGeometry\(1, 1, 1\)/, 'the review is physical cube geometry');
assert.match(property, /Looks good · continue/, 'one explicit approval is required before movable-voxel generation');
assert.match(property, /function approvePreviewAndBuildVoxel\(\)/, 'movable-voxel generation has an explicit post-preview gate');
assert.doesNotMatch(property, /createVoxelPoster|voxelPoster/, 'no 2D voxel poster is inserted after approval');

assert.match(property, /LocalVoxelModelViewer imageUrl=\{pendingPreview\} sourceImageUrl=\{pendingPreview\}/, 'movable voxel builds directly from the approved photo');
assert.match(property, /\/api\/property-local-voxel/, 'the finished local voxel is registered for continuity and minting');
assert.match(property, /const localSaved = savePropertyDraft\(finishedDraft\)/, 'the finished voxel is saved to Vault automatically');
assert.match(property, /Open Vault/, 'completion sends the user to the saved result with one primary action');
assert.match(property, /Mint NFT · optional/, 'mint remains optional and secondary');
assert.match(vault, /directMintHref/, 'saved local voxels can recover their optional mint route from Vault');
assert.match(vault, /MINT · OPTIONAL/, 'Vault keeps minting optional');

assert.match(viewer, /sampleRecipe/, 'the interactive local voxel derives from the property photo');
assert.match(viewer, /rawMask/, 'the viewer separates the building from background');
assert.match(viewer, /InstancedMesh/, 'the movable voxel uses actual Three.js voxel instances');
assert.match(viewer, /DRAG BUILDING · PINCH TO ZOOM/, 'the local voxel stays interactive on iPhone');
assert.match(localVoxel, /saveLocalVoxelRecord/, 'local voxel persists an account-bound record');
assert.match(localVoxel, /buildGltf\(recipe\)/, 'saved local recipes remain reconstructable as glTF');

assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout explicitly selects the local generation engine');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout does not imply source upload');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto/i, 'paid checkout never calls Meshy capacity checks');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|api\.meshy|image-to-3d|storage\.from/i, 'paid resume never calls Meshy or source-photo cloud storage');
assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|collectAndSave/, 'normal creation has no second paid collectible funnel');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided creation does not call metered provider routes');

assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint checks the exact account-owned finished voxel');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy|image-to-3d/i, 'mint does not reintroduce Meshy');
assert.match(mintPage, /Mint Later/, 'the mint page keeps minting optional');

console.log('VoxelPop creation regression passed: new or saved photo -> one paid unlock -> real 3D voxel-photo review -> one approval -> automatic movable voxel -> automatic Vault save -> optional mint.');
