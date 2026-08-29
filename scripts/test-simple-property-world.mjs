import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homeCss = read('app/home.module.css');
const homePreview = read('app/components/HomeProductPreview.js');
const layout = read('app/layout.js');
const propertyRoute = read('app/property/page.js');
const property = read('app/property/HouseVoxelJourney.js');
const propertyCss = read('app/property/property.module.css');
const generationCheckout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const voxelPhoto = read('app/api/property-voxel-photo/route.ts');
const voxel3d = read('app/api/property-voxel-3d/route.ts');
const mintPrepare = read('app/api/property-voxel-nft/prepare/route.ts');
const mintPage = read('app/property/mint/page.js');
const vault = read('app/vault/property-drafts/page.js');
const world = read('app/world/page.js');
const worldApi = read('app/api/world-properties/route.ts');
const myWorldApi = read('app/api/world-properties/mine/route.ts');
const drafts = read('lib/property-drafts.js');
const dock = read('app/components/FinancialOSNav.js');
const command = read('app/components/AppCommandCenter.js');

assert.match(propertyRoute, /\.\/HouseVoxelJourney/, '/property must use the focused house creator');
assert.match(home, /HOUSE PHOTO → VOXEL → 3D · \$4\.99/, 'home communicates the exact product in one short line');
assert.match(home, /Upload a house\. Confirm the address\. Get a voxel image, then a mintable 3D voxel\./, 'home states the full sequence plainly');
assert.match(home, /Create house voxel · \$4\.99/, 'home has one clear paid creation CTA');
assert.match(home, /Saved to your Voxel Vault · mint when you want/, 'home makes saving automatic and minting optional');
assert.match(home, /One property\. One collectible\./, 'home exposes the uniqueness rule');
assert.match(home, /Digital collectible only\. No deed, title, or physical-property rights\./, 'home preserves the physical-property boundary');
assert.match(homePreview, /LocalVoxelModelViewer/, 'home keeps an interactive voxel proof object');
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
assert.match(property, /const labels = \['PHOTO', 'ADDRESS', 'VOXEL', '3D', 'DONE'\]/, 'creator is the exact five-stage house flow');
assert.match(property, /Choose one house photo\./, 'first signed-in screen is photo-first');
assert.match(property, /accept="image\/\*,\.heic,\.heif"/, 'iPhone HEIC/HEIF selection remains supported');
assert.match(property, /normalizeIphonePhoto/, 'iPhone photo preparation remains automatic');
assert.match(property, /prepareReferenceDataUrl/, 'browser safely resizes the provider reference');
assert.match(property, /I took this photo or have permission to use it\./, 'source photo requires rights confirmation');
assert.match(property, /\/api\/property-identity/, 'creator verifies the property identity before purchase');
assert.match(property, /Confirm address/, 'address confirmation is explicit');
assert.match(property, /Create voxel · \$\{PRICE\}/, 'paid action is compact and explicit');
assert.match(property, /indexedDB\.open\(DEVICE_DB/, 'source photo is kept privately on-device across checkout');

assert.doesNotMatch(generationCheckout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|storage\.from/i, 'generation checkout cannot spend provider credits or upload the private photo');
assert.match(paidVerify, /paidPropertyGenerationReceipt/, 'paid return verifies checkout before provider work');
assert.doesNotMatch(paidVerify, /image-to-image|image-to-3d|MESHY_PROPERTY_CREDITS/i, 'receipt verification itself does not run generation');
assert.match(voxelPhoto, /reference_image_urls: \[reference\]/, 'the authorized prepared photo directly drives the voxel image');
assert.match(voxelPhoto, /MESHY_PROPERTY_CREDITS\.afterSource/, 'image stage preflights capacity for image plus final 3D');
assert.match(voxelPhoto, /voxelImageTaskToken: final3dTaskToken/, 'the voxel-image route creates the signed final-3D handoff');
assert.match(property, /\/api\/property-voxel-photo\?/, 'creator waits for the real voxel-image result');
assert.match(property, /\/api\/property-voxel-3d/, 'creator sends the voxel image into final 3D generation');
assert.match(property, /phase: 'voxel'/, 'creator skips the redundant source-3D phase');
assert.doesNotMatch(property, /phase: 'source'/, 'creator never starts a generic first 3D pass');
assert.match(voxel3d, /verifiedVoxelImageUrl/, 'final 3D generation verifies the completed voxel-image task');
assert.match(voxel3d, /propertyDraftItemId\(auth\.user\.id, draftId, phase\)/, 'final GLB is saved account-scoped');
assert.match(property, /MeshyModelViewer modelUrl=\{final3d\.modelUrl\}/, 'final result is the generated movable GLB');

assert.match(property, /const localSaved = savePropertyDraft\(finishedDraft\)/, 'finished voxel auto-saves to Vault before minting');
assert.match(property, /Open inventory/, 'creator ends with the saved result as the primary destination');
assert.match(property, /Mint this voxel/, 'mint remains an optional downstream action');
assert.match(property, /\/property\/mint\?draftId=/, 'saved voxel retains its dedicated mint route');
assert.match(vault, /mintHref/, 'Vault can recover the optional mint route for generated voxels');
assert.match(vault, /Mint voxel/, 'Vault keeps minting optional');
assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint preparation verifies ownership of the generated final voxel');
assert.match(mintPrepare, /listPaidPropertyCollectiblesForBuyer/, 'mint preparation verifies the one-property reservation');
assert.match(mintPage, /Keep in inventory/, 'mint page keeps minting optional');

assert.doesNotMatch(property, /PropertyWorldMap|mapBuilding|saveToMyWorld|Add to My World/, 'World/map controls stay out of the core creation funnel');
assert.match(world, /MY WORLD \+ PUBLIC WORLD/, 'World remains available as its own organized destination');
assert.match(myWorldApi, /requireVoxelVaultUser/, 'My World feed stays authenticated');
assert.match(worldApi, /toFixed\(3\)/, 'public coordinates remain privacy-rounded');
assert.match(drafts, /world:\s*\{\s*public:\s*false/, 'new saved drafts remain private by default');

assert.match(dock, /const DOCK = \[[\s\S]*id: 'home'[\s\S]*id: 'create'[\s\S]*id: 'vault'/, 'mobile navigation stays condensed to Home, VoxelPop, and Vault');
assert.doesNotMatch(dock, /id: 'world'|id: 'more'/, 'World and More stay out of the primary mobile dock');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search stays hidden on simple routes');

console.log('Simple VoxelPop checks passed: photo -> confirmed address -> generated voxel image -> real final 3D voxel -> automatic Vault save -> optional one-property mint.');
