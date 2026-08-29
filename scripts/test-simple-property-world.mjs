import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homeCss = read('app/home.module.css');
const propertyRoute = read('app/property/page.js');
const property = read('app/property/PropertyStudioFlow.js');
const propertyCss = read('app/property/PropertyStudio.module.css');
const photoPreview = read('app/property/PhotoReliefModelViewer.js');
const localViewer = read('app/property/LocalVoxelModelViewer.js');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const confirm = read('app/api/property-generation/confirm/route.ts');
const finalize = read('app/api/property-generation/finalize/route.ts');
const mintPrepare = read('app/api/property-voxel-nft/prepare/route.ts');
const mintPage = read('app/property/mint/page.js');
const vault = read('app/vault/property-drafts/page.js');
const world = read('app/world/page.js');
const worldApi = read('app/api/world-properties/route.ts');
const myWorldApi = read('app/api/world-properties/mine/route.ts');
const drafts = read('lib/property-drafts.js');
const dock = read('app/components/FinancialOSNav.js');
const command = read('app/components/AppCommandCenter.js');

assert.match(home, /PROPERTY → COLLECTIBLE/, 'home communicates the focused property collectible product');
assert.match(home, /confirm the address/i, 'home includes address confirmation');
assert.match(home, /saved to Inventory first/i, 'home makes Inventory persistence clear');
assert.match(home, /Mint if you want|Minting optional/i, 'home keeps minting optional');
assert.match(home, /This collectible is digital only\./, 'home identifies the product as a digital collectible');
assert.match(home, /does not create or transfer deed, title/i, 'home keeps the physical-property rights boundary visible');
assert.doesNotMatch(home, /BUY A PIECE|BUY THE WHOLE THING|blockchain deed|guaranteed returns|guaranteed yield/i, 'unsafe property-purchase or return language stays out of home');
assert.match(homeCss, /#6f42f5/i, 'home uses the new Voxel Vault purple');
assert.match(homeCss, /#c9ff55/i, 'home uses the playful lime accent');
assert.match(homeCss, /@media\(max-width:620px\)/, 'home includes a dedicated mobile layout');

assert.match(propertyRoute, /PropertyStudioFlow/, '/property must use the guided property studio');
assert.match(propertyCss, /#6f42f5/i, 'creator shares the new purple design system');
assert.match(propertyCss, /#c9ff55/i, 'creator shares the new lime design system');
assert.match(propertyCss, /safe-area-inset-bottom/, 'property flow respects iPhone safe areas');
assert.match(propertyCss, /@media \(max-width: 640px\)/, 'creator has a focused phone layout');

assert.match(property, /Continue with Google/, 'account gate has one clear action');
assert.match(property, /const PROGRESS = \[[\s\S]*PHOTO[\s\S]*ADDRESS[\s\S]*VOXEL[\s\S]*BUILD[\s\S]*VAULT/, 'the creator exposes the five-stage property journey');
assert.match(property, /Start with one great photo\./, 'first signed-in screen is photo-first');
assert.match(property, /accept="image\/\*,\.heic,\.heif"/, 'iPhone HEIC/HEIF selection remains supported');
assert.match(property, /normalizeIphonePhoto/, 'iPhone photo preparation remains automatic');
assert.match(property, /Confirm the address\./, 'address confirmation is the second page');
assert.match(property, /\/api\/property-generation\/confirm/, 'the creator uses the one-property confirmation API');
assert.doesNotMatch(property, /\/api\/property-generation\/checkout|Pay \$|Stripe/i, 'the live creator has no per-property checkout');

assert.match(property, /PhotoReliefModelViewer/, 'voxel preview remains a real generated stage');
assert.match(photoPreview, /getImageData\(0, 0, columns, rows\)/, 'voxel preview samples the uploaded image');
assert.match(photoPreview, /new THREE\.InstancedMesh/, 'voxel preview uses real voxel geometry');
assert.match(property, /Build the 3D voxel/, 'preview gets a clear page-by-page continue action');
assert.match(property, /setStage\('build'\)/, 'preview approval advances to the 3D build page');

assert.match(property, /LocalVoxelModelViewer imageUrl=\{photoUrl\} sourceImageUrl=\{photoUrl\} onReady=\{saveFinishedVoxel\}/, '3D voxel builds directly from the uploaded property photo');
assert.match(localViewer, /const GRID = 32/, 'building voxel keeps the higher-detail local grid');
assert.match(localViewer, /InstancedMesh/, 'local viewer builds real Three.js voxel geometry');
assert.match(localVoxel, /const MAX_SIDE = 32/, 'server accepts the higher-detail local recipe');
assert.match(property, /\/api\/property-local-voxel/, 'finished 3D voxel is registered server-side');
assert.match(property, /\/api\/property-generation\/finalize/, 'one-property lock becomes permanent only after a finished voxel exists');
assert.match(property, /const localSaved = savePropertyDraft\(finishedDraft\)/, 'finished voxel auto-saves to Inventory');
assert.match(property, /savePropertyDraftToAccount/, 'finished voxel also saves to the signed-in account');
assert.match(property, /Mint this voxel/, 'completion exposes minting');
assert.match(property, /Keep in Inventory/, 'completion also exposes the no-mint Inventory path');
assert.match(property, /modelUrl=\$\{encodeURIComponent\(final3d\.modelUrl\)\}/, 'finished voxel sends the saved 3D model to Mint');

assert.match(confirm, /inspectWorldAtlas/, 'address confirmation resolves a source-backed building');
assert.match(confirm, /propertyCollectibleIdentity/, 'address confirmation derives a stable property identity');
assert.match(confirm, /acquirePropertyCollectibleReservation/, 'address confirmation blocks concurrent duplicate creation');
assert.match(finalize, /updatePropertyCollectibleReservation/, 'finished voxel finalizes the property lock');
assert.match(finalize, /state: 'paid'/, 'finished lock is promoted to the permanent pre-mint reservation state');
assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint preparation verifies ownership of the exact finished local voxel');
assert.match(mintPrepare, /already been minted|duplicate mint/i, 'mint preparation blocks duplicate minting');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy|image-to-3d/i, 'property mint does not require Meshy');
assert.match(mintPage, /Keep in Inventory/i, 'mint page still allows keeping the voxel without minting immediately');
assert.match(mintPage, /readPropertyDrafts/, 'mint page can recover a model from an older Inventory link');
assert.match(vault, /directMintHref/, 'Inventory can recover the direct mint route');
assert.match(vault, /modelUrl=\$\{encodeURIComponent\(modelUrl\)\}/, 'Inventory carries the actual saved model into Mint');

assert.doesNotMatch(property, /PropertyWorldMap|mapBuilding|saveToMyWorld|Add to My World/, 'World/map controls stay out of the core creation funnel');
assert.match(world, /MY WORLD \+ PUBLIC WORLD/, 'World remains available as its own organized destination');
assert.match(myWorldApi, /requireVoxelVaultUser/, 'My World feed stays authenticated');
assert.match(worldApi, /toFixed\(3\)/, 'public coordinates remain privacy-rounded');
assert.match(drafts, /world:\s*\{\s*public:\s*false/, 'new saved drafts remain private by default');
assert.match(property, /does not create rights in the physical property/i, 'creator preserves the physical-property rights boundary');

assert.match(dock, /const DOCK = \[[\s\S]*id: 'home'[\s\S]*id: 'create'[\s\S]*id: 'vault'/, 'mobile navigation stays condensed to Home, Create, and Vault');
assert.doesNotMatch(dock, /id: 'world'|id: 'more'/, 'World and More stay out of the primary mobile dock');
assert.match(dock, /usesPropertyStudioNavigation/, 'the old dock stays out of the redesigned studio, mint, and Inventory pages');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search stays hidden on simple routes');

console.log('Property studio checks passed: photo -> address -> voxel preview -> explicit 3D build -> Inventory -> optional mint, with one-property/one-mint protection and a consistent mobile design.');
