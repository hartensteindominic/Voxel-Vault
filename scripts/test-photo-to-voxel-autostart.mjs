import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/PropertyJourneySimple.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const map = read('app/property/PropertyWorldMap.js');

assert.match(property, /async function payAndCreate\(\)/, 'photo approval owns the paid creation handoff');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'approved photo is retained on-device before checkout');
assert.match(property, /await startLocalBuild\(pendingPhoto, draftId\)/, 'a verified paid session can start locally without another charge');
assert.match(property, /createVoxelPoster\(photo\)/, 'local build creates the VoxelPop image first');
assert.match(property, /LocalVoxelModelViewer imageUrl=\{voxelPoster \|\| pendingPreview\} sourceImageUrl=\{pendingPreview \|\| voxelPoster\}/, 'the local viewer receives the original photo reference for better building matching');
assert.match(property, /\/api\/property-local-voxel/, 'finished local 3D is registered for continuity');
assert.match(property, /Enter the property address to match it to the real mapped building footprint/, 'successful local 3D has an obvious next step');
assert.match(property, /async function mapBuilding\(event\)/, 'address step maps the selected real-world building');
assert.match(property, /async function saveToMyWorld\(\)/, 'map step has a direct save continuation');
assert.match(property, /Save to My World/, 'the next action is visible to the user');
assert.match(property, /View My World/, 'the completed journey has a clear destination');

assert.match(viewer, /sampleRecipe/, 'interactive local 3D is derived from the property photo');
assert.match(viewer, /rgbDistance/, 'viewer estimates photo background separately from the building');
assert.match(viewer, /rawMask/, 'viewer computes a building foreground mask');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'sky and ground can become empty voxel cells');
assert.match(viewer, /InstancedMesh/, 'interactive 3D uses actual Three.js voxel instances');
assert.match(viewer, /renderer\.domElement\.style\.opacity = '0'/, '3D canvas begins hidden behind the image');
assert.match(viewer, /renderer\.domElement\.style\.opacity = '1'/, '3D canvas fades in after a successful first render');
assert.match(viewer, /callbackRef\.current\?\.\(recipe\)/, 'server registration starts only after local render');
assert.match(viewer, /DRAG BUILDING · PINCH TO ZOOM/, 'local 3D remains interactive on iPhone');
assert.doesNotMatch(viewer, /backingGeometry/, 'viewer must not restore the old square picture-wall backing');

assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout explicitly selects the local generation engine');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout must not imply source upload');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto/i, 'paid checkout must never call Meshy capacity checks');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|image-to-3d|storage\.from/i, 'paid resume must never call Meshy or Supabase Storage');
assert.match(localVoxel, /saveLocalVoxelRecord/, 'local 3D uses the table-only account record');
assert.match(localVoxel, /buildGltf\(recipe\)/, 'saved local recipes remain reconstructable as real glTF');
assert.match(localVoxel, /if \(recipe\.depths\[index\] <= 0\) continue/, 'reopened glTF also omits background cells');

assert.match(property, /setAtlasBuildings\(Array\.isArray\(atlas\?\.buildings\) \? atlas\.buildings : \[\]\)/, 'address resolution retains nearby source-backed buildings');
assert.match(property, /PropertyWorldMap selectedBuilding=\{building\} buildings=\{atlasBuildings\}/, 'My World preview uses the focused property map');
assert.match(map, /ExtrudeGeometry/, 'property map extrudes source-backed building footprints');
assert.match(map, /touchAction = 'none'/, 'property map supports direct touch interaction');
assert.match(map, /Zoom property map in/, 'property map exposes explicit mobile zoom controls');
assert.match(map, /selected \? 0x7138f5/, 'selected building is visually distinct');

assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|collectAndSave/, 'normal paid creation flow must not lead into another paid collectible funnel');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided property flow must not call metered provider generation routes');

console.log('Property journey regression passed: authorized photo -> one paid unlock -> recognizable local building 3D -> source-backed address/map -> save/view My World, with no Meshy credits or second paywall.');
