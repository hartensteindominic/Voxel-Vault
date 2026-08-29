import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homeCss = read('app/home.module.css');
const homePreview = read('app/components/HomeProductPreview.js');
const topNav = read('app/components/ProductTopNav.js');
const propertyRoute = read('app/property/page.js');
const property = read('app/property/HouseVoxelMintFlow.js');
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

assert.match(propertyRoute, /HouseVoxelMintFlow/, '/property must use the house photo -> voxel -> mint flow');
assert.match(home, /HOUSE PHOTO → VOXEL → MINT/, 'home communicates the new product in one short line');
assert.match(home, /confirm the address/i, 'home includes address confirmation');
assert.match(home, /Saved to Inventory/i, 'home makes inventory persistence clear');
assert.doesNotMatch(home, /\$4\.99|Create mine/i, 'home no longer inserts a checkout into the core flow');
assert.match(homePreview, /LocalVoxelModelViewer/, 'home shows the actual interactive finished voxel viewer');
assert.match(homePreview, />Address</, 'home proof includes address confirmation');
assert.doesNotMatch(homePreview, /\$4\.99/, 'home preview has no price badge');
assert.match(topNav, /label: 'Create'/, 'primary nav has one create destination');
assert.match(topNav, /label: 'Inventory'/, 'primary nav exposes the saved inventory');
assert.doesNotMatch(topNav, /\$4\.99/, 'primary nav does not advertise a checkout');
assert.doesNotMatch(home, /BUY A PIECE|BUY THE WHOLE THING|blockchain deed|guaranteed returns|guaranteed yield/i, 'unsafe property-purchase or return language stays out of home');

assert.match(homeCss, /#fffaf3|#fffaf2|#fff9f1/i, 'home keeps the warm VoxelPop canvas');
assert.match(property, /#fff9f1/i, 'creator keeps the warm VoxelPop canvas');
assert.match(property, /#824dff|#7a44ff/i, 'VoxelPop purple remains');
assert.match(property, /#caff56/i, 'VoxelPop lime remains');
assert.match(property, /safe-area-inset-bottom/, 'property flow respects iPhone safe areas');

assert.match(property, /Continue with Google/, 'account gate has one clear action');
assert.match(property, /const LABELS = \['PHOTO', 'ADDRESS', 'VOXEL IMAGE', '3D VOXEL', 'DONE'\]/, 'the creator shows the exact five-stage house journey');
assert.match(property, /Upload one house photo\./, 'first signed-in screen is photo-first');
assert.match(property, /accept="image\/\*,\.heic,\.heif"/, 'iPhone HEIC/HEIF selection remains supported');
assert.match(property, /normalizeIphonePhoto/, 'iPhone photo preparation remains automatic');
assert.match(property, /Confirm the address\./, 'address confirmation is the only user gate after photo selection');
assert.match(property, /\/api\/property-generation\/confirm/, 'the creator uses the one-property confirmation API');
assert.doesNotMatch(property, /\/api\/property-generation\/checkout|Pay \$|Stripe/i, 'the new core creator has no checkout');

assert.match(property, /PhotoReliefModelViewer/, 'voxel image remains a real generated stage');
assert.match(photoPreview, /getImageData\(0, 0, columns, rows\)/, 'voxel image samples the uploaded image');
assert.match(photoPreview, /new THREE\.InstancedMesh/, 'voxel image uses real voxel geometry');
assert.match(property, /setStage\('model'\)/, 'voxel image automatically advances to 3D generation');
assert.doesNotMatch(property, /Looks good · continue|approveVoxelImage|previewApproved/, 'there is no extra approval step after the address');

assert.match(property, /LocalVoxelModelViewer imageUrl=\{photoUrl\} sourceImageUrl=\{photoUrl\} onReady=\{saveFinishedVoxel\}/, '3D voxel builds directly from the uploaded house photo');
assert.match(localViewer, /const GRID = 32/, 'building voxel keeps the higher-detail local grid');
assert.match(localViewer, /InstancedMesh/, 'local viewer builds real Three.js voxel geometry');
assert.match(localVoxel, /const MAX_SIDE = 32/, 'server accepts the higher-detail local recipe');
assert.match(property, /\/api\/property-local-voxel/, 'finished 3D voxel is registered server-side');
assert.match(property, /\/api\/property-generation\/finalize/, 'one-property lock becomes permanent only after a finished voxel exists');
assert.match(property, /const localSaved = savePropertyDraft\(finishedDraft\)/, 'finished voxel auto-saves to Inventory');
assert.match(property, /savePropertyDraftToAccount/, 'finished voxel also saves to the signed-in account');
assert.match(property, /Mint voxel/, 'completion exposes minting');
assert.match(property, /Keep in inventory/, 'completion also exposes the no-mint inventory path');
assert.match(property, /\/property\/mint\?draftId=/, 'finished voxel retains its dedicated mint route');

assert.match(confirm, /inspectWorldAtlas/, 'address confirmation resolves a source-backed building');
assert.match(confirm, /propertyCollectibleIdentity/, 'address confirmation derives a stable property identity');
assert.match(confirm, /acquirePropertyCollectibleReservation/, 'address confirmation blocks concurrent duplicate creation');
assert.match(finalize, /updatePropertyCollectibleReservation/, 'finished voxel finalizes the property lock');
assert.match(finalize, /state: 'paid'/, 'finished lock is promoted to the existing permanent reservation state');
assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint preparation verifies ownership of the exact finished local voxel');
assert.match(mintPrepare, /already been minted|duplicate mint/i, 'mint preparation blocks duplicate minting');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy|image-to-3d/i, 'property mint does not require Meshy');
assert.match(mintPage, /Mint Later/, 'mint page still allows keeping the voxel without minting immediately');
assert.match(vault, /directMintHref/, 'Inventory can recover the direct mint route');

assert.doesNotMatch(property, /PropertyWorldMap|mapBuilding|saveToMyWorld|Add to My World/, 'World/map controls stay out of the core creation funnel');
assert.match(world, /MY WORLD \+ PUBLIC WORLD/, 'World remains available as its own organized destination');
assert.match(myWorldApi, /requireVoxelVaultUser/, 'My World feed stays authenticated');
assert.match(worldApi, /toFixed\(3\)/, 'public coordinates remain privacy-rounded');
assert.match(drafts, /world:\s*\{\s*public:\s*false/, 'new saved drafts remain private by default');
assert.match(property, /does not create rights in the physical property/i, 'creator preserves the physical-property rights boundary');

assert.match(dock, /const DOCK = \[[\s\S]*id: 'home'[\s\S]*id: 'create'[\s\S]*id: 'vault'/, 'mobile navigation stays condensed to Home, Create, and Vault');
assert.doesNotMatch(dock, /id: 'world'|id: 'more'/, 'World and More stay out of the primary mobile dock');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search stays hidden on simple routes');

console.log('House voxel flow checks passed: photo -> address confirmation -> voxel image -> automatic 3D voxel -> Inventory -> optional mint, with one-property/one-mint protection.');
