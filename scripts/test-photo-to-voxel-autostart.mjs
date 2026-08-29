import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/PropertyJourneyExact.js');
const photoPreview = read('app/property/PhotoReliefModelViewer.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const map = read('app/property/PropertyWorldMap.js');
const mintPrepare = read('app/api/property-voxel-nft/prepare/route.ts');
const mintPage = read('app/property/mint/page.js');
const vault = read('app/vault/property-drafts/page.js');

assert.match(property, /async function payAndCreate\(\)/, 'photo approval owns the paid creation handoff');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'selected photo is retained on-device before checkout');
assert.match(property, /propertyPhotoKey/, 'saved properties have a stable private device-photo key');
assert.match(property, /loadSavedPropertyPhoto/, 'saved properties can reopen their prior photo');
assert.match(property, /My Properties/, 'saved properties remain directly reusable creation sources');
assert.match(property, /sourcePhotoRetainedOnDevice: true/, 'saved records keep the device-local source-photo boundary explicit');
assert.match(property, /setPaidSessionId\(alreadyPaid \? 'saved-property' : ''\)/, 'a previously paid saved property is recognized as already paid');
assert.match(property, /no second creation charge/i, 'a paid saved property does not require a second creation purchase');
assert.match(property, /Demo property slice · not real-property ownership/, 'sandbox items remain clearly demo-only');
assert.match(property, /Payment verified\. Loading your 3D voxel photo first\./, 'paid resume stops at the voxel-photo review stage first');

assert.match(property, /PhotoReliefModelViewer/, '3D voxel photo is a distinct stage');
assert.match(photoPreview, /InstancedMesh/, '3D voxel photo is built from real voxel instances');
assert.match(photoPreview, /getImageData/, 'the actual selected photo supplies voxel color data');
assert.match(photoPreview, /setColorAt/, 'voxel colors remain tied to the selected photo');
assert.match(photoPreview, /targetY = clamp/, 'voxel-photo rotation stays deliberately bounded');
assert.match(property, /Looks good → Create Movable 3D Voxel/, 'user approval is required before the movable voxel');
assert.match(property, /async function approvePreviewAndBuildVoxel\(\)/, 'movable voxel generation has an explicit approval gate');
assert.match(property, /const poster = await createVoxelPoster\(pendingPhoto\)/, 'movable-voxel source is generated only after approval');
assert.match(property, /LocalVoxelModelViewer imageUrl=\{voxelPoster \|\| pendingPreview\} sourceImageUrl=\{pendingPreview \|\| voxelPoster\}/, 'movable voxel stays tied to the approved source photo');
assert.match(property, /\/api\/property-local-voxel/, 'finished local voxel is registered for continuity and minting');
assert.match(property, /const localSaved = savePropertyDraft\(finishedDraft\)/, 'finished voxel saves to Vault before minting');
assert.match(property, /Your 3D voxel is ready and saved to Vault/, 'successful creation clearly reports its saved state');
assert.match(property, /Mint Now/, 'finished voxel exposes optional Mint Now');
assert.match(property, /Mint Later · Saved to Vault/, 'finished voxel can remain saved without minting');
assert.match(vault, /MINT · OPTIONAL/, 'Vault keeps the mint step optional');

assert.match(viewer, /sampleRecipe/, 'interactive local voxel is derived from the property photo');
assert.match(viewer, /rgbDistance/, 'local voxel estimates background separately from the building');
assert.match(viewer, /rawMask/, 'local voxel computes a building foreground mask');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'sky and ground can become empty voxel cells');
assert.match(viewer, /InstancedMesh/, 'movable voxel uses actual Three.js voxel instances');
assert.match(viewer, /callbackRef\.current\?\.\(recipe\)/, 'server registration begins only after a real local voxel render');
assert.match(viewer, /DRAG BUILDING · PINCH TO ZOOM/, 'movable voxel remains interactive on iPhone');
assert.doesNotMatch(viewer, /backingGeometry/, 'movable voxel does not restore a picture-wall backing');

assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout selects the local generation engine');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout keeps the source photo device-local');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto/i, 'checkout never depends on Meshy credits');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|image-to-3d|storage\.from/i, 'paid resume never depends on Meshy or private source-photo storage');
assert.match(localVoxel, /saveLocalVoxelRecord/, 'local voxel uses the account record');
assert.match(localVoxel, /buildGltf\(recipe\)/, 'saved local recipes remain reconstructable as glTF');

assert.match(property, /Optional · add this voxel to My World/, 'map placement remains optional after creation');
assert.match(property, /Add to My World/, 'optional map save action remains available');
assert.match(property, /View My World/, 'saved mapped voxel retains a World destination');
assert.match(map, /ExtrudeGeometry/, 'property map extrudes source-backed building footprints');
assert.match(map, /touchAction = 'none'/, 'property map supports direct touch interaction');
assert.match(map, /Zoom property map in/, 'property map exposes explicit mobile zoom controls');

assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint checks the account-owned finished voxel');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy|image-to-3d/i, 'mint does not reintroduce Meshy');
assert.match(mintPage, /Mint your voxel\./, 'mint page presents a clear consumer decision');
assert.match(mintPage, /Mint Later/, 'mint page preserves the non-mint path');
assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|collectAndSave/, 'normal creation does not enter a second paid collectible funnel');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided flow does not call metered provider generation routes');

console.log('Photo-to-voxel regression passed: reusable photo -> one paid unlock -> 3D voxel photo -> explicit approval -> separate local movable voxel -> Vault -> optional World or mint.');
