import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homeCss = read('app/home.module.css');
const property = read('app/property/page.js');
const propertyCss = read('app/property/property.module.css');
const success = read('app/property/success/page.js');
const photoUploadRoute = read('app/api/property-photo-upload/route.ts');
const voxelImageRoute = read('app/api/property-voxel-image/route.ts');
const voxel3dRoute = read('app/api/property-voxel-3d/route.ts');
const generationIds = read('lib/property-generation-ids.ts');
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

// Front door: one simple VoxelPop journey.
assert.match(home, /PHOTO → 3D → VOXEL → YOUR WORLD/, 'home must advertise the photo-first journey');
assert.match(home, /START PROPERTY → SIGN IN/, 'home must enter the account-gated maker');
for (const label of ['SIGN IN', 'PHOTO', '3D', 'VOXEL', 'WORLD', 'BUY + VAULT']) {
  assert.match(home, new RegExp(label.replace('+', '\\+')), `home flow must include ${label}`);
}
assert.match(home, /Wallet connection is optional/i, 'wallet must not block creation or checkout');
assert.match(home, /digital collectible only/i, 'home must distinguish digital checkout from buying real property');
assert.doesNotMatch(home, /BUY A PIECE|BUY THE WHOLE THING|blockchain deed/i, 'unverified real-property purchase language must stay out of the simple home');

