import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/PropertyJourneySimple.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const mintPrepare = read('app/api/property-local-voxel/mint/prepare/route.ts');
const mintMetadata = read('app/api/property-local-voxel/mint/metadata/route.ts');
const photo3d = read('app/property/PropertyPhoto3DPreview.js');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const map = read('app/property/PropertyWorldMap.js');

assert.match(property, /async function payAndCreate\(\)/, 'photo approval owns the paid creation handoff');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'approved photo is retained on-device before checkout');
assert.match(property, /await startPhoto3D\(pendingPhoto\)/, 'a verified paid session starts the 3D picture stage without another charge');
assert.match(property, /PropertyPhoto3DPreview imageUrl=\{pendingPreview\}/, 'the full-photo 3D picture is visible before voxelization');
assert.match(property, /Looks like my house → Create 3D Voxel/, 'user approval is required before voxel creation');
assert.match(property, /async function createApprovedVoxel\(\)/, 'voxel creation has an explicit post-approval action');
assert.match(property, /createVoxelPoster\(pendingPhoto\)/, 'voxel preparation starts only after the 3D picture was approved');
assert.match(property, /LocalVoxelModelViewer imageUrl=\{voxelPoster\} sourceImageUrl=\{pendingPreview\}/, 'the voxel viewer receives the same approved source house');
assert.match(property, /\/api\/property-local-voxel/, 'finished local voxel is registered for continuity and minting');
assert.match(property, /Mint this voxel on Base/, 'finished voxel exposes mint as the primary final action');
assert.match(property, /\/api\/property-local-voxel\/mint\/prepare/, 'minting uses the dedicated paid-property voucher route');
assert.match(property, /mintVoxelFlip\(/, 'the approved local voxel uses the existing VoxelFlip contract client');
assert.match(property, /Mapping to My World is optional and does not block minting/, 'mapping is explicitly non-blocking after voxel completion');
assert.match(property, /async function mapBuilding\(event\)/, 'optional address mapping still exists');
assert.match(property, /async function saveToMyWorld\(\)/, 'optional map step can still save to My World');

assert.match(photo3d, /PlaneGeometry/, '3D picture uses real Three.js geometry');
assert.match(photo3d, /new THREE\.Texture\(image\)/, '3D picture preserves the actual uploaded image as its texture');
assert.match(photo3d, /image\.naturalWidth/, '3D picture respects the source photo dimensions');
assert.match(photo3d, /NO VOXELS YET/, '3D picture stage clearly stays separate from voxel creation');

assert.match(viewer, /const MAX_GRID = 24/, 'interactive local voxel keeps a detailed local grid');
assert.match(viewer, /recipeDimensions/, 'voxel sampling preserves the source photo aspect ratio');
assert.match(viewer, /rawMask/, 'viewer computes a foreground mask from the real photo');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'sky and ground can become empty voxel cells');
assert.match(viewer, /if \(!activeCount\) throw new Error/, 'low-confidence input fails instead of fabricating a generic house');
assert.doesNotMatch(viewer, /Fallback to a simple house-like silhouette/, 'the generic replacement-house fallback must stay removed');
assert.match(viewer, /InstancedMesh/, 'interactive 3D uses actual Three.js voxel instances');
assert.match(viewer, /DRAG BUILDING · PINCH TO ZOOM/, 'local voxel remains interactive on iPhone');
assert.doesNotMatch(viewer, /backingGeometry/, 'viewer must not restore the old square picture-wall backing');

assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout explicitly selects the local generation engine');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout must not imply source upload');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto/i, 'paid checkout must never call Meshy capacity checks');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|image-to-3d|storage\.from/i, 'paid resume must never call Meshy or Supabase Storage');
assert.match(localVoxel, /saveLocalVoxelRecord/, 'local voxel uses the table-only account record');
assert.match(localVoxel, /buildGltf\(recipe\)/, 'saved local recipes remain reconstructable as real glTF');
assert.match(localVoxel, /if \(recipe\.depths\[index\] <= 0\) continue/, 'reopened glTF also omits background cells');

assert.match(mintPrepare, /paidPropertyGenerationReceipt/, 'mint preparation re-verifies the exact paid creation');
assert.match(mintPrepare, /propertyDraftItemId\(auth\.user\.id, draftId, 'voxel'\)/, 'mint preparation verifies the local voxel belongs to the signed-in account');
assert.match(mintPrepare, /isPropertyLocalVoucherUsed/, 'duplicate property voxel mints are checked before issuing a voucher');
assert.match(mintPrepare, /buildPropertyLocalMintVoucher/, 'mint preparation signs the exact local voxel metadata');
assert.doesNotMatch(mintPrepare, /MESHY|image-to-3d/i, 'property voxel minting must not reintroduce Meshy');
assert.match(mintMetadata, /animation_url: modelUrl/, 'NFT metadata points to the finished local glTF');
assert.match(mintMetadata, /not a deed, title record, rent right, investment interest, or ownership claim/, 'mint metadata preserves physical-property truth boundaries');
assert.match(mintMetadata, /sourcePhotoStoredByVoxelVault: false/, 'mint metadata does not claim the private source photo is stored');

assert.match(property, /setAtlasBuildings\(Array\.isArray\(atlas\?\.buildings\) \? atlas\.buildings : \[\]\)/, 'optional address resolution retains nearby source-backed buildings');
assert.match(property, /PropertyWorldMap selectedBuilding=\{building\} buildings=\{atlasBuildings\}/, 'optional My World preview uses the focused property map');
assert.match(map, /ExtrudeGeometry/, 'property map extrudes source-backed building footprints');
assert.match(map, /touchAction = 'none'/, 'property map supports direct touch interaction');

assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|collectAndSave/, 'normal paid creation flow must not lead into another paid collectible funnel');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided property flow must not call metered provider generation routes');

console.log('Property journey regression passed: authorized photo -> one paid unlock -> full-photo 3D picture -> explicit approval -> photo-derived voxel -> optional Base mint, with map/save optional and no Meshy credits or generic fallback house.');
