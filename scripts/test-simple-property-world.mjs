import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homeCss = read('app/home.module.css');
const propertyRoute = read('app/property/page.js');
const property = read('app/property/PropertyJourneyPhotoVoxelMint.js');
const depthPreview = read('app/property/PhotoDepthPreview.js');
const propertyCss = read('app/property/property.module.css');
const localViewer = read('app/property/LocalVoxelModelViewer.js');
const propertyMap = read('app/property/PropertyWorldMap.js');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const generationCheckout = read('app/api/property-generation/checkout/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const mintPrepare = read('app/api/property-local-voxel/mint/prepare/route.ts');
const mintMetadata = read('app/api/property-local-voxel/mint/metadata/route.ts');
const mintConfirm = read('app/api/property-local-voxel/mint/confirm/route.ts');
const collectibleCommerce = read('lib/property-collectible-commerce.ts');
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

assert.match(propertyRoute, /PropertyJourneyPhotoVoxelMint/, '/property must use the explicit picture -> voxel -> mint journey');
assert.match(home, /ONE PHOTO → YOUR VOXEL WORLD|Upload a picture\./, 'home remains photo-first');
assert.match(home, /One VoxelPop creation costs \$4\.99/, 'home clearly discloses the creation price');
assert.match(home, /source photo stays on your device/i, 'home explains the device-local source photo boundary');
assert.match(home, /without Meshy credits/i, 'home makes the no-Meshy dependency explicit');
assert.match(home, /Voxel Vault is not a bank/i, 'home must not imply bank status');
assert.match(home, /VoxelPop item is not a deed/i, 'home must separate digital items from real-property title');
assert.doesNotMatch(home, /BUY A PIECE|BUY THE WHOLE THING|blockchain deed|guaranteed returns|guaranteed yield/i, 'unverified property-purchase or return language stays out of the simple home');

for (const source of [homeCss, propertyCss, vault, world]) assert.match(source, /#fffaf0/i, 'simple surfaces keep the warm VoxelPop canvas');
assert.match(propertyCss, /#7138f5/i, 'VoxelPop purple remains');
assert.match(propertyCss, /#c9ff54/i, 'VoxelPop lime remains');
assert.match(propertyCss, /grid-template-columns:repeat\(5,1fr\)/, 'maker keeps five guided steps');

assert.match(property, /Sign in first\./, 'maker exposes the account gate');
assert.match(property, /Continue with Google/, 'account gate has one clear sign-in action');
assert.match(property, /const labels = \['PHOTO', 'PAY', '3D PICTURE', '3D VOXEL', 'MINT'\]/, 'labels match the requested customer order');
assert.match(property, /Start with your house\./, 'first signed-in step is clearly photo-first');
assert.match(property, /accept="image\/\*,\.heic,\.heif"/, 'iPhone HEIC/HEIF selection remains supported');
assert.match(property, /normalizeIphonePhoto/, 'iPhone photo preparation remains automatic');
assert.match(property, /I took this photo or have permission to use it\./, 'source photo requires rights confirmation');
assert.match(property, /Pay \$\{CREATION_PRICE_LABEL\} & Create 3D Picture/, 'payment unlocks the picture stage');
assert.match(property, /See your house in 3D first\./, 'the actual house picture is reviewed before voxelization');
assert.match(property, /PhotoDepthPreview/, 'the 3D picture has a dedicated renderer');
assert.match(depthPreview, /new THREE\.Texture\(image\)/, 'the actual house photo stays visible on the 3D picture');
assert.match(depthPreview, /pointerdown/, '3D picture supports direct touch/drag interaction');
assert.match(property, /Create 3D Voxel/, 'voxelization requires a separate explicit action');
assert.match(property, /This looks right → Mint/, 'finished voxel requires review before minting');
assert.match(property, /Mint this 3D voxel on Base/, 'mint is a real, explicit final action');
assert.match(property, /3D picture ≠ 3D voxel ≠ NFT ≠ deed/, 'UI states the meaning of each stage');

assert.match(property, /indexedDB\.open\(DEVICE_DB/, 'source photo is kept privately on-device across checkout');
assert.match(property, /createVoxelPoster/, 'voxel styling is built locally after approval');
assert.match(property, /LocalVoxelModelViewer/, 'local interactive voxel replaces provider generation');
assert.match(localViewer, /rawMask/, 'building/background separation is part of the local viewer');
assert.match(localViewer, /if \(!mask\[index\]\) return 0/, 'background becomes empty space');
assert.match(localViewer, /InstancedMesh/, 'local viewer builds real Three.js voxel geometry');
assert.doesNotMatch(localViewer, /backingGeometry/, 'the old picture-wall slab is gone');
assert.match(localVoxel, /propertyDraftItemId\(auth\.user\.id, draftId, 'voxel'\)/, 'finished local voxel remains account/draft bound');
assert.match(localVoxel, /model\/gltf\+json/, 'compact local recipe can reopen as glTF');
assert.doesNotMatch(generationCheckout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto|createBucket|storage\.from/i, 'generation checkout cannot call Meshy or private Storage');
assert.doesNotMatch(paidVerify, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|api\.meshy|image-to-3d|storage\.from/i, 'paid resume cannot call Meshy or private Storage');
assert.doesNotMatch(property, /\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'guided maker must not call metered Meshy routes');

assert.match(mintPrepare, /requireVoxelVaultUser/, 'property mint remains account-gated');
assert.match(mintPrepare, /paidPropertyGenerationReceipt/, 'property mint re-verifies the $4.99 purchase');
assert.match(mintPrepare, /propertyDraftItemId\(auth\.user\.id, draftId, 'voxel'\)/, 'property mint verifies exact saved voxel ownership');
assert.match(mintPrepare, /findExistingPropertyVoxelMint/, 'one-time voucher is checked before mint');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy/i, 'property mint does not depend on Meshy');
assert.match(mintMetadata, /source_photo_included: false/, 'mint metadata excludes the private source photo');
assert.match(mintMetadata, /real_property_rights: false/, 'mint metadata cannot imply deed rights');
assert.match(mintConfirm, /verifyPropertyVoxelMintOnBase/, 'mint success is verified on Base');

assert.match(property, /setAtlasBuildings/, 'address lookup retains nearby source-backed buildings');
assert.match(property, /PropertyWorldMap/, 'optional My World placement uses the focused property map');
assert.match(propertyMap, /ExtrudeGeometry/, 'focused map extrudes source-backed footprints');
assert.match(propertyMap, /pointerdown/, 'focused map supports touch drag interaction');
assert.match(property, /Save to My World/, 'map has an obvious continuation action');
assert.match(property, /View My World/, 'completed creation has an obvious destination');
assert.match(property, /Open My Vault/, 'completed creation can open the saved Vault item');
assert.match(property, /savePropertyDraft\(draft\)/, 'creation saves directly to the property draft library');
assert.match(property, /savePropertyDraftToAccount/, 'creation attempts account sync without blocking local success');
assert.doesNotMatch(property, /\/api\/property-collectible\/quote|\/api\/property-collectible\/checkout|collectAndSave/, 'normal creation never enters a second paid collectible funnel');

for (const cents of ['199', '299', '399']) assert.match(collectibleCommerce, new RegExp(`priceCents: ${cents}`), 'separate legacy collectible tiers remain isolated from this flow');
assert.match(vault, /Your collection\./, 'Vault remains the collection hub');
assert.match(world, /MY WORLD \+ PUBLIC WORLD/, 'World combines private account items and public shared items');
assert.match(myWorldApi, /requireVoxelVaultUser/, 'My World feed stays authenticated');
assert.match(worldApi, /toFixed\(3\)/, 'public coordinates remain privacy-rounded');
assert.match(drafts, /world:\s*\{\s*public:\s*false/, 'new saved drafts remain private by default');

assert.match(propertyClaimRules, /Address text is intentionally excluded/, 'canonical identity never uses display address text');
assert.match(propertyClaimsApi, /oneCanonicalTwinPerParcel:\s*true/, 'canonical claim API preserves one canonical property identity');
assert.match(canonicalRegistry, /PropertyAlreadyRegistered/, 'canonical registry rejects duplicate identity registration');
assert.match(propertyPassport, /PassportAlreadyMinted/, 'Property Passport rejects a second canonical mint');
assert.match(interestToken, /off-chain legal/, 'economic rights remain defined separately by legal agreements');
assert.match(dock, /SIMPLE_PROPERTY_DOCK/, 'guided maker uses the condensed consumer navigation');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search stays hidden on simple routes');

console.log('Guided VoxelPop property checks passed: sign in -> photo -> $4.99 -> actual 3D picture -> explicit 3D voxel -> review -> optional verified Base mint -> optional source-backed My World placement.');
