import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homeCss = read('app/home.module.css');
const homePreview = read('app/components/HomeProductPreview.js');
const layout = read('app/layout.js');
const propertyRoute = read('app/property/page.js');
const property = read('app/property/PropertyJourneyExact.js');
const propertyCss = read('app/property/property.module.css');
const photoPreview = read('app/property/PhotoReliefModelViewer.js');
const localViewer = read('app/property/LocalVoxelModelViewer.js');
const propertyMap = read('app/property/PropertyWorldMap.js');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const generationCheckout = read('app/api/property-generation/checkout/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const mintPrepare = read('app/api/property-voxel-nft/prepare/route.ts');
const mintPage = read('app/property/mint/page.js');
const vault = read('app/vault/property-drafts/page.js');
const world = read('app/world/page.js');
const dock = read('app/components/FinancialOSNav.js');
const command = read('app/components/AppCommandCenter.js');

assert.match(propertyRoute, /PropertyJourneyExact/, '/property must use the strict guided journey');

assert.match(home, /Your house\./, 'home leads with the house transformation');
assert.match(home, /Pay \$4\.99 once/, 'home clearly states the one-time creation price');
assert.match(home, /3D voxel photo/, 'home names the voxel-photo review stage');
assert.match(home, /Create my house/, 'home has one strong primary creation CTA');
assert.match(home, /source photo stays on device/i, 'home explains the device-local privacy boundary');
assert.match(home, /mint after creation/i, 'home keeps minting optional and downstream');
assert.match(homePreview, /id: 'photo'/, 'homepage sample includes the original-photo state');
assert.match(homePreview, /id: 'preview'.*3D voxel photo/s, 'homepage sample includes the 3D voxel-photo state');
assert.match(homePreview, /id: 'voxel'.*Movable voxel/s, 'homepage sample includes the movable-voxel state');
assert.doesNotMatch(home, /BUY A PIECE|BUY THE WHOLE THING|guaranteed returns|guaranteed yield/i, 'home does not imply property investment rights');
assert.match(homeCss, /safe-area-inset-bottom/, 'home respects iPhone safe areas');
assert.match(layout, /'\.\/ui-system\.css';/, 'shared UI system remains loaded');
assert.doesNotMatch(layout, /property-create-polish\.css/, 'legacy Create override is no longer globally loaded');

assert.match(property, /const labels = \['PHOTO', 'PAY', '3D VOXEL PHOTO', 'MOVABLE VOXEL', 'MINT'\]/, 'Create labels enforce the current product order');
assert.match(property, /Choose a clear house photo\./, 'signed-in flow begins with a photo');
assert.match(property, /accept="image\/\*,\.heic,\.heif"/, 'iPhone HEIC and HEIF selection remains supported');
assert.match(property, /normalizeIphonePhoto/, 'iPhone photo preparation remains automatic');
assert.match(property, /I took this photo or have permission to use it\./, 'photo rights confirmation remains explicit');
assert.match(property, /Pay \$\{CREATION_PRICE_LABEL\} & Make 3D Voxel Photo/, 'payment creates the voxel-photo review stage first');
assert.match(property, /You see and approve the 3D voxel photo before VoxelPop creates the separate movable 3D voxel/, 'one payment preserves voxel-photo-before-model order');
assert.match(property, /indexedDB\.open\(DEVICE_DB/, 'source photo remains private on-device across checkout');

assert.match(property, /PhotoReliefModelViewer/, '3D voxel photo is a distinct first-class stage');
assert.match(photoPreview, /InstancedMesh/, '3D voxel photo uses real voxel geometry');
assert.match(photoPreview, /getImageData/, '3D voxel photo samples the actual source image');
assert.match(photoPreview, /setColorAt/, 'voxel cells retain source-photo color');
assert.match(photoPreview, /targetY = clamp/, 'voxel-photo rotation is bounded');
assert.match(property, /Looks good → Create Movable 3D Voxel/, 'user explicitly approves the voxel photo before model creation');
assert.match(property, /createVoxelPoster/, 'movable voxel starts only after approval');
assert.match(property, /LocalVoxelModelViewer/, 'movable voxel is a separate later stage');
assert.match(localViewer, /const GRID = 32/, 'movable voxel uses the higher-detail local grid');
assert.match(localViewer, /InstancedMesh/, 'movable voxel uses real Three.js voxel geometry');
assert.match(localViewer, /rawMask/, 'building/background separation remains part of voxel creation');
assert.doesNotMatch(localViewer, /backingGeometry/, 'movable voxel does not regress to the old picture-wall slab');
assert.match(localVoxel, /const MAX_SIDE = 32/, 'server accepts the higher-detail recipe');
assert.match(localVoxel, /model\/gltf\+json/, 'saved voxel can reopen as glTF');

assert.doesNotMatch(generationCheckout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto|storage\.from/i, 'creation checkout does not depend on Meshy or source-photo cloud storage');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|image-to-3d|storage\.from/i, 'paid resume does not depend on Meshy or source-photo cloud storage');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided Create flow does not call metered provider generation routes');

assert.match(property, /const localSaved = savePropertyDraft\(finishedDraft\)/, 'finished voxel saves to Vault before minting');
assert.match(property, /Mint Now/, 'finished voxel exposes optional Mint Now');
assert.match(property, /Mint Later · Saved to Vault/, 'finished voxel can remain saved without minting');
assert.match(vault, /MINT · OPTIONAL/, 'Vault keeps minting optional');
assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint preparation verifies the account-owned finished voxel');
assert.match(mintPage, /Mint Later/, 'mint page preserves the non-mint path');
assert.match(property, /Optional · add this voxel to My World/, 'World placement remains optional');
assert.match(propertyMap, /ExtrudeGeometry/, 'optional property map still extrudes source-backed footprints');
assert.match(world, /MY WORLD \+ PUBLIC WORLD/, 'World retains private and public contexts');

assert.match(propertyCss, /#7138f5/i, 'VoxelPop purple remains in the Create system');
assert.match(propertyCss, /#c9ff54/i, 'VoxelPop lime remains reserved for progress and success');
assert.match(propertyCss, /safe-area-inset-bottom/, 'Create respects iPhone safe areas');
assert.match(propertyCss, /prefers-reduced-motion/, 'Create respects reduced-motion preferences');
assert.match(dock, /SIMPLE_PROPERTY_DOCK/, 'simple routes retain the condensed mobile dock');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search stays out of the simple creation flow');

console.log('VoxelPop guided-flow checks passed: clear homepage -> photo -> one $4.99 payment -> 3D voxel photo review -> explicit approval -> separate movable voxel -> Vault -> optional World or mint.');
