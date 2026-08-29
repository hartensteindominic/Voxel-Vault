import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homeCss = read('app/home.module.css');
const property = read('app/property/page.js');
const propertyCss = read('app/property/property.module.css');
const success = read('app/property/success/page.js');
const photoUploadRoute = read('app/api/property-photo-upload/route.ts');
const localPreviewRoute = read('app/api/property-local-preview/route.ts');
const voxelImageRoute = read('app/api/property-voxel-image/route.ts');
const voxel3dRoute = read('app/api/property-voxel-3d/route.ts');
const generationIds = read('lib/property-generation-ids.ts');
const collectibleCommerce = read('lib/property-collectible-commerce.ts');
const payment = read('lib/property-generation-payment.ts');
const quoteRoute = read('app/api/property-collectible/quote/route.ts');
const checkoutRoute = read('app/api/property-collectible/checkout/route.ts');
const completeRoute = read('app/api/property-collectible/complete/route.ts');
const webhook = read('app/api/stripe/webhook/route.ts');
const vault = read('app/vault/property-drafts/page.js');
const world = read('app/world/page.js');
const globe = read('app/vault/earth/PlanetStreamGlobe.js');
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

// Front door: one simple VoxelPop journey with collection clearly separated from real-property ownership.
assert.match(home, /PHOTO → 3D → VOXEL → YOUR WORLD/, 'home must advertise the photo-first journey');
assert.match(home, /START → SIGN IN/, 'home must enter the account-gated maker');
for (const label of ['SIGN IN', 'PHOTO', '3D', 'VOXEL', 'WORLD', 'COLLECT + VAULT']) {
  assert.match(home, new RegExp(label.replace('+', '\\+')), `home flow must include ${label}`);
}
assert.match(home, /wallet is optional|A wallet is optional/i, 'wallet must not block creation or checkout');
assert.match(home, /does not buy the physical property/i, 'home must distinguish collecting the voxel from buying real property');
assert.doesNotMatch(home, /BUY A PIECE|BUY THE WHOLE THING|blockchain deed/i, 'unverified real-property purchase language must stay out of the simple home');