for (const source of [homeCss, propertyCss, vault, world]) assert.match(source, /#fffaf0/i, 'simple surfaces keep the warm VoxelPop canvas');
assert.match(propertyCss, /#7138f5/i, 'VoxelPop purple must remain');
assert.match(propertyCss, /#c9ff54/i, 'VoxelPop lime must remain');
assert.match(propertyCss, /#f7ae2d|#ee950f/i, 'buy/voxel action uses warm orange');
assert.match(propertyCss, /grid-template-columns:repeat\(5,1fr\)/, 'property maker must expose five guided steps');

// Sign-in and photo come before address/location.
assert.match(property, /Sign in first\./, 'signed-out maker must expose the account gate');
assert.match(property, /Continue with Google/, 'account gate has one clear sign-in action');
assert.match(property, /const labels = \['PHOTO', '3D', 'VOXEL', 'WORLD', 'BUY'\]/, 'guided steps must use the new order');
assert.match(property, /Add one photo\./, 'first signed-in step must be photo');
assert.match(property, /accept="image\/\*,\.heic,\.heif"/, 'iPhone HEIC/HEIF selection remains supported');
assert.match(property, /normalizeIphonePhoto/, 'iPhone HEIC preparation remains automatic');
assert.match(property, /I took this photo or have permission to use it\./, 'source photo must require rights confirmation');
assert.match(property, /form\.append\('draftId', draftId\)/, 'photo-first upload must use an account-bound creation ID before map placement');
assert.match(property, /Use photo → build 3D/, 'one photo approval must start the automatic generation journey');
assert.doesNotMatch(property, /Use this street photo/, 'simple journey should not branch into a street-photo chooser');

// Automatic source 3D -> voxel style -> final 3D.
assert.match(property, /phase: 'source'/, 'original authorized photo must create the first 3D phase');
assert.match(property, /sourceStoragePath: reference\.storagePath/, 'source 3D must use the private account-owned upload path');
assert.match(property, /source3dTaskId: sourceDone\.taskId/, 'voxel styling must use the completed 3D preview');
assert.match(property, /voxelImageTaskId: voxelDone\.taskId/, 'final 3D must use the verified voxel-image task');
assert.match(property, /phase: 'voxel'/, 'final 3D must have a distinct voxel phase');
assert.match(property, /You do not need to press another generation button/, 'middle generation steps should be automatic');
assert.match(property, /MeshyModelViewer/, 'generated source/final models must be viewable interactively');
assert.doesNotMatch(property, /eth_requestAccounts|mintVoxelFlip/, 'wallet/mint execution must not block the guided maker');

assert.match(photoUploadRoute, /requireVoxelVaultUser/, 'photo upload requires a verified account');
assert.match(photoUploadRoute, /draftId/, 'photo upload must support creation-before-location');
assert.match(photoUploadRoute, /public:\s*false/, 'source photos stay private');
assert.match(photoUploadRoute, /createSignedUrl/, 'providers receive short-lived source-photo access');
assert.match(photoUploadRoute, /rightsConfirmed/, 'server enforces source-photo rights confirmation');

assert.match(generationIds, /property-create:/, 'photo-first phases use separate account-scoped creation IDs');
assert.match(generationIds, /propertyGenerationUserScope/, 'generation IDs must hash/scope by user');
assert.match(voxel3dRoute, /phase === 'source'/, '3D route must support the source-photo 3D phase');
assert.match(voxel3dRoute, /propertyDraftItemId\(auth\.user\.id, draftId, phase\)/, '3D phase records must be user- and draft-bound');
assert.match(voxel3dRoute, /propertyGenerationItemBelongsToUser/, '3D polling must reject other users jobs');
assert.match(voxel3dRoute, /verifiedVoxelImageUrl/, 'final voxel 3D must verify the account-bound voxel-image task');
assert.match(voxel3dRoute, /persistModelBinary/, 'completed GLBs must be persisted');
assert.match(voxelImageRoute, /generated3DReference/, 'voxel style pass must reference the completed source 3D');
assert.match(voxelImageRoute, /propertyDraftItemId\(userId, draftId, 'source'\)/, 'voxelizer must verify the exact source-3D creation record');
assert.match(voxelImageRoute, /licensed-derivative/, 'generated 3D preview must carry explicit derivative-rights classification');
assert.match(voxelImageRoute, /substitute a generic house/, 'voxel prompt must block generic-house drift');

// World placement happens after the final voxel and before payment.
assert.match(property, /Your voxel is ready\./, 'location prompt appears only after final voxel completion');
assert.match(property, /Preview on My World/, 'map preview is explicit before checkout');
assert.match(property, /PlanetStreamGlobe/, 'private purchase preview uses the Voxel world');
assert.match(property, /MY WORLD · PRIVATE PREVIEW/, 'pre-purchase map preview must stay private');
assert.match(property, /\/api\/property-collectible\/quote/, 'server quote follows World placement');
assert.match(property, /Buy & save/, 'buy action should promise the post-payment Vault handoff');

// Variable pricing is digital-build complexity only, never a real-estate appraisal.
for (const cents of ['999', '1499', '1999']) assert.match(collectibleCommerce, new RegExp(`priceCents: ${cents}`), 'three simple digital build price tiers must remain');
for (const tier of ['classic', 'detailed', 'landmark']) assert.match(collectibleCommerce, new RegExp(`tier: '${tier}'`), `pricing must include ${tier}`);
assert.match(collectibleCommerce, /footprintPoints/, 'pricing may use source-backed mapped footprint complexity');
assert.match(collectibleCommerce, /heightMeters/, 'pricing may use source-backed mapped height complexity');
assert.doesNotMatch(collectibleCommerce, /zestimate|marketValue|assessedValue|salePrice/i, 'digital price must never derive from real-property market valuation');
assert.match(quoteRoute, /digital build complexity, not the market value of the real property/i, 'quote API must explain the pricing boundary');

// One digital collectible per source-backed World identity, with server-authoritative Stripe verification.
assert.match(collectibleCommerce, /propertyCollectibleIdentity/, 'purchase uniqueness must use a server-derived World identity key');
assert.match(collectibleCommerce, /atlasId\.startsWith\('location:'\)/, 'fallback coordinates cannot become a once-only property identity');
assert.match(collectibleCommerce, /state === 'paid' \|\| state === 'minted'/, 'paid/minted reservations remain permanently locked');
assert.match(checkoutRoute, /propertyDraftItemId\(auth\.user\.id, draftId, 'voxel'\)/, 'checkout must verify the final model belongs to the buyer and creation');
assert.match(checkoutRoute, /quotePropertyCollectible\(building\)/, 'checkout recomputes price on the server');
assert.match(checkoutRoute, /kind: 'property_voxel_collectible'/, 'Stripe metadata must identify this product rail');
assert.match(checkoutRoute, /digital_only_no_real_property_rights/, 'Stripe checkout metadata preserves digital-only rights');
assert.match(checkoutRoute, /optional_after_purchase_and_property_verification/, 'wallet mint remains downstream and optional');
assert.match(checkoutRoute, /success_url: `\$\{appUrl\}\/property\/success/, 'payment returns through the Vault delivery page');
assert.match(webhook, /secureStripePropertyCollectiblePurchase/, 'signed Stripe webhook must independently secure the purchase');
assert.match(completeRoute, /secureStripePropertyCollectiblePurchase/, 'success path must re-verify Stripe payment and buyer');
assert.match(success, /savePropertyDraftToAccount/, 'successful checkout must sync the purchased item into the account Vault');
assert.match(success, /Create Another/, 'success loop must offer another creation');
assert.match(success, /View My World/, 'success loop must offer My World');
assert.match(success, /Mint to Wallet · optional/, 'mint remains optional after purchase');

// Vault and World remain privacy- and truth-safe.
assert.match(vault, /Your collection\./, 'Vault should read as the collection/inventory hub');
assert.match(vault, /Create Another/, 'Vault has a direct repeat loop');
assert.match(vault, /View My World/, 'Vault links directly to My World');
assert.match(vault, /MINT TO WALLET · OPTIONAL/, 'paid cards keep optional mint secondary');
assert.match(world, /MY WORLD \+ PUBLIC WORLD/, 'signed-in World combines private account items and public shared items');
assert.match(world, /\/api\/world-properties\/mine/, 'World must load the authenticated private feed');
assert.match(myWorldApi, /requireVoxelVaultUser/, 'My World feed is account authenticated');
assert.match(myWorldApi, /private: draft\?\.world\?\.public !== true/, 'private Vault items stay labeled private');
assert.match(worldApi, /draft\?\.world\?\.public !== true/, 'public feed must still exclude unshared drafts');
assert.match(worldApi, /toFixed\(3\)/, 'public coordinates remain privacy-rounded');
assert.match(drafts, /world:\s*\{\s*public:\s*false/, 'new saved drafts remain private by default');

// Canonical property minting remains the separate one-parcel legal identity rail.
assert.match(propertyClaimRules, /Address text is intentionally excluded/, 'canonical identity must never use display-address text');
assert.match(propertyClaimsApi, /oneCanonicalTwinPerParcel:\s*true/, 'canonical claim API preserves one mint per verified parcel');
assert.match(propertyClaimsApi, /addressUsedAsIdentityKey:\s*false/, 'canonical claim API rejects address strings as identity');
assert.match(canonicalRegistry, /PropertyAlreadyRegistered/, 'canonical registry rejects duplicate identity registration');
assert.match(propertyPassport, /PassportAlreadyMinted/, 'Property Passport rejects a second canonical mint');
assert.match(interestToken, /off-chain legal/, 'economic rights remain defined separately by legal agreements');

assert.match(dock, /if \(pathname === '\/property'\) return null;/, 'fixed app dock stays out of the guided maker');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search stays hidden on simple routes');

console.log('Guided VoxelPop property checks passed: sign in -> photo -> source 3D -> automatic voxel styling -> final 3D -> private My World preview -> server-priced once-only digital checkout -> Vault -> optional verified mint, with public World privacy and real-property rights kept separate.');
