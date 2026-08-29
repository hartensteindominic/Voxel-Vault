import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/HouseVoxelJourney.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const photoStart = read('app/api/property-photo-upload/route.ts');
const voxelImage = read('app/api/property-voxel-image/route.ts');
const voxel3d = read('app/api/property-voxel-3d/route.ts');
const mintPrepare = read('app/api/property-voxel-nft/prepare/route.ts');
const mintMetadata = read('app/api/property-voxel-nft/metadata/route.ts');
const mintPage = read('app/property/mint/page.js');
const vault = read('app/vault/property-drafts/page.js');

assert.match(property, /async function payAndCreate\(\)/, 'the house screen owns the single paid handoff');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'the authorized photo is retained on-device across checkout');
assert.match(property, /\/api\/property-identity/, 'the property address is explicitly confirmed before checkout');
assert.match(property, /Confirm address/, 'address confirmation is a visible user step');
assert.match(property, /addressConfirmed/, 'generation remains gated by the confirmed property identity');
assert.match(property, /one-of-one property lock/i, 'the user flow keeps the one-property lock visible');

assert.match(checkout, /generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE/, 'checkout preserves the paid generation receipt contract');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout does not upload the source photo');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient/i, 'checkout itself never spends provider credits');

assert.match(photoStart, /image-to-image/, 'the paid source photo starts directly with a voxel image pass');
assert.match(photoStart, /reference_image_urls: \[dataUri\]/, 'the authorized house photo is the direct image reference');
assert.match(photoStart, /faithful VoxelPop-style voxel architectural image/, 'the image prompt requires a faithful house voxel interpretation');
assert.match(photoStart, /MESHY_PROPERTY_CREDITS\.afterSource/, 'the direct pipeline preflights only voxel-image plus final-3D capacity');
assert.doesNotMatch(photoStart, /storage\.from|property-references/i, 'Voxel Vault does not persist a server-side copy of the source photo');

assert.match(property, /\/api\/property-photo-upload/, 'the browser starts the paid voxel image from the retained photo');
assert.match(property, /\/api\/property-voxel-image\?/, 'the browser polls the voxel image job');
assert.match(property, /voxelDone\.imageUrl|imageUrl/, 'the voxel image is a real intermediate output');
assert.match(property, /\/api\/property-voxel-3d/, 'the finished voxel image feeds the 3D provider route');
assert.match(property, /phase: 'voxel'/, 'the client requests only the final voxel phase, not a generic source-3D pass');
assert.doesNotMatch(property, /phase: 'source'/, 'the user flow does not create an unnecessary first generic 3D model');
assert.match(property, /MeshyModelViewer modelUrl=\{final3d\.modelUrl\}/, 'the final generated GLB is the movable result shown to the user');
assert.match(property, /const localSaved = savePropertyDraft\(finishedDraft\)/, 'the final generated GLB saves to Vault automatically');
assert.match(property, /Open inventory/, 'completion offers the saved inventory as the primary destination');
assert.match(property, /Mint this voxel/, 'the exact finished voxel can be minted after creation');

assert.match(voxelImage, /property-voxel-image-v1/, 'voxel-image polling remains account-token scoped');
assert.match(voxel3d, /phase === 'voxel'/, 'the 3D backend supports voxel-image-to-GLB generation');
assert.match(voxel3d, /voxelImageTaskId/, 'the final 3D backend verifies the completed voxel-image task');
assert.match(voxel3d, /propertyDraftItemId\(auth\.user\.id, draftId, phase\)/, 'the final GLB is stored as the signed-in account voxel phase');

assert.match(vault, /modelUrl/, 'inventory retains the generated model URL');
assert.match(vault, /mintHref/, 'inventory can recover mint-later for generated 3D voxels');
assert.match(vault, /Mint voxel/, 'mint-later is directly available from inventory');
assert.match(mintPage, /modelUrl: clean\(query\.get\('modelUrl'\)\)/, 'the mint page displays the saved generated GLB');
assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint checks that the model is the signed-in user\'s saved final voxel');
assert.match(mintPrepare, /listPaidPropertyCollectiblesForBuyer/, 'mint checks the paid one-property reservation');
assert.match(mintMetadata, /propertyGenerationModelUrl/, 'NFT metadata resolves the stable saved 3D model rather than the original source photo');
assert.match(mintMetadata, /one_property_one_mint: true/, 'NFT metadata carries the one-property-one-mint truth boundary');
assert.doesNotMatch(mintMetadata, /source photo.*data:image/i, 'the original house photo is never embedded into NFT metadata');

assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|collectAndSave/, 'normal creation has no second collectible checkout');
assert.doesNotMatch(property, /Looks good · continue|approvePreviewAndBuildVoxel/, 'the new product has no redundant approval stage between voxel image and final 3D');

console.log('VoxelPop creation regression passed: house photo -> confirmed address -> one paid unlock -> voxel image -> final 3D GLB -> Vault -> optional one-property mint.');
