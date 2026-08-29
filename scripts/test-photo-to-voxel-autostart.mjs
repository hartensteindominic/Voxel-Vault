import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/PropertyJourneyPhotoVoxelMint.js');
const depthPreview = read('app/property/PhotoDepthPreview.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const map = read('app/property/PropertyWorldMap.js');
const mintPrepare = read('app/api/property-local-voxel/mint/prepare/route.ts');

assert.match(property, /async function payAndUnlock3DPicture\(\)/, 'photo approval owns the paid 3D-picture handoff');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'approved photo is retained on-device before checkout');
assert.match(property, /Payment confirmed\. First inspect your actual house as a movable 3D picture/, 'paid return stops at the house-picture checkpoint');
assert.doesNotMatch(property, /await startLocalBuild\(pendingPhoto, draftId\)/, 'paid return must not auto-start voxelization');
assert.match(property, /PhotoDepthPreview imageUrl=\{pendingPreview\}/, 'the actual house photo becomes the first interactive 3D view');
assert.match(property, /onReady=\{\(\) => \{[\s\S]*setPhoto3dReady\(true\)/, 'the picture stage has an explicit ready signal');
assert.match(property, /async function create3DVoxel\(\)/, 'voxel creation is a separate action after the picture');
assert.match(property, /if \(!pendingPhoto \|\| !paidSessionId \|\| !photo3dReady \|\| busy\) return/, 'voxel cannot start before picture readiness and paid entitlement');
assert.match(property, /createVoxelPoster\(pendingPhoto\)/, 'voxel styling starts only after explicit picture approval');
assert.match(property, /LocalVoxelModelViewer imageUrl=\{voxelPoster \|\| pendingPreview\} sourceImageUrl=\{pendingPreview \|\| voxelPoster\}/, 'the voxel viewer samples the original house photo for better matching');
assert.match(property, /This looks right → Mint/, 'the voxel itself must be reviewed before the mint stage');
assert.match(property, /\/api\/property-local-voxel\/mint\/prepare/, 'approved voxel has a property-specific mint preparation path');
assert.match(property, /\/api\/property-local-voxel\/mint\/confirm/, 'submitted property mint is verified before success');
assert.match(property, /Resume mint verification/, 'a submitted mint is resumed rather than duplicated');
assert.match(property, /async function mapBuilding\(event\)/, 'My World mapping remains available after the main picture/voxel/mint flow');
assert.match(property, /async function saveToMyWorld\(\)/, 'mapped voxel still saves into My World');

assert.match(depthPreview, /new THREE\.Texture\(image\)/, '3D picture visibly uses the actual house photo');
assert.match(depthPreview, /new THREE\.PlaneGeometry/, '3D picture uses real geometry rather than replacing the house with a stock render');
assert.match(depthPreview, /callbackRef\.current\?\.\(\)/, '3D picture signals readiness only after rendering');
assert.match(viewer, /sampleRecipe/, 'interactive voxel geometry remains derived from the property photo');
assert.match(viewer, /rgbDistance/, 'viewer estimates photo background separately from the building');
assert.match(viewer, /rawMask/, 'viewer computes a building foreground mask');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'sky and ground can become empty voxel cells');
assert.match(viewer, /InstancedMesh/, 'interactive 3D uses actual Three.js voxel instances');
assert.match(viewer, /DRAG BUILDING · PINCH TO ZOOM/, 'local voxel remains interactive on iPhone');
assert.doesNotMatch(viewer, /backingGeometry/, 'viewer must not restore the old square picture-wall backing');

assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout explicitly selects the local generation engine');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout must not imply source upload');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto/i, 'paid checkout must never call Meshy capacity checks');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|image-to-3d|storage\.from/i, 'paid resume must never call Meshy or Supabase Storage');
assert.match(localVoxel, /saveLocalVoxelRecord/, 'local voxel uses the table-only account record');
assert.match(localVoxel, /buildGltf\(recipe\)/, 'saved local recipes remain reconstructable as real glTF');
assert.match(mintPrepare, /paidPropertyGenerationReceipt/, 'mint reuses the verified property purchase instead of a creator-pack Meshy entitlement');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy/i, 'property voxel mint does not depend on Meshy credits');

assert.match(property, /setAtlasBuildings\(Array\.isArray\(atlas\?\.buildings\) \? atlas\.buildings : \[\]\)/, 'address resolution retains nearby source-backed buildings');
assert.match(property, /PropertyWorldMap selectedBuilding=\{building\} buildings=\{atlasBuildings\}/, 'My World preview uses the focused property map');
assert.match(map, /ExtrudeGeometry/, 'property map extrudes source-backed building footprints');
assert.match(map, /touchAction = 'none'/, 'property map supports direct touch interaction');
assert.match(map, /Zoom property map in/, 'property map exposes explicit mobile zoom controls');

assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|collectAndSave/, 'normal paid creation flow must not lead into another paid collectible funnel');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided property flow must not call metered provider generation routes');

console.log('Property journey regression passed: authorized photo -> one paid unlock -> actual 3D picture review -> explicit recognizable local voxel -> voxel review -> optional verified Base mint -> optional My World map, with no Meshy credits or automatic voxelization.');
