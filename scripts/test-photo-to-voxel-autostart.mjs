import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/page.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const map = read('app/property/PropertyWorldMap.js');

assert.match(property, /async function usePhotoAndBuild\(\)/, 'photo approval owns the paid build handoff');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'approved photo is retained on-device before checkout');
assert.match(property, /await startLocalBuild\(pendingPhoto, draftId\)/, 'a verified paid session can start locally without another charge');
assert.match(property, /createVoxelPoster\(photo\)/, 'local build creates the VoxelPop image first');
assert.match(property, /setPipelinePhase\('voxel-3d'\)/, 'the image automatically advances to local 3D');
assert.match(property, /LocalVoxelModelViewer imageUrl=\{voxelImage \|\| displaySource\} onReady=\{handleLocal3DReady\}/, 'the local viewer must report actual WebGL readiness');
assert.match(property, /registerLocalRecipe\(recipe\)/, 'finished local 3D is registered for account/collection continuity');
assert.match(property, /setPipelinePhase\('world'\)/, 'successful local 3D automatically advances to the address/world step');
assert.match(property, /Try local build again/, 'local rendering retains a retry path');

assert.match(viewer, /sampleRecipe/, 'interactive local 3D must be derived from the rendered image');
assert.match(viewer, /InstancedMesh/, 'interactive 3D uses actual Three.js voxel instances');
assert.match(viewer, /renderer\.domElement\.style\.opacity = '0'/, '3D canvas begins hidden behind the image');
assert.match(viewer, /renderer\.domElement\.style\.opacity = '1'/, '3D canvas fades in only after a successful first render');
assert.match(viewer, /callbackRef\.current\?\.\(recipe\)/, 'server registration begins only after the local model rendered');
assert.match(viewer, /DRAG · PINCH TO ZOOM/, 'local 3D remains interactive on iPhone');

assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout explicitly selects the local generation engine');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout must not imply that the source was uploaded');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto/i, 'paid checkout must never call Meshy capacity checks');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|image-to-3d|storage\.from/i, 'paid resume must never call Meshy or Supabase Storage');
assert.match(localVoxel, /saveLocalVoxelRecord/, 'local 3D uses the table-only account record');
assert.match(localVoxel, /buildGltf\(recipe\)/, 'saved local recipes must be reconstructable as real glTF');

assert.match(property, /setAtlasBuildings\(Array\.isArray\(atlas\?\.buildings\) \? atlas\.buildings : \[\]\)/, 'address resolution must retain nearby source-backed buildings');
assert.match(property, /PropertyWorldMap selectedBuilding=\{building\} buildings=\{atlasBuildings\}/, 'My World preview must use the improved focused property map');
assert.match(map, /ExtrudeGeometry/, 'property map should extrude source-backed building footprints');
assert.match(map, /touchAction = 'none'/, 'property map must support direct touch interaction');
assert.match(map, /Zoom property map in/, 'property map must expose explicit mobile zoom controls');
assert.match(map, /selected \? 0x7138f5/, 'selected building must be visually distinct');

assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided property flow must not call metered provider generation routes');
assert.doesNotMatch(property, /Resume final 3D|add Meshy credits|Meshy still needs credits/i, 'old credit-recovery UI must be removed from the guided flow');

console.log('Property automatic journey regression passed: authorized photo -> device-local paid handoff -> VoxelPop image first -> local interactive 3D -> compact account record -> improved source-backed property map, with no Meshy credits used.');
