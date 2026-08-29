import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homeCss = read('app/home.module.css');
const homePreview = read('app/components/HomeProductPreview.js');
const layout = read('app/layout.js');
const propertyRoute = read('app/property/page.js');
const property = read('app/property/PropertyJourneySimple.js');
const propertyCss = read('app/property/property.module.css');
const photoPreview = read('app/property/PhotoReliefModelViewer.js');
const localViewer = read('app/property/LocalVoxelModelViewer.js');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const generationCheckout = read('app/api/property-generation/checkout/route.ts');
const mintPrepare = read('app/api/property-voxel-nft/prepare/route.ts');
const mintPage = read('app/property/mint/page.js');
const vault = read('app/vault/property-drafts/page.js');
const world = read('app/world/page.js');
const worldApi = read('app/api/world-properties/route.ts');
const myWorldApi = read('app/api/world-properties/mine/route.ts');
const drafts = read('lib/property-drafts.js');
const dock = read('app/components/FinancialOSNav.js');
const command = read('app/components/AppCommandCenter.js');

assert.match(propertyRoute, /PropertyJourneySimple/, '/property must use the condensed creator');
assert.match(home, /ONE PHOTO → ONE VOXEL/, 'home communicates the product in one short line');
assert.match(home, /3D voxel photo/i, 'home names the real review stage');
assert.match(home, /Create mine · \$4\.99/, 'home has one clear paid creation CTA');
assert.match(home, /NFT optional/, 'home keeps minting downstream and optional');
assert.match(home, /no wallet needed to create/i, 'wallet does not block core creation');
assert.match(home, /does not create or transfer ownership, deed\/title, rent, occupancy, investment, appreciation, or other rights in a physical property/i, 'home preserves the physical-property boundary');
assert.match(homePreview, /LocalVoxelModelViewer/, 'home shows the actual interactive finished voxel viewer');
assert.match(homePreview, /3D voxel photo review/i, 'home proof still tells users that a voxel-photo review happens first');
assert.doesNotMatch(home, /BUY A PIECE|BUY THE WHOLE THING|blockchain deed|guaranteed returns|guaranteed yield/i, 'unsafe property-purchase or return language stays out of the home');
assert.doesNotMatch(layout, /property-create-polish\.css/, 'legacy Create progress overrides stay unloaded');

assert.match(homeCss, /#fffaf3|#fffaf2/i, 'home keeps the warm VoxelPop canvas');
assert.match(propertyCss, /#fffaf2/i, 'creator keeps the warm VoxelPop canvas');
assert.match(propertyCss, /#7138f5/i, 'VoxelPop purple remains');
assert.match(propertyCss, /#c9ff54/i, 'VoxelPop lime remains');
assert.match(propertyCss, /safe-area-inset-bottom/, 'property flow respects iPhone safe areas');
assert.match(propertyCss, /prefers-reduced-motion/, 'property flow respects reduced-motion preferences');

assert.match(property, /Sign in once\./, 'creator exposes a simple account gate');
assert.match(property, /Continue with Google/, 'account gate has one clear action');
assert.match(property, /const labels = \['PHOTO', 'REVIEW', 'BUILD', 'DONE'\]/, 'the creator is reduced to four user-facing stages');
assert.match(property, /Choose one house photo\./, 'first signed-in screen is photo-first');
assert.match(property, /accept="image\/\*,\.heic,\.heif"/, 'iPhone HEIC/HEIF selection remains supported');
assert.match(property, /normalizeIphonePhoto/, 'iPhone photo preparation remains automatic');
assert.match(property, /I took this photo or have permission to use it\./, 'source photo requires rights confirmation');
assert.match(property, /Pay \$\{PRICE\} & create/, 'paid action is compact and explicit');
assert.match(property, /indexedDB\.open\(DEVICE_DB/, 'source photo is kept privately on-device across checkout');

assert.match(property, /PhotoReliefModelViewer/, '3D voxel photo is a first-class review stage');
assert.match(photoPreview, /getImageData\(0, 0, columns, rows\)/, '3D voxel photo samples the uploaded image');
assert.match(photoPreview, /new THREE\.InstancedMesh/, '3D voxel photo is real voxel geometry');
assert.match(photoPreview, /voxels\.setColorAt\(instance, color\)/, 'voxel-photo cells retain source-image color');
assert.match(property, /Looks good · continue/, 'one explicit approval gates movable-voxel creation');
assert.doesNotMatch(property, /createVoxelPoster|voxelPoster/, 'the creator cannot recreate a fake 2D voxel picture');
assert.match(property, /LocalVoxelModelViewer imageUrl=\{pendingPreview\} sourceImageUrl=\{pendingPreview\}/, 'movable voxel builds directly from the approved property photo');
assert.match(localViewer, /const GRID = 32/, 'building voxel keeps the higher-detail local grid');
assert.match(localViewer, /InstancedMesh/, 'local viewer builds real Three.js voxel geometry');
assert.match(localVoxel, /const MAX_SIDE = 32/, 'server accepts the higher-detail local recipe');
assert.doesNotMatch(generationCheckout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto|storage\.from/i, 'generation checkout cannot call Meshy or private source-photo Storage');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|api\.meshy|image-to-3d|storage\.from/i, 'paid resume cannot call Meshy or source-photo cloud Storage');

assert.match(property, /const localSaved = savePropertyDraft\(finishedDraft\)/, 'finished voxel auto-saves to Vault before minting');
assert.match(property, /Open Vault/, 'the creator ends with the saved result as the primary destination');
assert.match(property, /Mint NFT · optional/, 'mint remains optional and secondary');
assert.match(property, /\/property\/mint\?draftId=/, 'the saved voxel retains its dedicated mint route');
assert.match(vault, /directMintHref/, 'Vault can recover the direct optional mint route');
assert.match(vault, /MINT · OPTIONAL/, 'Vault keeps minting optional');
assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint preparation verifies ownership of the finished local voxel');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy|image-to-3d/i, 'property mint does not require Meshy');
assert.match(mintPage, /Mint Later/, 'mint page keeps minting optional');

assert.doesNotMatch(property, /PropertyWorldMap|mapBuilding|saveToMyWorld|Add to My World/, 'World/map controls stay out of the core creation funnel');
assert.match(world, /MY WORLD \+ PUBLIC WORLD/, 'World remains available as its own organized destination');
assert.match(myWorldApi, /requireVoxelVaultUser/, 'My World feed stays authenticated');
assert.match(worldApi, /toFixed\(3\)/, 'public coordinates remain privacy-rounded');
assert.match(drafts, /world:\s*\{\s*public:\s*false/, 'new saved drafts remain private by default');

assert.match(dock, /const DOCK = \[[\s\S]*id: 'home'[\s\S]*id: 'create'[\s\S]*id: 'vault'/, 'mobile navigation stays condensed to Home, VoxelPop, and Vault');
assert.doesNotMatch(dock, /id: 'world'|id: 'more'/, 'World and More stay out of the primary mobile dock');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search stays hidden on simple routes');

console.log('Simple VoxelPop checks passed: one CTA home -> four-screen creator -> real voxel-photo review -> automatic movable voxel and Vault save -> optional mint, with Home/VoxelPop/Vault as the only primary mobile actions.');