for (const source of [homeCss, propertyCss, vault, world]) assert.match(source, /#fffaf0/i, 'simple surfaces keep the warm VoxelPop canvas');
assert.match(propertyCss, /#7138f5/i, 'VoxelPop purple must remain');
assert.match(propertyCss, /#c9ff54/i, 'VoxelPop lime must remain');
assert.match(propertyCss, /#f7ae2d|#ee950f/i, 'collect/voxel action uses warm orange');
assert.match(propertyCss, /grid-template-columns:repeat\(5,1fr\)/, 'property maker must expose five guided steps');

// Sign-in and photo come first; default build is source-backed local 3D with no Meshy spend.
assert.match(property, /Sign in first\./, 'signed-out maker must expose the account gate');
assert.match(property, /Continue with Google/, 'account gate has one clear sign-in action');
assert.match(property, /const labels = \['PHOTO', 'BUILD', 'VOXEL', 'WORLD', 'COLLECT'\]/, 'guided labels must describe what the user is actually doing');
assert.match(property, /Choose one photo\./, 'first signed-in step must be photo');
assert.match(property, /accept="image\/\*,\.heic,\.heif"/, 'iPhone HEIC/HEIF selection remains supported');
assert.match(property, /normalizeIphonePhoto/, 'iPhone HEIC preparation remains automatic');
assert.match(property, /I took this photo or have permission to use it\./, 'source photo must require rights confirmation');
assert.match(property, /Preview with map · 0 Meshy credits/, 'the primary property path must work without Meshy credits');
assert.match(property, /provider: 'world-atlas-local-preview'/, 'credit-free mode must be explicit instead of masquerading as provider 3D');
assert.match(property, /GeoReferenceModel/, 'credit-free mode must render the existing source-backed local 3D map');
assert.match(property, /Find property \+ build 3D map/, 'map path should explain what it does before rendering');
assert.match(property, /Use this voxel preview/, 'local source-backed map should have a clear continuation action');
assert.match(property, /0 MESHY CREDITS/, 'the map preview must visibly state that it is credit-free');
assert.doesNotMatch(property, /Use this street photo/, 'simple journey should not branch into a street-photo chooser');

assert.match(localPreviewRoute, /requireVoxelVaultUser/, 'credit-free voxel identity must be account authenticated');
assert.match(localPreviewRoute, /propertyLocalPreviewTaskId\(auth\.user\.id, draftId\)/, 'local voxel identity must bind the account and draft');
assert.match(localPreviewRoute, /usesMeshyCredits: false/, 'credit-free endpoint must explicitly report zero Meshy usage');
assert.doesNotMatch(localPreviewRoute, /MESHY_API_KEY|api\.meshy\.ai|readMeshyCreditBalance/, 'credit-free endpoint must not call Meshy');
assert.match(generationIds, /propertyLocalPreviewTaskId/, 'generation identities must support local map voxels');
assert.match(generationIds, /propertyLocalPreviewTaskBelongsToUser/, 'collectible verification must be able to reject another account local task');
assert.match(generationIds, /atlas-map:\$\{propertyGenerationUserScope\(userId\)\}/, 'local map voxel IDs must be account scoped');

// Existing enhanced source-photo creation remains available and protected, but optional.
assert.match(property, /Enhanced AI 3D/, 'optional provider-backed enhancement must remain available');
assert.match(property, /form\.append\('draftId', draftId\)/, 'paid photo handoff must use an account-bound creation ID');
assert.match(photoUploadRoute, /requireVoxelVaultUser/, 'paid provider handoff requires a verified account');
assert.match(photoUploadRoute, /rightsConfirmed/, 'server enforces source-photo rights confirmation');
assert.match(photoUploadRoute, /data:\$\{photo\.type\};base64/, 'authorized paid source photo becomes an inline provider input after checkout');
assert.match(photoUploadRoute, /createHash\('sha256'\)/, 'source photo must receive a non-reversible fingerprint');
assert.match(photoUploadRoute, /source_image_url: sourceFingerprint/, 'account generation records retain the fingerprint rather than source photo bytes');
assert.match(photoUploadRoute, /meshy-property-direct-photo-to-3d/, 'direct paid photo source generation must keep an explicit provider marker');
assert.match(photoUploadRoute, /storagePath: `meshy-source:\$\{taskId\}`/, 'paid UI handoff uses an opaque account-bound direct-job reference');
assert.doesNotMatch(photoUploadRoute, /storage\.from\(|createBucket\(|createSignedUrl\(|PrivateStorageError|getSupabaseAdminCandidates/, 'provider handoff itself must not introduce a second source-photo storage dependency');

assert.match(payment, /let uploaded = await admin\.storage\.from\(BUCKET\)\.upload/, 'paid checkout staging must upload to the private bucket before any bucket-management call');
assert.doesNotMatch(payment, /storage\.listBuckets\(\)/, 'paid checkout staging must not depend on runtime bucket-list permission');
assert.doesNotMatch(payment, /Private VoxelPop checkout storage could not be prepared/i, 'the old private-checkout-storage error must stay removed');

// Optional enhanced source 3D -> voxel style -> final 3D remains intact.
assert.match(property, /phase: 'source'/, 'enhanced automatic pipeline must continue through the first 3D source phase');
assert.match(property, /sourceStoragePath: reference\.storagePath/, 'enhanced source continuation passes the opaque direct-job reference');
assert.match(voxel3dRoute, /sourceStoragePath\.startsWith\('meshy-source:'\)/, '3D route must recognize a pre-started direct-photo job');
assert.match(voxel3dRoute, /directJob\.item_id !== itemId/, 'pre-started source job must remain bound to the signed-in user and draft');
assert.match(voxel3dRoute, /directPhoto: true/, 'direct-photo continuation must be explicit in the server response');
assert.match(property, /source3dTaskId: sourceDone\.taskId/, 'voxel styling must use the completed enhanced 3D preview');
assert.match(property, /voxelImageTaskId: voxelDone\.taskId/, 'enhanced final 3D must use the verified voxel-image task');
assert.match(property, /phase: 'voxel'/, 'enhanced final 3D must have a distinct voxel phase');
assert.match(property, /First 3D → VoxelPop look → final 3D voxel/, 'enhanced middle steps should explain the automatic handoff');
assert.match(property, /MeshyModelViewer/, 'generated source/final models must remain viewable interactively');
assert.doesNotMatch(property, /eth_requestAccounts|mintVoxelFlip/, 'wallet/mint execution must not block the guided maker');

assert.match(generationIds, /property-create:/, 'paid photo-first phases use separate account-scoped creation IDs');
assert.match(generationIds, /propertyGenerationUserScope/, 'all generation IDs must hash/scope by user');
assert.match(voxel3dRoute, /phase === 'source'/, '3D route must support the source-photo 3D phase');
assert.match(voxel3dRoute, /propertyDraftItemId\(auth\.user\.id, draftId, phase\)/, '3D phase records must be user- and draft-bound');
assert.match(voxel3dRoute, /propertyGenerationItemBelongsToUser/, '3D polling must reject other users jobs');
assert.match(voxel3dRoute, /verifiedVoxelImageUrl/, 'final voxel 3D must verify the account-bound voxel-image task');
assert.match(voxel3dRoute, /persistModelBinary/, 'completed GLBs should still attempt durable persistence while retaining provider URL fallback');
assert.match(voxelImageRoute, /generated3DReference/, 'voxel style pass must reference the completed source 3D');
assert.match(voxelImageRoute, /propertyDraftItemId\(userId, draftId, 'source'\)/, 'voxelizer must verify the exact source-3D creation record');
assert.match(voxelImageRoute, /licensed-derivative/, 'generated 3D preview must carry explicit derivative-rights classification');
assert.match(voxelImageRoute, /substitute a generic house/, 'voxel prompt must block generic-house drift');

// Map and World: source-backed local inspection plus focused globe placement.
assert.match(property, /\/api\/world-atlas\/inspect/, 'property flow must resolve source-backed map evidence');
assert.match(property, /source-backed building footprint and neighborhood/, 'local build copy must explain the map evidence used');
assert.match(property, /Drag to orbit, pinch to zoom, and tap mapped buildings or streets/, 'local map must expose its interactive controls');
assert.match(property, /PlanetStreamGlobe/, 'World placement uses the Voxel globe');
assert.match(property, /MY WORLD · SOURCE-BACKED LOCATION/, 'local World preview must identify the source-backed placement');
assert.match(globe, /function focusSelected\(/, 'property globe must focus selected real-world coordinates');
assert.match(globe, /if \(simpleMode\) focusSelected\(next\)/, 'simple property globe must refocus when its selected item changes');
assert.match(globe, /PROPERTY WORLD · FOCUSED LOCATION/, 'focused property globe should tell the user what they are seeing');
assert.match(property, /\/api\/property-collectible\/quote/, 'server quote follows source-backed map placement');
assert.match(property, /async function collectAndSave\(\)/, 'digital checkout action should use Collect language');
assert.match(property, /Collect voxel ·/, 'final paid action must identify the thing being collected');
assert.match(property, /not the market value of the house or land/, 'price copy must never look like a real-property valuation');
assert.match(property, /does not create deed\/title, rent, occupancy, fractional investment, appreciation, or other rights/, 'real-property rights must remain on a separate legal rail');

// Variable pricing is digital-build complexity only, never a real-estate appraisal.
for (const cents of ['199', '299', '399']) assert.match(collectibleCommerce, new RegExp(`priceCents: ${cents}`), 'three simple low-cost digital build price tiers must remain');
for (const tier of ['classic', 'detailed', 'landmark']) assert.match(collectibleCommerce, new RegExp(`tier: '${tier}'`), `pricing must include ${tier}`);
assert.match(collectibleCommerce, /footprintPoints/, 'pricing may use source-backed mapped footprint complexity');
assert.match(collectibleCommerce, /heightMeters/, 'pricing may use source-backed mapped height complexity');
assert.doesNotMatch(collectibleCommerce, /zestimate|marketValue|assessedValue|salePrice/i, 'digital price must never derive from real-property market valuation');
assert.match(quoteRoute, /digital build complexity, not the market value of the physical property/i, 'quote API must explain the pricing boundary');

// One digital collectible per source-backed World identity, supporting either local-map or generated-GLB representations.
assert.match(collectibleCommerce, /propertyCollectibleIdentity/, 'collection uniqueness must use a server-derived World identity key');
assert.match(collectibleCommerce, /atlasId\.startsWith\('location:'\)/, 'fallback coordinates cannot become a once-only property identity');
assert.match(collectibleCommerce, /state === 'paid' \|\| state === 'minted'/, 'paid/minted reservations remain permanently locked');
assert.match(collectibleCommerce, /verifyOwnedFinalVoxelModel/, 'shared commerce helper must verify the exact voxel representation belongs to the buyer creation');
assert.match(collectibleCommerce, /propertyLocalPreviewTaskBelongsToUser/, 'local source-backed representation must be account/draft verified');
assert.match(collectibleCommerce, /provider: 'world-atlas-local'/, 'local collectible must be explicitly distinguished from Meshy');
assert.match(collectibleCommerce, /propertyDraftItemId\(input\.userId, draftId, 'voxel'\)/, 'generated model proof must still resolve to the account-scoped voxel phase');
assert.match(checkoutRoute, /verifyOwnedFinalVoxelModel/, 'checkout must verify either representation belongs to the buyer and creation');
assert.match(checkoutRoute, /inspectWorldAtlas/, 'checkout must re-verify the mapped building before selling a local representation');
assert.match(checkoutRoute, /quotePropertyCollectible\(building\)/, 'checkout recomputes price on the server');
assert.match(checkoutRoute, /representation: localPreview \? 'source_backed_local_map_voxel' : 'generated_3d_glb'/, 'Stripe metadata must preserve which representation was collected');
assert.match(checkoutRoute, /does not use Meshy or claim photorealistic reconstruction/, 'local checkout description must be truthful about fidelity');
assert.match(checkoutRoute, /digital_only_no_real_property_rights/, 'Stripe checkout metadata preserves digital-only rights');
assert.match(checkoutRoute, /optional_after_purchase_and_property_verification/, 'wallet mint remains downstream and optional');
assert.match(checkoutRoute, /success_url: `\$\{appUrl\}\/property\/success/, 'payment returns through the Vault delivery page');
assert.match(webhook, /secureStripePropertyCollectiblePurchase/, 'signed Stripe webhook must independently secure the payment');
assert.match(completeRoute, /secureStripePropertyCollectiblePurchase/, 'success path must re-verify Stripe payment and buyer');
assert.match(completeRoute, /verifyOwnedFinalVoxelModel/, 'success delivery must reopen only the purchased account-owned representation');
assert.match(completeRoute, /source-backed-local-map-voxel/, 'completion must preserve the local map representation kind');
assert.match(completeRoute, /reference/, 'local completion must return source-backed map evidence for rendering');
assert.match(success, /GeoReferenceModel/, 'success page must render a collected local map voxel without requiring a GLB');
assert.match(success, /savePropertyDraftToAccount/, 'successful checkout must sync the collected item into the account Vault');
assert.match(success, /Create Another/, 'success loop must offer another creation');
assert.match(success, /View My World/, 'success loop must offer My World');
assert.match(success, /Verify &amp; Mint · optional/, 'mint remains optional and verified after collection');
assert.match(success, /You collected a digital VoxelPop item/, 'success copy must say exactly what the user paid for');

// Vault and World remain privacy- and truth-safe.
assert.match(vault, /Your collection\./, 'Vault should read as the collection/inventory hub');
assert.match(vault, /Create Another/, 'Vault has a direct repeat loop');
assert.match(vault, /View My World/, 'Vault links directly to My World');
assert.match(vault, /VERIFY \+ MINT · OPTIONAL/, 'paid cards keep optional verified mint secondary');
assert.match(world, /MY WORLD \+ PUBLIC WORLD/, 'signed-in World combines private account items and public shared items');
assert.match(world, /Your voxels\./, 'signed-in World should describe the digital items as voxels, not physical properties');
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

console.log('Guided VoxelPop property checks passed: sign in -> authorized photo -> zero-credit source-backed local 3D map -> focused My World preview -> server-priced digital collection -> Vault -> optional verified mint; optional paid Meshy enhancement remains separate and fail-closed.');
