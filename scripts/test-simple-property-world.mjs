import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homeCss = read('app/home.module.css');
const property = read('app/property/page.js');
const propertyCss = read('app/property/property.module.css');
const localViewer = read('app/property/LocalVoxelModelViewer.js');
const propertyMap = read('app/property/PropertyWorldMap.js');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const generationCheckout = read('app/api/property-generation/checkout/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const collectibleCommerce = read('lib/property-collectible-commerce.ts');
const quoteRoute = read('app/api/property-collectible/quote/route.ts');
const checkoutRoute = read('app/api/property-collectible/checkout/route.ts');
const completeRoute = read('app/api/property-collectible/complete/route.ts');
const webhook = read('app/api/stripe/webhook/route.ts');
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

assert.match(home, /One photo → \$4\.99 creation → 3D → map\./, 'home describes the upload-first paid local creation plus map journey');
assert.match(home, /＋ UPLOAD A PROPERTY PHOTO/, 'home enters the guided maker with one obvious photo action');
assert.match(home, /Creation is \$4\.99/, 'home discloses the creation price');
assert.match(home, /source photo stays on-device/i, 'home explains private device-local source handling');
assert.match(home, /No wallet is required to create/i, 'wallet must not block creation');
assert.match(home, /does not buy the physical property/i, 'home distinguishes the voxel from physical real estate');
assert.match(home, /No Meshy credits are used/i, 'home makes the no-Meshy provider dependency explicit without implying free creation');
assert.doesNotMatch(home, /BUY A PIECE|BUY THE WHOLE THING|blockchain deed/i, 'unverified property-purchase language stays out of the simple home');

for (const source of [homeCss, propertyCss, vault, world]) assert.match(source, /#fffaf0/i, 'simple surfaces keep the warm VoxelPop canvas');
assert.match(propertyCss, /#7138f5/i, 'VoxelPop purple remains');
assert.match(propertyCss, /#c9ff54/i, 'VoxelPop lime remains');
assert.match(propertyCss, /#f7ae2d|#ee950f/i, 'collect action keeps warm orange');
assert.match(propertyCss, /grid-template-columns:repeat\(5,1fr\)/, 'maker keeps five guided steps');

assert.match(property, /Sign in first\./, 'maker exposes the account gate');
assert.match(property, /Continue with Google/, 'account gate has one clear sign-in action');
assert.match(property, /const labels = \['PHOTO', 'BUILD', 'VOXEL', 'WORLD', 'COLLECT'\]/, 'guided labels remain simple');
assert.match(property, /Choose one photo\./, 'first signed-in step stays photo-first');
assert.match(property, /accept="image\/\*,\.heic,\.heif"/, 'iPhone HEIC/HEIF selection remains supported');
assert.match(property, /normalizeIphonePhoto/, 'iPhone photo preparation remains automatic');
assert.match(property, /I took this photo or have permission to use it\./, 'source photo still requires rights confirmation');
assert.match(property, /Pay \$\{CREATION_PRICE_LABEL\} · Use photo → start build/, 'the same paid creation CTA remains explicit');

assert.match(property, /indexedDB\.open\(DEVICE_DB/, 'source photo is kept privately on-device across checkout');
assert.match(property, /createVoxelPoster/, 'VoxelPop image is built locally');
assert.match(property, /LocalVoxelModelViewer/, 'local interactive 3D replaces provider generation in the guided maker');
assert.match(localViewer, /InstancedMesh/, 'local viewer builds real Three.js voxel geometry');
assert.match(localViewer, /3D IMAGE → INTERACTIVE 3D/, 'image must remain visible before interactive 3D');
assert.match(localVoxel, /propertyDraftItemId\(auth\.user\.id, draftId, 'voxel'\)/, 'finished local voxel remains account/draft bound');
assert.match(localVoxel, /model\/gltf\+json/, 'compact local recipe can reopen as glTF');
assert.doesNotMatch(generationCheckout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto|createBucket|storage\.from/i, 'generation checkout cannot call Meshy capacity checks or private Storage');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|image-to-3d|storage\.from/i, 'paid resume cannot call Meshy or private Storage');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided maker must not call metered Meshy routes');

assert.match(property, /Add the property address\./, 'address step follows local voxel creation');
assert.match(property, /Verify address \+ preview/, 'address action says verification and preview');
assert.match(property, /setAtlasBuildings/, 'address lookup retains nearby source-backed buildings');
assert.match(property, /PropertyWorldMap/, 'private collection preview uses the improved focused map');
assert.match(propertyMap, /ExtrudeGeometry/, 'focused map extrudes source-backed footprints');
assert.match(propertyMap, /PROPERTY MAP ·/, 'focused map clearly identifies itself');
assert.match(propertyMap, /pointerdown/, 'focused map supports touch drag interaction');
assert.match(propertyMap, /Zoom property map in/, 'focused map exposes mobile zoom controls');
assert.match(property, /MY WORLD · IMPROVED PROPERTY MAP/, 'map improvement is visible in the guided flow');
assert.match(property, /\/api\/property-collectible\/quote/, 'server quote still follows World placement');
assert.match(property, /async function collectAndSave\(\)/, 'digital collection action remains');
assert.match(property, /Collect voxel ·/, 'final paid action identifies the digital voxel');
assert.match(property, /not the market value of the house or land/, 'price copy never looks like a real-property valuation');
assert.match(property, /Real-property investing can only appear through a separately verified offering/, 'real investment remains on a separate verified rail');

for (const cents of ['199', '299', '399']) assert.match(collectibleCommerce, new RegExp(`priceCents: ${cents}`), 'three low-cost digital collection tiers remain');
for (const tier of ['classic', 'detailed', 'landmark']) assert.match(collectibleCommerce, new RegExp(`tier: '${tier}'`), `pricing keeps ${tier}`);
assert.match(collectibleCommerce, /footprintPoints/, 'pricing may use mapped footprint complexity');
assert.match(collectibleCommerce, /heightMeters/, 'pricing may use mapped height complexity');
assert.doesNotMatch(collectibleCommerce, /zestimate|marketValue|assessedValue|salePrice/i, 'digital price never derives from property market valuation');
assert.match(quoteRoute, /digital build complexity, not the market value of the physical property/i, 'quote API explains the price boundary');

assert.match(collectibleCommerce, /propertyCollectibleIdentity/, 'collection uniqueness uses server-derived World identity');
assert.match(collectibleCommerce, /verifyOwnedFinalVoxelModel/, 'commerce verifies the account-owned final model');
assert.match(checkoutRoute, /verifyOwnedFinalVoxelModel/, 'checkout re-verifies the final model');
assert.match(checkoutRoute, /quotePropertyCollectible\(building\)/, 'checkout recomputes price server-side');
assert.match(checkoutRoute, /kind: 'property_voxel_collectible'/, 'Stripe metadata identifies the digital collectible rail');
assert.match(checkoutRoute, /does not buy the physical property/, 'Stripe copy preserves the real-property boundary');
assert.match(webhook, /secureStripePropertyCollectiblePurchase/, 'Stripe webhook independently secures payment');
assert.match(completeRoute, /secureStripePropertyCollectiblePurchase/, 'success path re-verifies payment and buyer');
assert.match(completeRoute, /verifyOwnedFinalVoxelModel/, 'success delivery reopens only the purchased account-owned model');

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

assert.match(dock, /SIMPLE_PROPERTY_DOCK/, 'guided maker uses the same condensed consumer navigation instead of a separate mini-app dock');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search stays hidden on simple routes');

console.log('Guided VoxelPop property checks passed: upload-first -> sign in -> authorized device-local photo -> explicit $4.99 unlock -> VoxelPop image -> local interactive 3D -> source-backed property map -> optional digital collection/Vault, without Meshy credits or checkout Storage.');
