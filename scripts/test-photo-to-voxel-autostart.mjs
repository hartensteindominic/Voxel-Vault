import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/PropertyJourneyExact.js');
const photoPreview = read('app/property/PhotoReliefModelViewer.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const localStore = read('lib/local-voxel-store.js');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const map = read('app/property/PropertyWorldMap.js');
const mintPrepare = read('app/api/property-voxel-nft/prepare/route.ts');
const mintPage = read('app/property/mint/page.js');
const vault = read('app/vault/property-drafts/page.js');

assert.match(property, /async function payAndCreate\(\)/, 'photo approval owns the paid creation handoff');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'approved photo is retained on-device before checkout');
assert.match(property, /propertyPhotoKey/, 'saved properties receive a stable private device-photo key');
assert.match(property, /loadSavedPropertyPhoto/, 'a saved property can reopen the image it previously used');
assert.match(property, /My Properties/, 'saved properties are directly selectable as creation sources');
assert.match(property, /sourcePhotoRetainedOnDevice: true/, 'saved property records keep the reusable-photo boundary explicit');
assert.match(property, /setPaidSessionId\(alreadyPaid \? 'saved-property' : ''\)/, 'a saved paid property is recognized as already paid');
assert.match(property, /This creation is already paid, so there is no second creation charge/, 'a previously paid saved property does not require a second creation purchase');
assert.match(property, /Demo property slice · not real-property ownership/, 'sandbox purchases remain clearly demo-only when offered as a source item');
assert.match(property, /setMessage\('Payment verified\. Loading your 3D voxel photo first\.'\)/,
  'a verified paid session stops at the 3D voxel-photo review stage first');
assert.match(property, /PhotoReliefModelViewer/, '3D voxel photo is a distinct stage');
assert.match(photoPreview, /getImageData\(0, 0, columns, rows\)/, 'the selected source image supplies voxel color data');
assert.match(photoPreview, /new THREE\.InstancedMesh/, 'the 3D voxel photo uses real voxel instances');
assert.match(photoPreview, /new THREE\.BoxGeometry\(1, 1, 1\)/, 'the 3D voxel photo uses physical cube geometry');
assert.match(photoPreview, /voxels\.setColorAt\(instance, color\)/, 'voxel-photo colors remain tied to the source image');
assert.match(photoPreview, /targetY = clamp/, '3D voxel-photo rotation remains deliberately bounded');
assert.match(property, /Looks good → Create Movable 3D Voxel/, 'user approval is required before movable-voxel generation');
assert.match(property, /function approvePreviewAndBuildVoxel\(\)/, 'movable-voxel generation has an explicit post-preview gate');
assert.doesNotMatch(property, /createVoxelPoster|voxelPoster/, 'the post-approval path must not manufacture a 2D voxel picture');
assert.match(property, /LocalVoxelModelViewer imageUrl=\{pendingPreview\} sourceImageUrl=\{pendingPreview\}/,
  'the movable voxel stage builds directly from the approved original photo');
assert.match(property, /\/api\/property-local-voxel/, 'finished local voxel is registered for continuity and minting');
assert.match(property, /const localSaved = savePropertyDraft\(finishedDraft\)/, 'finished voxel is saved to Vault before minting');
assert.match(property, /Your 3D voxel is ready and saved to Vault/, 'successful voxel creation makes its saved state explicit');
assert.match(property, /Mint Now/, 'successful voxel creation exposes mint as an optional next action');
assert.match(property, /Mint Later · Saved to Vault/, 'finished voxel can be kept without minting');
assert.match(property, /\/property\/mint\?draftId=/, 'mint route is built from the finished local task');
assert.match(vault, /directMintHref/, 'saved local voxels can recover their direct optional mint route from Vault');
assert.match(vault, /MINT · OPTIONAL/, 'Vault keeps minting optional after Mint Later');
assert.match(property, /async function mapBuilding\(event\)/, 'address/map remains available after voxel creation');
assert.match(property, /async function saveToMyWorld\(\)/, 'mapped voxel can still save to My World');
assert.match(property, /Optional · add this voxel to My World/, 'map placement is optional and cannot block voxel completion');
assert.match(property, /Add to My World/, 'optional map save action remains visible');
assert.match(property, /View My World/, 'saved mapped voxel retains a World destination');

assert.match(viewer, /sampleRecipe/, 'interactive local voxel is derived from the property photo');
assert.match(viewer, /rgbDistance/, 'voxel viewer estimates background separately from the building');
assert.match(viewer, /rawMask/, 'voxel viewer computes a building foreground mask');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'sky and ground can become empty voxel cells');
assert.match(viewer, /InstancedMesh/, 'voxel 3D uses actual Three.js voxel instances');
assert.match(viewer, /callbackRef\.current\?\.\(recipe\)/, 'server registration starts only after a real local voxel render');
assert.match(viewer, /DRAG BUILDING · PINCH TO ZOOM/, 'local voxel remains interactive on iPhone');
assert.doesNotMatch(viewer, /backingGeometry/, 'movable voxel must not restore the old square picture-wall backing');

assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout explicitly selects the local generation engine');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout must not imply source upload');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto/i, 'paid checkout never calls Meshy capacity checks');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|image-to-3d|storage\.from/i, 'paid resume never calls Meshy or Supabase source-photo Storage');
assert.match(localVoxel, /saveLocalVoxelRecord/, 'local voxel persists an account-bound record');
assert.match(localStore, /saveCatalog3D/, 'local voxel persistence has the shared catalog fallback');
assert.match(localStore, /return null/, 'local voxel persistence can fail closed without crashing creation');
assert.match(localVoxel, /buildGltf\(recipe\)/, 'saved local recipes remain reconstructable as real glTF');
assert.match(localVoxel, /if \(recipe\.depths\[index\] <= 0\) continue/, 'reopened glTF omits background cells');

assert.match(property, /setAtlasBuildings\(Array\.isArray\(atlas\?\.buildings\) \? atlas\.buildings : \[\]\)/, 'address resolution retains nearby source-backed buildings');
assert.match(property, /PropertyWorldMap selectedBuilding=\{building\} buildings=\{atlasBuildings\}/, 'optional My World preview uses the focused property map');
assert.match(map, /ExtrudeGeometry/, 'property map extrudes source-backed building footprints');
assert.match(map, /touchAction = 'none'/, 'property map supports direct touch interaction');
assert.match(map, /Zoom property map in/, 'property map exposes explicit mobile zoom controls');
assert.match(map, /selected \? 0x7138f5/, 'selected building is visually distinct');

assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint checks the exact account-owned finished voxel');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy|image-to-3d/i, 'mint must not sneak Meshy back into the property journey');
assert.match(mintPage, /Mint your voxel\./, 'final mint page presents a simple consumer mint decision');
assert.match(mintPage, /Mint Later/, 'final mint page keeps minting optional');
assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|collectAndSave/, 'normal paid creation flow does not lead into another paid collectible funnel');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided property flow does not call metered provider generation routes');

console.log('Property journey regression passed: saved/reusable property photo or new photo -> one paid unlock -> real 3D voxel photo -> explicit user approval -> direct source-photo movable voxel -> auto-save to Vault -> Mint Now or Mint Later, with optional map/World, resilient persistence, and no 2D poster detour, Meshy credits, or second paywall.');
