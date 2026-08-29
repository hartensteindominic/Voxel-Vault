import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homeCss = read('app/home.module.css');
const propertyRoute = read('app/property/page.js');
const property = read('app/property/PropertyJourneySimple.js');
const propertyCss = read('app/property/property.module.css');
const localViewer = read('app/property/LocalVoxelModelViewer.js');
const propertyMap = read('app/property/PropertyWorldMap.js');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const generationCheckout = read('app/api/property-generation/checkout/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const vault = read('app/vault/property-drafts/page.js');
const world = read('app/world/page.js');
const worldApi = read('app/api/world-properties/route.ts');
const myWorldApi = read('app/api/world-properties/mine/route.ts');
const propertyClaimsApi = read('app/api/vault/property-claims/route.ts');
const propertyClaimRules = read('lib/vault/property-claim.js');
const canonicalRegistry = read('contracts/CanonicalPropertyRegistry.sol');
const propertyPassport = read('contracts/PropertyPassport.sol');
const interestToken = read('contracts/PropertyInterestToken.sol');
const drafts = read('lib/property-drafts.js');
const dock = read('app/components/FinancialOSNav.js');
const command = read('app/components/AppCommandCenter.js');

assert.match(propertyRoute, /PropertyJourneySimple/, '/property uses the condensed creation journey');
assert.match(home, /One VoxelPop creation costs \$4\.99/, 'home clearly discloses the creation price');
assert.match(home, /source photo stays on your device/i, 'home explains the device-local source photo boundary');
assert.match(home, /without Meshy credits/i, 'home makes the no-Meshy dependency explicit');
assert.match(home, /no wallet is required to create/i, 'wallet does not block core creation');
assert.match(home, /Voxel Vault is not a bank/i, 'home does not imply bank status');
assert.match(home, /VoxelPop item is not a deed/i, 'home separates digital items from real-property title');
assert.doesNotMatch(home, /BUY A PIECE|BUY THE WHOLE THING|blockchain deed|guaranteed returns|guaranteed yield/i, 'unverified property-purchase/return language stays out of the simple home');

for (const source of [homeCss, propertyCss, vault, world]) assert.match(source, /#fffaf0/i, 'simple surfaces keep the warm VoxelPop canvas');
assert.match(propertyCss, /#7138f5/i, 'VoxelPop purple remains');
assert.match(propertyCss, /#c9ff54/i, 'VoxelPop lime remains');
assert.match(propertyCss, /grid-template-columns:repeat\(6,1fr\)/, 'maker exposes six literal stages');
assert.match(propertyCss, /\.pictureCard\{aspect-ratio:4\/3/, 'picture review is not forced into a square card');

assert.match(property, /Sign in first\./, 'maker exposes the account gate');
assert.match(property, /Continue with Google/, 'account gate has one clear sign-in action');
assert.match(property, /const labels = \['PHOTO', 'PAY', 'PICTURE', 'VOXEL', 'WORLD', 'MINT'\]/, 'labels match the actual creation journey');
assert.match(property, /Choose your house photo\./, 'first signed-in step is photo-first');
assert.match(property, /accept="image\/\*,\.heic,\.heif"/, 'iPhone HEIC/HEIF selection remains supported');
assert.match(property, /normalizeIphonePhoto/, 'iPhone photo preparation remains automatic');
assert.match(property, /I took this photo or have permission to use it\./, 'source photo requires rights confirmation');
assert.match(property, /Pay \$\{CREATION_PRICE_LABEL\} → Create 3D picture/, 'paid CTA clearly ends at the reviewable picture');
assert.match(property, /Does this look like your house\?/, 'picture review is explicit');
assert.match(property, /Looks like my house → Create 3D voxel/, 'voxel generation requires explicit review approval');
assert.match(property, /No extra charge for choosing another photo/, 'paid users can retry a bad picture without being recharged');

assert.match(property, /indexedDB\.open\(DEVICE_DB/, 'source photo stays on-device across checkout');
assert.match(property, /createVoxelPoster/, 'VoxelPop picture is built locally');
assert.match(property, /LocalVoxelModelViewer/, 'interactive voxel is a separate stage');
assert.match(localViewer, /const MAX_GRID = 32/, 'building voxel uses higher local detail');
assert.match(localViewer, /function gridFor\(image\)/, 'building voxel preserves source aspect ratio');
assert.match(localViewer, /rawMask/, 'building/background separation remains');
assert.match(localViewer, /if \(!mask\[index\]\) return 0/, 'background becomes empty space');
assert.match(localViewer, /InstancedMesh/, 'local viewer builds real Three.js voxel geometry');
assert.doesNotMatch(localViewer, /backingGeometry/, 'old square backing slab stays gone');
assert.match(localVoxel, /propertyDraftItemId\(auth\.user\.id, draftId, 'voxel'\)/, 'finished local voxel remains account/draft bound');
assert.match(localVoxel, /const MAX_SIDE = 32/, 'server accepts the higher-detail recipe');
assert.match(localVoxel, /model\/gltf\+json/, 'compact local recipe can reopen as glTF');
assert.doesNotMatch(generationCheckout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto|createBucket|storage\.from/i, 'generation checkout cannot call Meshy/private Storage');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|image-to-3d|storage\.from/i, 'paid resume cannot call Meshy/private Storage');

assert.match(property, /Add address → match map/, 'address follows successful voxel creation');
assert.match(property, /setAtlasBuildings/, 'address lookup retains nearby source-backed buildings');
assert.match(property, /PropertyWorldMap/, 'guided map uses the focused property map');
assert.match(propertyMap, /ExtrudeGeometry/, 'focused map extrudes source-backed footprints');
assert.match(propertyMap, /pointerdown/, 'focused map supports touch drag');
assert.match(propertyMap, /Zoom property map in/, 'focused map exposes mobile zoom controls');
assert.match(property, /Save voxel to My World/, 'map has an obvious save continuation');
assert.match(property, /Mint digital voxel →/, 'completed creation has a direct optional digital mint continuation');
assert.match(property, /Open My Vault/, 'completed creation can open Vault');
assert.match(property, /savePropertyDraft\(draft\)/, 'creation saves to the existing property draft library');
assert.match(property, /savePropertyDraftToAccount/, 'creation attempts account sync without blocking local success');
assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|Collect voxel ·|collectAndSave/, 'normal creation never enters the separate collectible checkout');

assert.match(vault, /Your collection\./, 'Vault remains the collection hub');
assert.match(world, /MY WORLD \+ PUBLIC WORLD/, 'World combines private and public saved items');
assert.match(myWorldApi, /requireVoxelVaultUser/, 'My World feed stays authenticated');
assert.match(worldApi, /toFixed\(3\)/, 'public coordinates remain privacy-rounded');
assert.match(drafts, /world:\s*\{\s*public:\s*false/, 'new saved drafts remain private by default');

assert.match(propertyClaimRules, /Address text is intentionally excluded/, 'canonical real-property identity never uses display address text');
assert.match(propertyClaimsApi, /oneCanonicalTwinPerParcel:\s*true/, 'canonical claim API preserves one mint per verified parcel');
assert.match(canonicalRegistry, /PropertyAlreadyRegistered/, 'canonical registry rejects duplicate parcel identity');
assert.match(propertyPassport, /PassportAlreadyMinted/, 'Property Passport rejects a second canonical parcel mint');
assert.match(interestToken, /off-chain legal/, 'real economic rights remain defined separately by legal agreements');
assert.doesNotMatch(property, /\/vault\/properties\/claim[^\n]*Mint digital voxel/, 'creative NFT mint is not the Property Passport/title-verification path');

assert.match(dock, /SIMPLE_PROPERTY_DOCK/, 'guided maker uses the condensed consumer navigation');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search stays hidden on simple routes');

console.log('Guided VoxelPop property checks passed: sign in -> photo -> one $4.99 payment -> review picture -> approve voxel -> map/save -> optional digital NFT mint, with legal property verification kept separate.');
