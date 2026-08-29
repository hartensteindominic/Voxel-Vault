import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/PropertyJourneyExact.js');
const houseGenerator = read('app/property/VoxelPopHouseImageGenerator.js');
const purchasedPreview = read('app/property/PhotoReliefModelViewer.js');
const pictureRenderer = read('app/api/property-3d-picture/route.ts');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
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
assert.match(property, /setMessage\('Payment verified\. Generating your VoxelPop 3D house first\.'\)/,
  'a verified paid session stops at the generated VoxelPop house picture first');
assert.match(property, /VoxelPopHouseImageGenerator/, 'the VoxelPop house picture stays a distinct approval stage');
assert.doesNotMatch(property, /PhotoReliefModelViewer/, 'the paid property editor cannot fall back to the purchased-twin voxel-photo preview');

assert.match(houseGenerator, /\/api\/property-3d-picture/, 'the picture stage calls the dedicated paid VoxelPop image renderer');
assert.match(houseGenerator, /currentDraftContext/, 'the picture stage reconnects the browser photo to its paid draft');
assert.match(houseGenerator, /paidGenerationProof/, 'the picture stage sends either the Stripe proof or saved-paid entitlement');
assert.match(houseGenerator, /VOXELPOP 3D HOUSE/, 'the picture stage clearly identifies the generated VoxelPop house render');
assert.match(houseGenerator, /ORIGINAL REFERENCE/, 'the source photo remains visible as a comparison reference');
assert.match(houseGenerator, /Regenerate 3D/, 'the user can request another generated house render before approval');
assert.match(houseGenerator, /callbackRef\.current\?\.\(result\.payload\.image\)/, 'preview approval only unlocks after a generated image is returned');
assert.doesNotMatch(houseGenerator, /new THREE\.Texture|PlaneGeometry|BoxGeometry|setZ\(/, 'the 3D-picture stage must not regress to a photo slab or brightness relief');
assert.match(purchasedPreview, /InstancedMesh/, 'the purchased-twin preview can keep its separate interactive voxel-photo presentation');
assert.match(purchasedPreview, /3D VOXEL PHOTO/, 'the purchased-twin preview remains clearly distinct from the generated property picture stage');

assert.match(pictureRenderer, /paidPropertyGenerationReceipt/, 'new creations must prove the $4.99 Stripe entitlement before image generation');
assert.match(pictureRenderer, /verifySavedPaidDraft/, 'saved paid properties can reuse the renderer without a second charge');
assert.match(pictureRenderer, /gpt-image-2/, 'the primary image editor uses a true image-conditioned generation model');
assert.match(pictureRenderer, /\/v1\/images\/edits/, 'the primary renderer uses image editing rather than text-only generation');
assert.match(pictureRenderer, /reference_image_urls: \[reference\]/, 'the fallback renderer remains image-conditioned');
assert.match(pictureRenderer, /Preserve every clearly visible identity cue/, 'the house prompt explicitly preserves visible architectural identity');
assert.match(pictureRenderer, /Do not add a floor, move windows, invent a garage/, 'the renderer is told not to genericize the house');
assert.match(pictureRenderer, /sourceStoredByVoxelVault: false/, 'the original reference is not written to Voxel Vault generation storage');

assert.match(property, /Looks good → Create 3D Voxel/, 'user approval is required before voxel generation');
assert.match(property, /async function approvePreviewAndBuildVoxel\(\)/, 'voxel generation has an explicit post-preview gate');
assert.match(property, /const poster = await createVoxelPoster\(pendingPhoto\)/, 'the approval transition still prepares a local loading poster');
assert.match(property, /Creating the 3D voxel from the approved VoxelPop house render/, 'the voxel handoff names the approved generated render as its source');
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

assert.match(viewer, /GLOBAL_RENDER_KEY/, 'the voxel stage knows about the approved generated VoxelPop house image');
assert.match(viewer, /approvedRender \|\| sourceImageUrl \|\| imageUrl/, 'the generated VoxelPop house image is the first-choice voxel source');
assert.match(viewer, /sampleRecipe/, 'interactive local voxel is derived from the approved render');
assert.match(viewer, /rgbDistance/, 'voxel viewer estimates background separately from the building');
assert.match(viewer, /rawMask/, 'voxel viewer computes a building foreground mask');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'sky and ground can become empty voxel cells');
assert.match(viewer, /InstancedMesh/, 'voxel 3D uses actual Three.js voxel instances');
assert.match(viewer, /callbackRef\.current\?\.\(recipe\)/, 'server registration starts only after a real local voxel render');
assert.match(viewer, /DRAG BUILDING · PINCH TO ZOOM/, 'local voxel remains interactive on iPhone');
assert.doesNotMatch(viewer, /backingGeometry/, 'voxel viewer must not restore the old square picture-wall backing');

assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout explicitly selects the reviewed paid generation entitlement');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout itself still does not upload the source photo');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto/i, 'paid checkout never calls image-provider capacity checks');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|image-to-3d|storage\.from/i, 'paid resume only verifies payment and never uploads the source');
assert.match(localVoxel, /saveLocalVoxelRecord/, 'local voxel uses the table-only account record');
assert.match(localVoxel, /buildGltf\(recipe\)/, 'saved local recipes remain reconstructable as real glTF');
assert.match(localVoxel, /if \(recipe\.depths\[index\] <= 0\) continue/, 'reopened glTF omits background cells');

assert.match(property, /setAtlasBuildings\(Array\.isArray\(atlas\?\.buildings\) \? atlas\.buildings : \[\]\)/, 'address resolution retains nearby source-backed buildings');
assert.match(property, /PropertyWorldMap selectedBuilding=\{building\} buildings=\{atlasBuildings\}/, 'optional My World preview uses the focused property map');
assert.match(map, /ExtrudeGeometry/, 'property map extrudes source-backed building footprints');
assert.match(map, /touchAction = 'none'/, 'property map supports direct touch interaction');
assert.match(map, /Zoom property map in/, 'property map exposes explicit mobile zoom controls');
assert.match(map, /selected \? 0x7138f5/, 'selected building is visually distinct');

assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint checks the exact account-owned finished voxel');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy|image-to-3d/i, 'mint must not add an image-generation dependency to the final mint');
assert.match(mintPage, /Mint your voxel\./, 'final mint page presents a simple consumer mint decision');
assert.match(mintPage, /Mint Later/, 'final mint page keeps minting optional');
assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|collectAndSave/, 'normal paid creation flow does not lead into another paid collectible funnel');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided property flow does not call the old metered property provider routes');

console.log('Property journey regression passed: saved/reusable property photo or new photo -> one paid unlock -> generated VoxelPop/NFT-house 3D picture -> explicit user approval -> voxel built from that approved render -> auto-save to Vault -> Mint Now or Mint Later, with optional map/World and no second paywall.');
