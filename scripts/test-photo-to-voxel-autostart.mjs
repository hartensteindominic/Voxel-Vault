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

assert.match(property, /async function payAndCreate\(\)/, 'photo approval owns the paid creation handoff');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'approved photo is retained on-device before checkout when browser storage works');
assert.match(property, /let cachedOnDevice = false/, 'private browser photo caching is best-effort instead of a checkout blocker');
assert.match(property, /browser could not keep the photo through checkout/i, 'checkout explains the no-cache recovery path without charging twice');
assert.match(property, /setMessage\('Payment verified\. Loading the recognizable 3D photo preview first\.'/,
  'a verified paid session stops at the recognizable 3D photo preview');
assert.match(property, /PhotoReliefModelViewer/, 'source-faithful 3D preview is a distinct stage');
assert.match(photoPreview, /CanvasTexture/, 'the actual uploaded photo remains the visible material in the first 3D stage');
assert.match(photoPreview, /PlaneGeometry/, 'the first stage is interactive Three.js geometry');
assert.match(property, /Looks right → Build the 3D Voxel/, 'user approval is required before voxel generation');
assert.match(property, /async function approvePreviewAndBuildVoxel\(\)/, 'voxel generation has an explicit post-preview gate');
assert.match(property, /const poster = await createVoxelPoster\(pendingPhoto\)/, 'voxel image is not created until after preview approval');
assert.match(property, /const sampleWidth = aspect >= 1/, 'voxel poster preserves the source photo aspect instead of square-cropping a house');
assert.match(property, /LocalVoxelModelViewer imageUrl=\{voxelPoster \|\| pendingPreview\} sourceImageUrl=\{pendingPreview \|\| voxelPoster\}/,
  'the voxel stage uses the approved original photo for building matching');
assert.match(property, /\/api\/property-local-voxel/, 'finished local voxel is registered for continuity and minting');
assert.match(property, /Compare VOXEL with SOURCE/, 'successful voxel creation asks for a final direct visual comparison');
assert.match(property, /\/property\/mint\?draftId=/, 'mint route is built from the finished local task');
assert.match(property, /async function mapBuilding\(event\)/, 'address/map remains available after voxel creation');
assert.match(property, /async function saveToMyWorld\(\)/, 'mapped voxel can still save to My World');
assert.match(property, /Save to My World/, 'map save action remains visible');
assert.match(property, /View My World/, 'saved mapped voxel retains a World destination');

assert.match(viewer, /sampleRecipe/, 'interactive local voxel is derived from the property photo');
assert.match(viewer, /gridForImage/, 'voxel recipe follows the original wide or tall property framing');
assert.match(viewer, /rgbDistance/, 'voxel viewer estimates background separately from the building');
assert.match(viewer, /rawMask/, 'voxel viewer computes a building foreground mask');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'sky and ground can become empty voxel cells');
assert.match(viewer, /InstancedMesh/, 'voxel 3D uses actual Three.js voxel instances');
assert.match(viewer, /callbackRef\.current\?\.\(recipe\)/, 'server registration starts only after a real local voxel render');
assert.match(viewer, /DRAG BUILDING · PINCH TO ZOOM/, 'local voxel remains interactive on iPhone');
assert.match(viewer, />SOURCE<\//, 'final voxel has an original-source comparison control');
assert.match(viewer, /object-fit:contain/, 'source comparison preserves the complete property photo framing');
assert.doesNotMatch(viewer, /backingGeometry/, 'voxel viewer must not restore the old square picture-wall backing');

assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout explicitly selects the local generation engine');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout must not imply source upload');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto/i, 'paid checkout never calls Meshy capacity checks');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|image-to-3d|storage\.from/i, 'paid resume never calls Meshy or Supabase Storage');
assert.match(localVoxel, /saveLocalVoxelRecord/, 'local voxel uses the table-only account record');
assert.match(localVoxel, /buildGltf\(recipe\)/, 'saved local recipes remain reconstructable as real glTF');
assert.match(localVoxel, /if \(recipe\.depths\[index\] <= 0\) continue/, 'reopened glTF omits background cells');

assert.match(property, /setAtlasBuildings\(Array\.isArray\(atlas\?\.buildings\) \? atlas\.buildings : \[\]\)/, 'address resolution retains nearby source-backed buildings');
assert.match(property, /PropertyWorldMap selectedBuilding=\{building\} buildings=\{atlasBuildings\}/, 'My World preview uses the focused property map');
assert.match(map, /ExtrudeGeometry/, 'property map extrudes source-backed building footprints');
assert.match(map, /touchAction = 'none'/, 'property map supports direct touch interaction');
assert.match(map, /Zoom property map in/, 'property map exposes explicit mobile zoom controls');
assert.match(map, /selected \? 0x7138f5/, 'selected building is visually distinct');

assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint checks the exact account-owned finished voxel');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy|image-to-3d/i, 'mint must not sneak Meshy back into the property journey');
assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|collectAndSave/, 'normal paid creation flow does not lead into another paid collectible funnel');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided property flow does not call metered provider generation routes');

console.log('Property journey regression passed: authorized photo -> one paid unlock -> source-faithful 3D preview -> user approval -> aspect-preserved local 3D voxel -> source comparison -> optional Base mint, with map/World still available and no Meshy credits or second paywall.');
