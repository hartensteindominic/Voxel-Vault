import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homeCss = read('app/home.module.css');
const property = read('app/property/page.js');
const propertyCss = read('app/property/property.module.css');
const geo = read('app/geo/GeoReferenceModel.js');
const worldAtlas = read('lib/world-atlas.js');
const generationCheckout = read('app/api/property-generation/checkout/route.ts');
const generationPayment = read('lib/property-generation-payment.ts');
const browserStore = read('lib/property-generation-browser-store.js');
const collectibleCommerce = read('lib/property-collectible-commerce.ts');
const quoteRoute = read('app/api/property-collectible/quote/route.ts');
const checkoutRoute = read('app/api/property-collectible/checkout/route.ts');
const completeRoute = read('app/api/property-collectible/complete/route.ts');
const success = read('app/property/success/page.js');
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

// Front door stays simple and legally separate from physical-property ownership.
assert.match(home, /PHOTO → 3D → VOXEL → YOUR WORLD/, 'home must advertise the photo-first journey');
assert.match(home, /START → SIGN IN/, 'home must enter the account-gated maker');
assert.match(home, /wallet is optional|A wallet is optional/i, 'wallet must not block creation or checkout');
assert.match(home, /does not buy the physical property/i, 'home must distinguish collecting the voxel from buying real property');
assert.doesNotMatch(home, /BUY A PIECE|BUY THE WHOLE THING|blockchain deed/i, 'unverified real-property purchase language must stay out of the simple home');
for (const source of [homeCss, propertyCss, vault, world]) assert.match(source, /#fffaf0/i, 'simple surfaces keep the warm VoxelPop canvas');
assert.match(propertyCss, /#7138f5/i, 'VoxelPop purple must remain');
assert.match(propertyCss, /#c9ff54/i, 'VoxelPop lime must remain');
assert.match(propertyCss, /#f7ae2d|#ee950f/i, 'collect action uses warm orange');
assert.match(propertyCss, /grid-template-columns:repeat\(5,1fr\)/, 'property maker must expose five guided steps');

// Sign-in + authorized photo remain the first steps.
assert.match(property, /Sign in first\./, 'signed-out maker must expose the account gate');
assert.match(property, /Continue with Google/, 'account gate has one clear sign-in action');
assert.match(property, /const labels = \['PHOTO', 'BUILD', 'VOXEL', 'WORLD', 'COLLECT'\]/, 'guided labels stay familiar');
assert.match(property, /Choose one photo\./, 'first signed-in step must be photo');
assert.match(property, /accept="image\/\*,\.heic,\.heif"/, 'iPhone HEIC\/HEIF selection remains supported');
assert.match(property, /normalizeIphonePhoto/, 'iPhone HEIC preparation remains automatic');
assert.match(property, /I took this photo or have permission to use it\./, 'source photo must require rights confirmation');
assert.match(property, /Pay \$\{CREATION_PRICE_LABEL\} → create VoxelPop/, 'photo approval must clearly require the $4.99 creation payment');

// Creation is paid but local and zero-credit; no source-photo checkout bucket or Meshy is allowed.
assert.match(property, /const CREATION_PRICE_LABEL = '\$4\.99'/, 'maker keeps the $4.99 creation price');
assert.match(property, /makeLocalVoxelPreview/, 'paid creation uses an on-device VoxelPop preview');
assert.match(property, /imageSmoothingEnabled = false/, 'preview must retain crisp pixel edges');
assert.match(property, /savePaidPropertyPhoto\(draftId, pendingPhoto\)/, 'photo must be kept on-device through checkout');
assert.match(property, /fetch\('\/api\/property-generation\/checkout'/, 'normal creation must open the server-authoritative $4.99 checkout');
assert.match(property, /loadPaidPropertyPhoto\(data\.draftId\)/, 'paid return must restore the local source photo');
assert.match(property, /zero Meshy credits|0 Meshy credits/i, 'zero-credit behavior must remain visible after payment');
assert.doesNotMatch(property, /fetch\('\/api\/property-photo-upload'/, 'normal creation must not stage or upload the source photo for generation');
assert.doesNotMatch(property, /fetch\('\/api\/property-voxel-3d'/, 'normal creation must not call paid provider 3D generation');
assert.doesNotMatch(property, /fetch\('\/api\/property-voxel-image'/, 'normal creation must not call paid provider image generation');
assert.match(generationPayment, /PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499/, 'server must own the exact $4.99 price');
assert.match(generationPayment, /session\.payment_status !== 'paid'/, 'paid creation must re-verify Stripe status');
assert.doesNotMatch(generationPayment, /storage\.|createBucket|voxel-system|MESHY/i, 'creation payment helper cannot depend on source storage or Meshy');
assert.match(browserStore, /indexedDB/, 'source photo must survive Stripe locally on the device');
assert.match(generationCheckout, /stripe\.checkout\.sessions\.create/, 'creation checkout must be a real Stripe payment');
assert.match(generationCheckout, /unit_amount: PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'creation price cannot be chosen by the client');
assert.match(generationCheckout, /meshy_credits: '0'/, 'checkout metadata must truthfully record zero Meshy credits');
assert.match(generationCheckout, /source_photo_storage: 'device_only_not_uploaded_for_creation'/, 'checkout must truthfully record device-only source handling');
assert.doesNotMatch(generationCheckout, /stagePaidPropertyPhoto|readMeshyCreditBalance|MESHY_PROPERTY_CREDITS|MESHY_API_KEY|storage\.|createBucket|voxel-system/, 'creation checkout must not stage photos, inspect Meshy, or spend provider credits');
assert.doesNotMatch(generationCheckout, /Private VoxelPop checkout storage could not be prepared/, 'the old private checkout-storage failure must be unreachable');

// Address opens the improved source-backed 3D map.
assert.match(property, /Build 3D map \+ verify address/, 'address action must explicitly build the 3D map');
assert.match(property, /GeoReferenceModel/, 'interactive property scene must use the existing source-backed 3D renderer');
assert.match(property, /\['orbit', 'street', 'top'\]/, 'map must expose orbit, street, and top views');
assert.match(property, /SOURCE-BACKED 3D MAP/, 'map must label its evidence basis');
assert.match(property, /MAP SOURCE/, 'map must show source context');
assert.match(property, /NEARBY BUILDINGS/, 'map must show neighborhood context');
assert.match(property, /Place this preview in My World/, 'map review must precede My World placement');
assert.match(geo, /addVoxelShell/, 'map building footprints should render as voxel geometry');
assert.match(geo, /addPublicRealmContext/, 'mapped streets and paths should enrich the neighborhood scene');
assert.match(worldAtlas, /fetchOvertureBuildingNeighborhood/, 'World Atlas must prefer Overture');
assert.match(worldAtlas, /fetchGlobalNeighborhoodReference/, 'World Atlas must retain OpenStreetMap fallback');
assert.match(worldAtlas, /No replacement building was invented/, 'map failures must fail closed without fake buildings');

// My World remains private before collection.
assert.match(property, /PlanetStreamGlobe/, 'private World preview keeps the globe');
assert.match(property, /MY WORLD · PRIVATE PREVIEW/, 'pre-collection World preview must stay private');
assert.match(property, /\/api\/property-collectible\/quote/, 'server quote follows mapped identity verification');
assert.match(property, /async function collectAndSave\(\)/, 'digital checkout action should use Collect language');
assert.match(property, /Collect voxel ·/, 'final paid action identifies the digital thing being collected');
assert.match(property, /not the market value of the house or land/, 'price copy must never look like a real-property valuation');
assert.match(property, /`map-voxel:\$\{draftId\}`/, 'map-backed collection identifier must remain draft-bound');

// Variable pricing is digital complexity only, never appraisal.
for (const cents of ['199', '299', '399']) assert.match(collectibleCommerce, new RegExp(`priceCents: ${cents}`), 'three low-cost digital collectible tiers must remain');
for (const tier of ['classic', 'detailed', 'landmark']) assert.match(collectibleCommerce, new RegExp(`tier: '${tier}'`), `pricing must include ${tier}`);
assert.match(collectibleCommerce, /footprintPoints/, 'pricing may use source-backed footprint complexity');
assert.match(collectibleCommerce, /heightMeters/, 'pricing may use source-backed height complexity');
assert.doesNotMatch(collectibleCommerce, /zestimate|marketValue|assessedValue|salePrice/i, 'digital price must never derive from market valuation');
assert.match(quoteRoute, /digital build complexity, not the market value of the physical property/i, 'quote API must explain the pricing boundary');

// Map-backed assets can be collected without weakening identity/payment controls.
assert.match(collectibleCommerce, /propertyCollectibleIdentity/, 'collection uniqueness must use server-derived World identity');
assert.match(collectibleCommerce, /atlasId\.startsWith\('location:'\)/, 'fallback coordinates cannot become once-only property identity');
assert.match(collectibleCommerce, /state === 'paid' \|\| state === 'minted'/, 'paid\/minted reservations remain permanently locked');
assert.match(collectibleCommerce, /const mapBackedTaskId = `map-voxel:\$\{draftId\}`/, 'map-backed item must be exactly tied to the draft');
assert.match(collectibleCommerce, /mapBacked: true/, 'map-backed collectible path must be explicit');
assert.match(collectibleCommerce, /propertyDraftItemId\(input\.userId, draftId, 'voxel'\)/, 'legacy generated GLBs must retain account-scoped ownership verification');
assert.match(checkoutRoute, /verifyOwnedFinalVoxelModel/, 'checkout verifies the selected digital asset');
assert.match(checkoutRoute, /quotePropertyCollectible\(building\)/, 'checkout recomputes price on the server');
assert.match(checkoutRoute, /kind: 'property_voxel_collectible'/, 'Stripe metadata identifies the correct product rail');
assert.match(checkoutRoute, /source-backed mapped 3D geometry/, 'Stripe copy supports the no-Meshy map-backed collectible');
assert.match(checkoutRoute, /does not buy the physical property/, 'Stripe copy preserves the physical-property boundary');
assert.match(checkoutRoute, /digital_only_no_real_property_rights/, 'Stripe metadata preserves digital-only rights');
assert.match(checkoutRoute, /optional_after_purchase_and_property_verification/, 'wallet mint remains downstream and optional');
assert.match(checkoutRoute, /success_url: `\$\{appUrl\}\/property\/success/, 'payment returns through Vault delivery');
assert.match(webhook, /secureStripePropertyCollectiblePurchase/, 'signed Stripe webhook independently secures payment');

// Completion saves map geometry or legacy GLB without requiring new private model storage.
assert.match(completeRoute, /secureStripePropertyCollectiblePurchase/, 'success path re-verifies Stripe payment and buyer');
assert.match(completeRoute, /atlasId: purchase\.atlasId/, 'success re-binds verification to mapped identity');
assert.match(completeRoute, /source-backed-map-geometry/, 'map-backed delivery must identify its storage\/render basis');
assert.match(completeRoute, /modelUrl: durableModelUrl/, 'legacy purchased GLBs keep their durable model URL path');
assert.match(success, /GeoReferenceModel/, 'success screen can render a map-backed collectible');
assert.match(success, /data\.model\.mapBacked === true/, 'Vault save must distinguish map-backed and generated assets');
assert.match(success, /modelUrl: data\.model\.modelUrl/, 'legacy generated model delivery remains supported');
assert.match(success, /savePropertyDraftToAccount/, 'successful checkout syncs to account Vault');
assert.match(success, /Create Another/, 'success loop offers another creation');
assert.match(success, /View My World/, 'success loop offers My World');
assert.match(success, /Verify &amp; Mint · optional/, 'mint remains optional after collection');

// Vault\/World privacy and canonical property minting remain unchanged.
assert.match(vault, /Your collection\./, 'Vault remains the inventory hub');
assert.match(vault, /Create Another/, 'Vault has a repeat loop');
assert.match(vault, /View My World/, 'Vault links to My World');
assert.match(vault, /VERIFY \+ MINT · OPTIONAL/, 'paid cards keep mint optional');
assert.match(world, /MY WORLD \+ PUBLIC WORLD/, 'signed-in World combines private and public feeds');
assert.match(world, /\/api\/world-properties\/mine/, 'World loads authenticated private feed');
assert.match(myWorldApi, /requireVoxelVaultUser/, 'My World feed is authenticated');
assert.match(myWorldApi, /private: draft\?\.world\?\.public !== true/, 'private Vault items remain labeled private');
assert.match(worldApi, /draft\?\.world\?\.public !== true/, 'public feed excludes unshared drafts');
assert.match(worldApi, /toFixed\(3\)/, 'public coordinates remain privacy-rounded');
assert.match(drafts, /world:\s*\{\s*public:\s*false/, 'new drafts remain private by default');
assert.match(propertyClaimRules, /Address text is intentionally excluded/, 'canonical identity never uses display-address text');
assert.match(propertyClaimsApi, /oneCanonicalTwinPerParcel:\s*true/, 'canonical claim API preserves one mint per verified parcel');
assert.match(propertyClaimsApi, /addressUsedAsIdentityKey:\s*false/, 'canonical claim API rejects address strings as identity');
assert.match(canonicalRegistry, /PropertyAlreadyRegistered/, 'canonical registry rejects duplicate identity registration');
assert.match(propertyPassport, /PassportAlreadyMinted/, 'Property Passport rejects a second canonical mint');
assert.match(interestToken, /off-chain legal/, 'economic rights remain defined separately by legal agreements');

assert.match(dock, /if \(pathname === '\/property'\) return null;/, 'fixed app dock stays out of guided maker');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search stays hidden on simple routes');

console.log('Guided VoxelPop property checks passed: sign in -> authorized device-local photo -> server-authoritative $4.99 creation payment -> zero-credit on-device voxel preview -> source-backed Overture\/OSM 3D neighborhood -> private My World preview -> optional server-priced digital collection -> Vault -> optional verified mint, with no Meshy or source-photo checkout Storage dependency.');
