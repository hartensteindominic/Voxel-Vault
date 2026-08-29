import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const propertyRoute = read('app/property/page.js');
const property = read('app/property/PropertyStudioFlow.js');
const photoPreview = read('app/property/PhotoReliefModelViewer.js');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const confirm = read('app/api/property-generation/confirm/route.ts');
const finalize = read('app/api/property-generation/finalize/route.ts');
const mintPrepare = read('app/api/property-voxel-nft/prepare/route.ts');
const mintPage = read('app/property/mint/page.js');
const vault = read('app/vault/property-drafts/page.js');

assert.match(propertyRoute, /PropertyStudioFlow/, 'the live property route uses the guided property studio');
assert.match(property, /Start with one great photo\./, 'the flow starts with one obvious photo action');
assert.match(property, /Confirm the address\./, 'address confirmation follows photo selection');
assert.match(property, /\/api\/property-generation\/confirm/, 'address confirmation uses the dedicated one-property lock endpoint');
assert.doesNotMatch(property, /\/api\/property-generation\/checkout|generation_session|Pay \$|Stripe/i, 'the live studio contains no per-property checkout or payment resume path');

assert.match(property, /PhotoReliefModelViewer/, 'the photo is rebuilt as a voxel preview stage');
assert.match(photoPreview, /getImageData\(0, 0, columns, rows\)/, 'the source image supplies voxel color data');
assert.match(photoPreview, /new THREE\.InstancedMesh/, 'the voxel preview uses real voxel instances');
assert.match(photoPreview, /new THREE\.BoxGeometry\(1, 1, 1\)/, 'the voxel preview is physical cube geometry');
assert.match(property, /setVoxelImageReady\(true\)/, 'the flow detects when the voxel preview is ready');
assert.match(property, /Build the 3D voxel/, 'the page-by-page flow asks for an explicit continue action after preview');
assert.match(property, /setStage\('build'\)/, 'preview approval advances into the dedicated 3D build page');

assert.match(property, /LocalVoxelModelViewer imageUrl=\{photoUrl\} sourceImageUrl=\{photoUrl\} onReady=\{saveFinishedVoxel\}/, 'movable voxel builds directly from the selected property photo');
assert.match(property, /\/api\/property-local-voxel/, 'the finished local voxel is registered for continuity and minting');
assert.match(property, /\/api\/property-generation\/finalize/, 'the property lock is finalized only after the 3D voxel exists');
assert.match(property, /const localSaved = savePropertyDraft\(finishedDraft\)/, 'the finished voxel is saved to Inventory automatically');
assert.match(property, /savePropertyDraftToAccount/, 'the saved voxel is associated with the signed-in account');
assert.match(property, /Mint this voxel/, 'completion exposes the mint action');
assert.match(property, /Keep in Inventory/, 'completion also preserves the inventory-only choice');
assert.match(property, /modelUrl=\$\{encodeURIComponent\(final3d\.modelUrl\)\}/, 'the finished model URL is handed to Mint');
assert.match(vault, /directMintHref/, 'saved local voxels can recover their mint route from Inventory');
assert.match(vault, /modelUrl=\$\{encodeURIComponent\(modelUrl\)\}/, 'Inventory includes the saved model URL when opening Mint');

assert.match(viewer, /sampleRecipe/, 'the interactive local voxel derives from the property photo');
assert.match(viewer, /rawMask/, 'the viewer separates the building from background');
assert.match(viewer, /InstancedMesh/, 'the movable voxel uses actual Three.js voxel instances');
assert.match(viewer, /DRAG BUILDING · PINCH TO ZOOM/, 'the local voxel stays interactive on iPhone');
assert.match(localVoxel, /saveLocalVoxelRecord/, 'local voxel persists an account-bound record');
assert.match(localVoxel, /buildGltf\(recipe\)/, 'saved local recipes remain reconstructable as glTF');

assert.match(confirm, /inspectWorldAtlas/, 'the address is verified against mapped building data');
assert.match(confirm, /acquirePropertyCollectibleReservation/, 'a confirmed property gets a duplicate-safe reservation');
assert.match(finalize, /updatePropertyCollectibleReservation/, 'a completed voxel gets a permanent property lock');
assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint checks the exact account-owned finished voxel');
assert.match(mintPrepare, /already been minted|duplicate mint/i, 'mint blocks a second NFT for the same property');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy|image-to-3d/i, 'mint does not reintroduce provider generation');
assert.match(mintPage, /Keep in Inventory/i, 'the mint page keeps inventory ownership useful without immediate minting');
assert.match(mintPage, /readPropertyDrafts/, 'Mint can recover model continuity from older saved Inventory links');

console.log('Property studio regression passed: photo -> address -> voxel preview -> explicit 3D build -> automatic Inventory save -> optional one-of-one mint.');
