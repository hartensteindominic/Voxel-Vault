import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/PropertyJourneySimple.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const map = read('app/property/PropertyWorldMap.js');

assert.match(property, /async function payAndCreatePicture\(\)/, 'photo approval owns the paid picture handoff');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'approved photo is retained on-device before checkout');
assert.match(property, /await startPictureBuild\(pendingPhoto\)/, 'a verified paid session can create the picture without another charge');
assert.match(property, /createVoxelPoster\(photo\)/, 'local flow creates the VoxelPop picture first');
assert.match(property, /Does this look like your house\?/, 'the paid flow pauses for picture review');
assert.match(property, /Looks like my house → Create 3D voxel/, 'the user explicitly approves before voxelization');
assert.match(property, /setPictureApproved\(true\)/, 'picture approval is a distinct state transition');
assert.match(property, /LocalVoxelModelViewer imageUrl=\{voxelPoster \|\| pendingPreview\} sourceImageUrl=\{pendingPreview \|\| voxelPoster\}/, 'the voxel receives the original photo reference for better building matching');
assert.match(property, /\/api\/property-local-voxel/, 'finished local voxel is registered for continuity/minting');
assert.match(property, /Voxel ready\. Enter the property address/, 'successful local voxel has an obvious map next step');
assert.match(property, /async function mapBuilding\(event\)/, 'address step maps the selected real-world building');
assert.match(property, /async function saveToMyWorld\(\)/, 'map step has a direct save continuation');
assert.match(property, /Save voxel to My World/, 'the next save action is visible');
assert.match(property, /Mint digital voxel →/, 'the completed journey exposes optional digital minting');

assert.match(viewer, /sampleRecipe/, 'interactive local voxel is derived from the original property photo');
assert.match(viewer, /function gridFor\(image\)/, 'viewer preserves image proportions in the voxel grid');
assert.match(viewer, /rgbDistance/, 'viewer estimates photo background separately from the building');
assert.match(viewer, /rawMask/, 'viewer computes a building foreground mask');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'sky and ground can become empty voxel cells');
assert.match(viewer, /InstancedMesh/, 'interactive 3D uses actual Three.js voxel instances');
assert.match(viewer, /renderer\.domElement\.style\.opacity = '0'/, '3D canvas begins hidden behind the approved picture');
assert.match(viewer, /renderer\.domElement\.style\.opacity = '1'/, '3D canvas fades in after a successful first render');
assert.match(viewer, /callbackRef\.current\?\.\(recipe\)/, 'server registration starts only after local render');
assert.match(viewer, /DRAG VOXEL · PINCH TO ZOOM/, 'local voxel remains interactive on iPhone');
assert.doesNotMatch(viewer, /backingGeometry/, 'viewer must not restore the old square picture-wall backing');

assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout selects the local generation engine');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout does not imply source upload');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto/i, 'paid checkout never calls Meshy capacity checks');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|image-to-3d|storage\.from/i, 'paid resume never calls Meshy or Supabase Storage');
assert.match(localVoxel, /saveLocalVoxelRecord/, 'local 3D uses the table-only account record');
assert.match(localVoxel, /buildGltf\(recipe\)/, 'saved local recipes remain reconstructable as real glTF');
assert.match(localVoxel, /if \(recipe\.depths\[index\] <= 0\) continue/, 'reopened glTF omits background cells');

assert.match(property, /setAtlasBuildings\(Array\.isArray\(atlas\?\.buildings\) \? atlas\.buildings : \[\]\)/, 'address resolution retains nearby source-backed buildings');
assert.match(property, /PropertyWorldMap selectedBuilding=\{building\} buildings=\{atlasBuildings\}/, 'My World preview uses the focused property map');
assert.match(map, /ExtrudeGeometry/, 'property map extrudes source-backed building footprints');
assert.match(map, /touchAction = 'none'/, 'property map supports direct touch interaction');
assert.match(map, /Zoom property map in/, 'property map exposes mobile zoom controls');
assert.match(map, /selected \? 0x7138f5/, 'selected building is visually distinct');

assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|collectAndSave/, 'normal paid creation never enters another paid collectible funnel');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided property flow never calls metered provider generation routes');

console.log('Property journey regression passed: authorized photo -> one paid unlock -> review 3D picture -> approve movable voxel -> source-backed address/map -> save My World -> optional digital mint.');
