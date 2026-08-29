import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homeCss = read('app/home.module.css');
const property = read('app/property/page.js');
const propertyCss = read('app/property/property.module.css');
const success = read('app/property/success/page.js');
const photoUploadRoute = read('app/api/property-photo-upload/route.ts');
const generationCheckout = read('app/api/property-generation/checkout/route.ts');
const generationPayment = read('lib/property-generation-payment.ts');
const clientPhoto = read('lib/property-checkout-photo-client.js');
const voxelImageRoute = read('app/api/property-voxel-image/route.ts');
const voxel3dRoute = read('app/api/property-voxel-3d/route.ts');
const generationIds = read('lib/property-generation-ids.ts');
const collectibleCommerce = read('lib/property-collectible-commerce.ts');
const quoteRoute = read('app/api/property-collectible/quote/route.ts');
const checkoutRoute = read('app/api/property-collectible/checkout/route.ts');
const completeRoute = read('app/api/property-collectible/complete/route.ts');
const globe = read('app/vault/earth/PlanetStreamGlobe.js');
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

// Front door and VoxelPop visual language remain intact.
assert.match(home, /PHOTO → 3D → VOXEL → YOUR WORLD/, 'home may keep advertising the enhanced photo-to-3D journey');
assert.match(home, /START → SIGN IN/, 'home must enter the account-gated maker');
assert.match(home, /wallet is optional|A wallet is optional/i, 'wallet must not block creation or checkout');
assert.match(home, /does not buy the physical property/i, 'home must distinguish the digital item from physical property');
assert.doesNotMatch(home, /BUY A PIECE|BUY THE WHOLE THING|blockchain deed/i, 'unverified real-property purchase language stays out of the simple home');
for (const source of [homeCss, propertyCss, vault, world]) assert.match(source, /#fffaf0/i, 'simple surfaces keep the warm VoxelPop canvas');
assert.match(propertyCss, /#7138f5/i, 'VoxelPop purple remains');
assert.match(propertyCss, /#c9ff54/i, 'VoxelPop lime remains');
assert.match(propertyCss, /#f7ae2d|#ee950f/i, 'collect/voxel action keeps warm orange');
assert.match(propertyCss, /grid-template-columns:repeat\(5,1fr\)/, 'property maker still exposes five guided steps');

// Sign-in and photo come first; the same page now offers a no-credit map rail
// and the existing paid enhanced AI rail without conflating the two.
assert.match(property, /Sign in first\./, 'signed-out maker exposes the account gate');
assert.match(property, /Continue with Google/, 'account gate has one clear sign-in action');
assert.match(property, /const labels = \['PHOTO', 'BUILD', 'VOXEL', 'WORLD', 'COLLECT'\]/, 'guided labels remain familiar');
assert.match(property, /Choose one photo\./, 'first signed-in step remains photo');
assert.match(property, /accept="image\/\*,\.heic,\.heif"/, 'iPhone HEIC/HEIF selection remains supported');
assert.match(property, /normalizeIphonePhoto/, 'iPhone HEIC preparation remains automatic');
assert.match(property, /I took this photo or have permission to use it\./, 'source photo still requires rights confirmation');
assert.match(property, /Continue with Map Voxel · no AI credits/, 'primary path must allow a no-Meshy map representation');
assert.match(property, /Optional enhanced AI 3D · \$4\.99/, 'existing paid enhanced 3D remains optional');
assert.match(property, /function continueWithMapVoxel\(\)/, 'no-credit path has an explicit implementation boundary');
assert.match(property, /setPipelinePhase\('map-voxel'\)/, 'no-credit path must not masquerade as a completed provider job');
assert.match(property, /provider: 'voxelpop-source-backed-map'/, 'no-credit path is labeled as a map representation');
assert.match(property, /Boolean\(final3d\?\.modelUrl\) \|\| mapVoxelMode/, 'map representation may proceed without a generated GLB');
assert.doesNotMatch(property, /Use this street photo/, 'simple journey does not branch into the old street-photo chooser');

// Optional enhanced checkout no longer stages original photos in Supabase.
assert.match(generationCheckout, /describePaidPropertyPhoto/, 'enhanced checkout hashes the source in request memory');
assert.match(generationCheckout, /source_storage: 'browser_only_until_payment'/, 'Stripe metadata records browser-only source handling');
assert.doesNotMatch(generationCheckout, /stagePaidPropertyPhoto|createBucket|source_storage_path/, 'checkout must not create runtime private photo storage');
assert.match(generationPayment, /createHash\('sha256'\)/, 'paid source checkout is bound to a SHA-256 fingerprint');
assert.match(generationPayment, /verifyPaidPropertyPhoto/, 'paid source bytes are re-verified after Stripe');
assert.doesNotMatch(generationPayment, /storage\.from\(|createBucket|Private VoxelPop checkout storage could not be prepared/, 'the exact failing checkout-storage dependency must stay removed');
assert.match(clientPhoto, /indexedDB\.open/, 'optional enhanced source is held locally across Stripe');
assert.match(property, /savePropertyCheckoutPhoto\(draftId, pendingPhoto\)/, 'page persists enhanced source locally before redirect');
assert.match(property, /readPropertyCheckoutPhoto\(returnDraftId\)/, 'page restores enhanced source after payment');
assert.match(property, /if \(checkoutPhoto\) form\.append\('photo', checkoutPhoto\)/, 'photo reaches the provider gate only after payment verification');

// Enhanced source-photo creation still goes directly to the provider and does
// not depend on checkout Storage.
assert.match(photoUploadRoute, /requireVoxelVaultUser/, 'enhanced photo handoff requires a verified account');
assert.match(photoUploadRoute, /paidPropertyGenerationReceipt/, 'enhanced source generation requires a verified payment receipt');
assert.match(photoUploadRoute, /verifyPaidPropertyPhoto\(receipt, photo\)/, 'restored source must match the paid fingerprint');
assert.match(photoUploadRoute, /data:\$\{paidInput\.contentType\};base64/, 'verified source becomes an inline provider input');
assert.match(photoUploadRoute, /source_image_url: sourceFingerprint/, 'generation records retain a fingerprint rather than source photo bytes');
assert.match(photoUploadRoute, /meshy-property-direct-photo-to-3d/, 'enhanced source generation retains an explicit provider marker');
assert.match(photoUploadRoute, /storagePath: `meshy-source:\$\{taskId\}`/, 'enhanced UI handoff uses an account-bound direct-job reference');
assert.doesNotMatch(photoUploadRoute, /storage\.from\(|createBucket\(|createSignedUrl\(/, 'enhanced source handoff does not require Supabase photo storage administration');

// Existing enhanced source 3D -> voxel style -> final 3D pipeline stays intact.
assert.match(property, /phase: 'source'/, 'enhanced pipeline continues through the first 3D phase');
assert.match(property, /sourceStoragePath: reference\.storagePath/, 'enhanced source continuation passes the account-bound job reference');
assert.match(voxel3dRoute, /sourceStoragePath\.startsWith\('meshy-source:'\)/, '3D route recognizes the pre-started direct-photo job');
assert.match(voxel3dRoute, /directJob\.item_id !== itemId/, 'enhanced source job remains bound to the user and draft');
assert.match(property, /source3dTaskId: sourceDone\.taskId/, 'enhanced voxel styling uses the completed source 3D preview');
assert.match(property, /voxelImageTaskId: voxelDone\.taskId/, 'enhanced final 3D uses the verified voxel image');
assert.match(property, /No extra button\. First 3D → VoxelPop look → final 3D voxel\./, 'enhanced middle stages remain automatic');
assert.match(property, /MeshyModelViewer/, 'generated source/final models remain interactive');
assert.doesNotMatch(property, /eth_requestAccounts|mintVoxelFlip/, 'wallet/mint execution does not block the maker');

assert.match(generationIds, /property-create:/, 'photo-first phases use separate account-scoped creation IDs');
assert.match(generationIds, /propertyGenerationUserScope/, 'generation IDs remain scoped by user');
assert.match(voxel3dRoute, /propertyDraftItemId\(auth\.user\.id, draftId, phase\)/, 'enhanced phase records remain user- and draft-bound');
assert.match(voxel3dRoute, /propertyGenerationItemBelongsToUser/, '3D polling rejects other users jobs');
assert.match(voxel3dRoute, /verifiedVoxelImageUrl/, 'enhanced final 3D verifies the account-bound voxel-image task');
assert.match(voxel3dRoute, /persistModelBinary/, 'generated GLBs still attempt durable persistence');
assert.match(voxelImageRoute, /generated3DReference/, 'enhanced style pass references completed source 3D');
assert.match(voxelImageRoute, /licensed-derivative/, 'generated 3D preview carries derivative-rights classification');
assert.match(voxelImageRoute, /substitute a generic house/, 'voxel prompt blocks generic-house drift');

// Map placement works for either representation and is visibly improved.
assert.match(property, /Add the property address\./, 'address step follows representation selection');
assert.match(property, /Verify address \+ preview/, 'address action says verification and preview');
assert.match(property, /PlanetStreamGlobe/, 'collection preview uses the 3D Voxel world');
assert.match(property, /MY WORLD · PRIVATE PREVIEW/, 'pre-collection map preview remains private');
assert.match(property, /\/api\/property-collectible\/quote/, 'server quote follows World placement');
assert.match(property, /representationKind: mapVoxelMode \? 'map-voxel' : 'generated-3d'/, 'checkout declares the chosen representation');
assert.match(globe, /function focusSelected/, 'map can automatically focus the selected property');
assert.match(globe, />FOCUS</, 'map exposes an explicit selected-property focus control');
assert.match(globe, /listingHeightMeters/, 'map visual can use source-backed height evidence');
assert.match(globe, /coordinatePointCount/, 'map visual can use source-backed footprint complexity');
assert.match(globe, /TorusGeometry/, 'selected property gets a visible halo');
assert.match(globe, /3D PROPERTY WORLD · SOURCE-BACKED MAP/, 'map truthfully labels its source-backed representation');

// Variable digital price stays based on mapped complexity, never appraisal.
for (const cents of ['199', '299', '399']) assert.match(collectibleCommerce, new RegExp(`priceCents: ${cents}`), 'three low-cost digital build price tiers remain');
for (const tier of ['classic', 'detailed', 'landmark']) assert.match(collectibleCommerce, new RegExp(`tier: '${tier}'`), `pricing includes ${tier}`);
assert.match(collectibleCommerce, /footprintPoints/, 'pricing may use mapped footprint complexity');
assert.match(collectibleCommerce, /heightMeters/, 'pricing may use mapped height complexity');
assert.doesNotMatch(collectibleCommerce, /zestimate|marketValue|assessedValue|salePrice/i, 'digital price never derives from real-property market valuation');
assert.match(quoteRoute, /digital build complexity, not the market value of the physical property/i, 'quote API explains the pricing boundary');

// One digital collectible per source-backed World identity. Generated 3D keeps
// GLB ownership proof; map voxel uses the same server-rechecked mapped identity.
assert.match(collectibleCommerce, /propertyCollectibleIdentity/, 'collection uniqueness uses a server-derived World identity key');
assert.match(collectibleCommerce, /atlasId\.startsWith\('location:'\)/, 'fallback coordinates cannot become a once-only property identity');
assert.match(collectibleCommerce, /state === 'paid' \|\| state === 'minted'/, 'paid/minted reservations remain permanently locked');
assert.match(collectibleCommerce, /PropertyCollectibleRepresentationKind = 'generated-3d' \| 'map-voxel'/, 'commerce records the representation kind');
assert.match(collectibleCommerce, /verifyOwnedFinalVoxelModel/, 'shared helper still verifies enhanced final models');
assert.match(checkoutRoute, /representationKind === 'generated-3d'/, 'checkout only requires GLB proof for generated representation');
assert.match(checkoutRoute, /await verifyOwnedFinalVoxelModel/, 'generated checkout keeps account-owned model verification');
assert.match(checkoutRoute, /source-backed digital map voxel/, 'map checkout describes the map representation instead of a generated GLB');
assert.match(checkoutRoute, /quotePropertyCollectible\(building\)/, 'checkout recomputes price on the server');
assert.match(checkoutRoute, /kind: 'property_voxel_collectible'/, 'Stripe metadata identifies the collectible product rail');
assert.match(checkoutRoute, /does not buy the physical property/, 'Stripe description preserves the physical-property boundary');
assert.match(checkoutRoute, /digital_only_no_real_property_rights/, 'Stripe metadata preserves digital-only rights');
assert.match(checkoutRoute, /optional_after_purchase_and_property_verification/, 'wallet mint remains downstream and optional');
assert.match(webhook, /secureStripePropertyCollectiblePurchase/, 'signed Stripe webhook independently secures the payment');
assert.match(completeRoute, /purchase\.representationKind === 'map-voxel'/, 'success delivery has an explicit storage-free map branch');
assert.match(completeRoute, /storage: 'source-backed-map-representation'/, 'map completion never invents private GLB storage');
assert.match(completeRoute, /verifyOwnedFinalVoxelModel/, 'generated success delivery still reopens only the purchased account-owned model');
assert.match(success, /savePropertyDraftToAccount/, 'successful checkout syncs the collected item into the account Vault');
assert.match(success, /source-backed-map-voxel-collectible/, 'Vault can persist the source-backed map representation');
assert.match(success, /Create Another/, 'success loop offers another creation');
assert.match(success, /View My World/, 'success loop offers My World');
assert.match(success, /Verify &amp; Mint · optional/, 'mint remains optional and verified after collection');
assert.match(success, /You collected a digital VoxelPop item/, 'success copy states exactly what the user paid for');

// Vault/World privacy and legal separation remain unchanged.
assert.match(vault, /Your collection\./, 'Vault remains the collection/inventory hub');
assert.match(vault, /Create Another/, 'Vault has a direct repeat loop');
assert.match(vault, /View My World/, 'Vault links to My World');
assert.match(vault, /VERIFY \+ MINT · OPTIONAL/, 'paid cards keep optional verified mint secondary');
assert.match(world, /MY WORLD \+ PUBLIC WORLD/, 'signed-in World combines private account items and public shared items');
assert.match(world, /Your voxels\./, 'World describes digital items as voxels, not physical properties');
assert.match(world, /\/api\/world-properties\/mine/, 'World loads the authenticated private feed');
assert.match(myWorldApi, /requireVoxelVaultUser/, 'My World feed is authenticated');
assert.match(myWorldApi, /private: draft\?\.world\?\.public !== true/, 'private Vault items stay labeled private');
assert.match(worldApi, /draft\?\.world\?\.public !== true/, 'public feed excludes unshared drafts');
assert.match(worldApi, /toFixed\(3\)/, 'public coordinates remain privacy-rounded');
assert.match(drafts, /world:\s*\{\s*public:\s*false/, 'new saved drafts remain private by default');

// Canonical property minting stays a separate verified real-property identity rail.
assert.match(propertyClaimRules, /Address text is intentionally excluded/, 'canonical identity never uses display-address text');
assert.match(propertyClaimsApi, /oneCanonicalTwinPerParcel:\s*true/, 'canonical claim API preserves one mint per verified parcel');
assert.match(propertyClaimsApi, /addressUsedAsIdentityKey:\s*false/, 'canonical claim API rejects address strings as identity');
assert.match(canonicalRegistry, /PropertyAlreadyRegistered/, 'canonical registry rejects duplicate identity registration');
assert.match(propertyPassport, /PassportAlreadyMinted/, 'Property Passport rejects a second canonical mint');
assert.match(interestToken, /off-chain legal/, 'economic rights remain defined separately by legal agreements');

assert.match(dock, /if \(pathname === '\/property'\) return null;/, 'fixed app dock stays out of the guided maker');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search stays hidden on simple routes');

console.log('Guided VoxelPop property checks passed: sign in -> authorized photo -> no-credit source-backed Map Voxel or optional paid enhanced 3D -> verified address -> focused private My World preview -> server-priced digital collection -> Vault -> optional verified mint, with no runtime checkout photo bucket and real-property rights kept separate.');
