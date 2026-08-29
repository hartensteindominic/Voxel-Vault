import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/PropertyJourneySimple.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const preview = read('app/property/PhotoDepthPreview.js');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const map = read('app/property/PropertyWorldMap.js');

assert.match(property, /async function payAndPreview\(\)/, 'photo approval owns the paid preview handoff');
assert.match(property, /let cachedOnDevice = false/, 'device photo caching is best-effort instead of a checkout blocker');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'approved photo is retained on-device when the browser permits it');
assert.match(property, /browser could not keep the photo privately through checkout/i, 'checkout has a clear recovery path when private browser storage is unavailable');
assert.match(property, /const labels = \['PHOTO', 'PAY', '3D PREVIEW', 'VOXEL', 'MAP', 'SAVE \+ MINT'\]/, 'the journey visibly separates preview, voxel, map, and mint stages');
assert.match(property, /paidSessionId \? 3 : pendingPhoto \? 2 : 1/, 'verified payment lands on preview before voxelization');
assert.match(property, /PhotoDepthPreview imageUrl=\{pendingPreview\}/, 'the paid stage renders the photo-faithful 3D preview');
assert.match(property, /3D PHOTO PREVIEW · NOT VOXEL YET/, 'preview is explicitly distinguished from the voxel');
assert.match(property, /async function startVoxelBuild\(\)/, 'voxelization has its own explicit user-approved action');
assert.match(property, /Looks right · Create Voxel 3D/, 'the user approves the 3D preview before voxelization');
assert.doesNotMatch(property, /await startVoxelBuild\(/, 'payment return must not auto-start voxelization');
assert.match(property, /createVoxelPoster\(pendingPhoto\)/, 'approved source photo is voxelized locally only after preview approval');
assert.match(property, /LocalVoxelModelViewer imageUrl=\{voxelPoster \|\| pendingPreview\} sourceImageUrl=\{pendingPreview \|\| voxelPoster\}/, 'voxel viewer receives the original source for direct comparison');
assert.match(property, /\/api\/property-local-voxel/, 'finished local voxel is registered for continuity');
assert.match(property, /Match this voxel to the real map/, 'finished voxel has an obvious source-backed map step');
assert.match(property, /async function mapBuilding\(event\)/, 'address step maps the selected real-world building');
assert.match(property, /async function saveToMyWorld\(\)/, 'map step has a direct save continuation');
assert.match(property, /Save Voxel to My World/, 'save action is visible to the user');
assert.match(property, /href="\/vault\/properties\/claim">Verify \+ Mint · Optional/, 'mint is an explicit final optional action');
assert.match(property, /View My World/, 'the completed journey has a clear destination');

assert.match(preview, /new THREE\.Texture\(image\)/, '3D preview uses the exact source photo as its texture');
assert.match(preview, /PlaneGeometry/, '3D preview has real interactive relief geometry');
assert.match(preview, /DRAG TO TILT · PINCH TO ZOOM/, '3D preview is touch-interactive on iPhone');
assert.match(preview, /Depth is estimated locally/, 'preview states the single-photo geometry limitation');

assert.match(viewer, /gridForImage/, 'voxel grid dimensions follow the source photo aspect');
assert.match(viewer, /const MAX_SIDE = 24/, 'local voxel recipe remains within the server-supported detail limit');
assert.match(viewer, /rgbDistance/, 'viewer estimates photo background separately from the building');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'sky and ground can become empty voxel cells');
assert.match(viewer, /InstancedMesh/, 'interactive voxel uses actual Three.js instances');
assert.match(viewer, />VOXEL<\//, 'viewer exposes voxel comparison mode');
assert.match(viewer, />SOURCE<\//, 'viewer exposes original-source comparison mode');
assert.match(viewer, /object-fit:contain/, 'source comparison must not square-crop the property photo');
assert.match(viewer, /callbackRef\.current\?\.\(recipe\)/, 'server registration starts only after local render');
assert.match(viewer, /DRAG TO ROTATE · PINCH TO ZOOM/, 'voxel remains interactive on iPhone');
assert.doesNotMatch(viewer, /backingGeometry/, 'viewer must not restore the old square picture-wall backing');

assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout explicitly selects the local generation engine');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout must not imply source upload');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto/i, 'paid checkout must never call Meshy capacity checks');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|image-to-3d|storage\.from/i, 'paid resume must never call Meshy or Supabase Storage');
assert.match(localVoxel, /saveLocalVoxelRecord/, 'local voxel uses the table-only account record');
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

console.log('Property journey regression passed: authorized photo -> one paid unlock -> photo-faithful 3D preview -> user-approved local voxel -> source-backed map -> save -> optional mint, with no Meshy credits or second paywall.');
