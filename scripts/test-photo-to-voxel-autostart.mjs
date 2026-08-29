import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/PropertyJourneySimple.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const map = read('app/property/PropertyWorldMap.js');
const mintPage = read('app/vault/property-drafts/[draftId]/mint/page.js');
const mintPrepare = read('app/api/property-local-voxel/nft/prepare/route.ts');

assert.match(property, /async function payAndCreate\(\)/, 'photo approval owns the paid creation handoff');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'approved photo is retained on-device before checkout');
assert.match(property, /await startLocalBuild\(pendingPhoto, draftId\)/, 'a verified paid session can start the review picture locally without another charge');
assert.match(property, /createVoxelPoster\(photo\)/, 'local paid build creates the VoxelPop 3D picture first');
assert.match(property, /3D picture ready\. Review it first\./i, 'paid creation stops at a visible 3D picture review');
assert.match(property, /LocalVoxelModelViewer imageUrl=\{voxelPoster \|\| pendingPreview\} sourceImageUrl=\{pendingPreview \|\| voxelPoster\}/, 'the viewer shows the generated review picture while retaining the original photo for voxel matching');
assert.match(property, /\/api\/property-local-voxel/, 'approved local voxel is registered for continuity');
assert.match(property, /Your 3D voxel is ready\. Inspect it now, then enter the address/i, 'successful local voxel has an obvious map/save next step');
assert.match(property, /async function mapBuilding\(event\)/, 'address step maps the selected real-world building');
assert.match(property, /async function saveToMyWorld\(\)/, 'map step has a direct save continuation');
assert.match(property, /Save voxel to My World/, 'the save action names the reviewed voxel');
assert.match(property, /Mint this 3D voxel · optional/, 'mint is offered only after the voxel has been reviewed, mapped and saved');

assert.match(viewer, /sampleRecipe/, 'interactive local voxel is derived from the original property photo');
assert.match(viewer, /const previewUrl = imageUrl \|\| sourceImageUrl \|\| ''/, 'the generated 3D picture is the visible review surface');
assert.match(viewer, /const sampleUrl = sourceImageUrl \|\| imageUrl \|\| ''/, 'the original authorized photo remains the voxel sampling reference');
assert.match(viewer, /3D PICTURE READY/, 'the picture-review stage is explicit');
assert.match(viewer, /Create 3D Voxel from this picture/, 'user explicitly starts voxelization only after seeing the picture');
assert.match(viewer, /const buildRequested = Boolean\(sampleUrl && approvedUrl === sampleUrl\)/, 'voxel build remains gated by explicit picture approval');
assert.match(viewer, /setApprovedUrl\(sampleUrl\)/, 'the review button records explicit approval before the build');
assert.match(viewer, /rgbDistance/, 'viewer estimates photo background separately from the building');
assert.match(viewer, /rawMask/, 'viewer computes a building foreground mask');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'sky and ground can become empty voxel cells');
assert.match(viewer, /InstancedMesh/, 'interactive 3D uses actual Three.js voxel instances');
assert.match(viewer, /renderer\.domElement\.style\.opacity = '0'/, '3D canvas begins hidden until the approved voxel renders');
assert.match(viewer, /renderer\.domElement\.style\.opacity = '1'/, '3D canvas fades in after a successful first voxel render');
assert.match(viewer, /callbackRef\.current\?\.\(recipe\)/, 'server registration starts only after the explicitly requested local voxel renders');
assert.match(viewer, /DRAG VOXEL · PINCH TO ZOOM · MINT COMES AFTER/, 'local voxel remains interactive on iPhone and mint is clearly downstream');
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

assert.match(mintPage, /STEP 5 · OPTIONAL MINT/, 'wallet mint is the final optional step');
assert.match(mintPage, /Mint the voxel[\s\S]*you already reviewed/i, 'mint page never skips the review-before-voxel requirement');
assert.match(mintPage, /Nothing mints until you approve the wallet transaction/i, 'mint execution requires explicit wallet approval');
assert.match(mintPrepare, /readCatalog3DByTask/, 'mint preparation uses the exact persisted reviewed voxel');
assert.match(mintPrepare, /property_draft_library/, 'mint preparation verifies the signed-in account owns the saved property draft');

assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|collectAndSave/, 'normal paid creation flow must not lead into another paid collectible funnel');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided property flow must not call metered provider generation routes');

console.log('Property journey regression passed: authorized photo -> one paid unlock -> visible 3D picture review -> explicit recognizable local voxel build -> source-backed address/map -> save -> optional wallet-approved mint, with no Meshy credits or second creation paywall.');
