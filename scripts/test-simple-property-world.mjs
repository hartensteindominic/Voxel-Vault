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

assert.match(propertyRoute, /PropertyJourneySimple/, '/property must use the condensed journey');
assert.match(home, /ONE PHOTO → YOUR VOXEL WORLD|Upload a picture\./, 'home describes the one-photo guided journey');
assert.match(home, /No wallet required to create/i, 'wallet must not block creation');
assert.match(home, /does not buy the physical property/i, 'home distinguishes the voxel from physical real estate');
assert.match(home, /No Meshy credits/i, 'home makes the no-Meshy dependency explicit');

for (const source of [homeCss, propertyCss, vault, world]) assert.match(source, /#fffaf0/i, 'simple surfaces keep the warm VoxelPop canvas');
assert.match(propertyCss, /#7138f5/i, 'VoxelPop purple remains');
assert.match(propertyCss, /#c9ff54/i, 'VoxelPop lime remains');
assert.match(propertyCss, /grid-template-columns:repeat\(5,1fr\)/, 'maker keeps five guided steps');

assert.match(property, /Sign in first\./, 'maker exposes the account gate');
assert.match(property, /Continue with Google/, 'account gate has one clear sign-in action');
assert.match(property, /const labels = \['PHOTO', 'PAY', '3D', 'MAP', 'MY WORLD'\]/, 'labels explain the actual user journey');
assert.match(property, /Choose the building photo\./, 'first signed-in step is photo-first');
assert.match(property, /accept="image\/\*,\.heic,\.heif"/, 'iPhone HEIC/HEIF selection remains supported');
assert.match(property, /normalizeIphonePhoto/, 'iPhone photo preparation remains automatic');
assert.match(property, /I took this photo or have permission to use it\./, 'source photo requires rights confirmation');
assert.match(property, /Pay \$\{CREATION_PRICE_LABEL\} & Create 3D/, 'the paid CTA says what happens next');
assert.match(property, /There is no second collection payment required just to continue/, 'one payment must unlock the normal creation journey');

assert.match(property, /indexedDB\.open\(DEVICE_DB/, 'source photo is kept privately on-device across checkout');
assert.match(property, /createVoxelPoster/, 'VoxelPop image is built locally');
assert.match(property, /LocalVoxelModelViewer/, 'local interactive 3D replaces provider generation');
assert.match(localViewer, /const GRID = 24/, 'building 3D uses the higher-detail local grid');
assert.match(localViewer, /rawMask/, 'building/background separation is part of the local viewer');
assert.match(localViewer, /if \(!mask\[index\]\) return 0/, 'background becomes empty space');
assert.match(localViewer, /InstancedMesh/, 'local viewer builds real Three.js voxel geometry');
assert.doesNotMatch(localViewer, /backingGeometry/, 'the old picture-wall slab is gone');
assert.match(localVoxel, /propertyDraftItemId\(auth\.user\.id, draftId, 'voxel'\)/, 'finished local voxel remains account/draft bound');
assert.match(localVoxel, /model\/gltf\+json/, 'compact local recipe can reopen as glTF');
assert.match(localVoxel, /if \(recipe\.depths\[index\] <= 0\) continue/, 'reopened glTF preserves the silhouette');
assert.doesNotMatch(generationCheckout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto|createBucket|storage\.from/i, 'generation checkout cannot call Meshy or private Storage');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|image-to-3d|storage\.from/i, 'paid resume cannot call Meshy or private Storage');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided maker must not call metered Meshy routes');

assert.match(property, /Enter the property address to match it to the real mapped building footprint/, 'address follows successful local 3D');
assert.match(property, /Match 3D to this building/, 'address action is understandable');
assert.match(property, /setAtlasBuildings/, 'address lookup retains nearby source-backed buildings');
assert.match(property, /PropertyWorldMap/, 'guided map uses the focused property map');
assert.match(propertyMap, /ExtrudeGeometry/, 'focused map extrudes source-backed footprints');
assert.match(propertyMap, /PROPERTY MAP ·/, 'focused map identifies itself');
assert.match(propertyMap, /pointerdown/, 'focused map supports touch drag interaction');
assert.match(propertyMap, /Zoom property map in/, 'focused map exposes mobile zoom controls');
assert.match(property, /Save to My World/, 'map has an obvious continuation action');
assert.match(property, /View My World/, 'completed creation has an obvious destination');
assert.match(property, /Open My Vault/, 'completed creation can open the saved Vault item');
assert.match(property, /savePropertyDraft\(draft\)/, 'creation saves directly to the existing property draft library');
assert.match(property, /savePropertyDraftToAccount/, 'creation attempts account sync without blocking local success');
assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|Collect voxel ·|collectAndSave/, 'normal creation no longer enters a second paid collectible funnel');

assert.match(vault, /Your collection\./, 'Vault remains the collection hub');
assert.match(world, /MY WORLD \+ PUBLIC WORLD/, 'World combines private account items and public shared items');
assert.match(myWorldApi, /requireVoxelVaultUser/, 'My World feed stays authenticated');
assert.match(worldApi, /toFixed\(3\)/, 'public coordinates remain privacy-rounded');
assert.match(drafts, /world:\s*\{\s*public:\s*false/, 'new saved drafts remain private by default');

assert.match(propertyClaimRules, /Address text is intentionally excluded/, 'canonical identity never uses display address text');
assert.match(propertyClaimsApi, /oneCanonicalTwinPerParcel:\s*true/, 'canonical claim API preserves one mint per verified parcel');
assert.match(canonicalRegistry, /PropertyAlreadyRegistered/, 'canonical registry rejects duplicate identity registration');
assert.match(propertyPassport, /PassportAlreadyMinted/, 'Property Passport rejects a second canonical mint');
assert.match(interestToken, /off-chain legal/, 'economic rights remain defined separately by legal agreements');

assert.match(dock, /SIMPLE_PROPERTY_DOCK/, 'guided maker uses the condensed consumer navigation');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search stays hidden on simple routes');

console.log('Guided VoxelPop property checks passed: sign in -> photo -> one $4.99 payment -> recognizable local 3D -> source-backed map -> save/view My World, without Meshy credits, private checkout Storage, or a second paywall.');
