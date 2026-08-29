import assert from 'node:assert/strict';
import fs from 'node:fs';

const home = fs.readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');
const homeCss = fs.readFileSync(new URL('../app/home.module.css', import.meta.url), 'utf8');
const property = fs.readFileSync(new URL('../app/property/page.js', import.meta.url), 'utf8');
const propertyCss = fs.readFileSync(new URL('../app/property/property.module.css', import.meta.url), 'utf8');
const photoUploadRoute = fs.readFileSync(new URL('../app/api/property-photo-upload/route.ts', import.meta.url), 'utf8');
const voxelImageRoute = fs.readFileSync(new URL('../app/api/property-voxel-image/route.ts', import.meta.url), 'utf8');
const voxel3dRoute = fs.readFileSync(new URL('../app/api/property-voxel-3d/route.ts', import.meta.url), 'utf8');
const canonicalStatusRoute = fs.readFileSync(new URL('../app/api/vault/property-canonical-status/route.ts', import.meta.url), 'utf8');
const claim = fs.readFileSync(new URL('../app/vault/properties/claim/page.js', import.meta.url), 'utf8');
const claimCss = fs.readFileSync(new URL('../app/vault/properties/claim/claim.module.css', import.meta.url), 'utf8');
const propertyClaimsApi = fs.readFileSync(new URL('../app/api/vault/property-claims/route.ts', import.meta.url), 'utf8');
const propertyClaimRules = fs.readFileSync(new URL('../lib/vault/property-claim.js', import.meta.url), 'utf8');
const canonicalRegistry = fs.readFileSync(new URL('../contracts/CanonicalPropertyRegistry.sol', import.meta.url), 'utf8');
const propertyPassport = fs.readFileSync(new URL('../contracts/PropertyPassport.sol', import.meta.url), 'utf8');
const interestToken = fs.readFileSync(new URL('../contracts/PropertyInterestToken.sol', import.meta.url), 'utf8');
const openImagery = fs.readFileSync(new URL('../lib/open-street-imagery.js', import.meta.url), 'utf8');
const vault = fs.readFileSync(new URL('../app/vault/property-drafts/page.js', import.meta.url), 'utf8');
const world = fs.readFileSync(new URL('../app/world/page.js', import.meta.url), 'utf8');
const worldApi = fs.readFileSync(new URL('../app/api/world-properties/route.ts', import.meta.url), 'utf8');
const globe = fs.readFileSync(new URL('../app/vault/earth/PlanetStreamGlobe.js', import.meta.url), 'utf8');
const drafts = fs.readFileSync(new URL('../lib/property-drafts.js', import.meta.url), 'utf8');
const dock = fs.readFileSync(new URL('../app/components/FinancialOSNav.js', import.meta.url), 'utf8');
const command = fs.readFileSync(new URL('../app/components/AppCommandCenter.js', import.meta.url), 'utf8');

assert.match(home, /Add a property\./, 'home must lead with one address action');
assert.match(home, /name="q"/, 'home must have one address input');
assert.match(home, /action="\/property"/, 'home must route directly to the property maker');
assert.match(home, /CREATE IMAGE/, 'home must explain image-first creation');
assert.match(home, /CREATE 3D/, 'home must explain the 3D step');
assert.match(home, /MINT LATER/, 'minting must remain downstream and optional');
assert.match(home, /Creating or minting a property model does not buy the property or create deed\/title rights\./, 'home must preserve property-rights truth');
assert.doesNotMatch(home, /BUY PIECE|BUY WHOLE|BUY A PIECE|BUY THE WHOLE THING/, 'buying must stay out of the front door until a real exact-property path exists');
assert.doesNotMatch(home, /FOUR CORE JOBS|HomeCapabilityStrip|Digital REITs/, 'advanced taxonomy must not clutter home');

for (const source of [homeCss, propertyCss, claimCss, vault, world]) {
  assert.match(source, /#fffaf0/i, 'simple property surfaces should keep the warm VoxelPop canvas');
}
assert.match(propertyCss, /#f2a11b/i, 'Create image should use the approved warm orange');
assert.match(propertyCss, /#3c948e/i, 'Create 3D should use the approved teal');
assert.match(propertyCss, /#7662b4/i, 'Vault and verification should use the approved purple');
assert.match(propertyCss, /border-radius:38px/, 'property should keep one large rounded visual card');

assert.match(property, /<h1>Property<\/h1>/, 'property maker must use the approved simple title');
assert.match(property, /Upload latest photo/, 'property maker must let the user supply a newer property reference');
assert.match(property, /I took this photo or have permission to use it\./, 'user uploads must require an explicit photo-rights confirmation');
assert.match(property, /\/api\/property-photo-upload/, 'uploaded property photos must use the private upload route');
assert.match(property, /Create image/, 'property maker must expose Create image');
assert.match(property, /Redo image/, 'property maker must allow an explicit image retry while troubleshooting likeness');
assert.match(property, /Create 3D/, 'property maker must expose Create 3D');
assert.match(property, /'Vault'/, 'property maker must expose Vault');
assert.match(property, /Verify & mint once/, 'property maker must route saved 3D properties into one-parcel verification before minting');
assert.match(property, /\/api\/world-atlas\/open-imagery/, 'property maker must still load rights-cleared street imagery as an optional fallback');
assert.match(property, /\/api\/property-voxel-image/, 'Create image must use the property voxel-image route');
assert.match(property, /\/api\/property-voxel-3d/, 'Create 3D must use the generated-image 3D route');
assert.match(property, /MeshyModelViewer/, 'completed 3D must open in the interactive model viewer');
assert.match(property, /references:\s*\[activeReference\]/, 'image generation must use exactly the selected or uploaded facade reference');
assert.match(property, /setModel\(emptyModel\(\)\)/, 'a newly selected/generated property image must invalidate the stale 3D view in the current session');
assert.match(property, /modelRunning/, 'Create 3D controls must stay locked while the current model is processing');
assert.match(property, /No facade invented\./, 'missing photo evidence must fail closed visually');
assert.match(property, /parcel identity—not the address text—blocks duplicate canonical mints/i, 'simple UI must explain the canonical duplicate key without technical overload');
assert.doesNotMatch(property, /GeoReferenceModel/, 'simple maker must not substitute a generic map extrusion for the photo-guided property');
assert.doesNotMatch(property, /BUY A PIECE|BUY THE WHOLE THING|buyPortion|buyWhole/, 'buying must be absent until exact legal purchase rails exist');
assert.doesNotMatch(property, /mintVoxelFlip|eth_requestAccounts/, 'simple maker must not mint or request a wallet directly');

assert.match(photoUploadRoute, /requireVoxelVaultAdmin/, 'property photo upload must remain owner-gated while paid generation is owner-only');
assert.match(photoUploadRoute, /rightsConfirmed/, 'property photo upload must reject missing rights confirmation');
assert.match(photoUploadRoute, /image\/jpeg/, 'upload route must restrict accepted image formats');
assert.match(photoUploadRoute, /MAX_BYTES/, 'upload route must bound file size');
assert.match(photoUploadRoute, /public:\s*false/, 'uploaded source photos must remain in a private storage bucket');
assert.match(photoUploadRoute, /createSignedUrl/, 'generation must receive only a short-lived signed source URL');
assert.match(photoUploadRoute, /user-owned/, 'uploaded references must be explicitly classified as user-owned/authorized');

assert.match(voxelImageRoute, /requireVoxelVaultAdmin/, 'paid image generation must remain owner-gated during troubleshooting');
assert.match(voxelImageRoute, /open-licensed/, 'voxel image route must require explicit reference rights');
assert.match(voxelImageRoute, /BLOCKED_REFERENCE_HOSTS/, 'voxel image route must keep an explicit restricted-host blocklist');
assert.match(voxelImageRoute, /zillow/, 'restricted listing-image hosts must remain represented in the derivative-generation blocklist');
assert.match(voxelImageRoute, /Preserve the visible building identity/, 'image prompt must preserve the actual photographed architecture');
assert.match(voxelImageRoute, /Do not redesign, beautify, modernize, add floors, remove floors, invent windows, move doors, change the roof type, or substitute a generic house\./, 'image prompt must explicitly block generic-house drift');

assert.match(voxel3dRoute, /requireVoxelVaultAdmin/, 'paid 3D generation must remain owner-gated during troubleshooting');
assert.match(voxel3dRoute, /image-to-3d/, '3D must be created from the approved voxel image');
assert.match(voxel3dRoute, /property-voxel:/, 'property 3D models must be cached per mapped property');
assert.match(voxel3dRoute, /persistModelBinary/, 'completed GLBs must be persisted instead of relying only on provider URLs');
assert.match(voxel3dRoute, /sameSourceImage/, 'cached 3D reuse must be tied to the exact voxel image used to create it');
assert.match(voxel3dRoute, /existing\?\.source_image_url/, 'the 3D route must compare cached source image identity before reuse');

assert.match(openImagery, /selectionStrategy:\s*'newest-nearby-first'/, 'open imagery must expose newest-nearby-first selection');
assert.match(openImagery, /primaryPhoto:\s*photos\[0\]/, 'newest nearby image must remain the primary open reference');

assert.match(propertyClaimRules, /Address text is intentionally excluded/, 'canonical property identity must never use display-address text as the duplicate key');
assert.match(propertyClaimRules, /countryCode, subdivisionCode \|\| '-', countyCode, parcelId/, 'canonical property fingerprint must use jurisdiction plus normalized parcel identifier');
assert.match(propertyClaimsApi, /oneCanonicalTwinPerParcel:\s*true/, 'user claim API must explicitly preserve one canonical twin per parcel');
assert.match(propertyClaimsApi, /addressUsedAsIdentityKey:\s*false/, 'user claim API must explicitly reject address strings as canonical identity');
assert.match(canonicalStatusRoute, /propertyFingerprint/, 'canonical status must use the same normalized fingerprint as claim creation');
assert.match(canonicalStatusRoute, /canonical_passport_token_id/, 'canonical status must inspect the persisted Passport state');
assert.match(canonicalStatusRoute, /alreadyMinted/, 'canonical status must expose a safe duplicate-mint flag');
assert.match(canonicalStatusRoute, /duplicateMintBlocked:\s*true/, 'canonical status must always state that duplicate canonical mints are blocked');
assert.doesNotMatch(canonicalStatusRoute, /property_label|parcel_id_normalized/, 'public user status must not leak someone else’s label or raw parcel identifier');
assert.match(canonicalRegistry, /PropertyAlreadyRegistered/, 'onchain canonical registry must reject a second identity registration for the same propertyId');
assert.match(propertyPassport, /PassportAlreadyMinted/, 'Property Passport must reject a second canonical mint for the same propertyId');

assert.match(claim, /ONE PARCEL · ONE CANONICAL MINT/, 'verification must explain the one-parcel rule in simple language');
assert.match(claim, /\/api\/vault\/property-canonical-status/, 'verification must check duplicate canonical state before submitting a claim');
assert.match(claim, /Already minted\. Duplicate canonical mint blocked\./, 'verification must visibly stop an already-minted parcel');
assert.match(claim, /Own a piece/, 'verified/minted properties may explain the separate fractional path');
assert.match(claim, /compliant fractional offering for this exact property actually exists/, 'fractional UI must remain fail-closed until an exact compliant offering exists');
assert.doesNotMatch(claim, /fetch\([^\n]+buy|executePurchase|automaticPurchase/i, 'simple verification must not execute a property or fractional purchase');
assert.match(interestToken, /off-chain legal/, 'fractional interest contract must preserve the separate legal-agreement boundary');

assert.match(vault, /Your properties\./, 'Vault should stay consumer-simple');
assert.match(vault, /OPEN 3D/, 'Vault should make opening a property the primary action');
assert.match(vault, /VERIFY \+ MINT/, 'Vault must keep verification ahead of minting');
assert.match(drafts, /world:\s*\{\s*public:\s*false/, 'all new drafts must start private');

assert.match(worldApi, /draft\?\.world\?\.public !== true/, 'public feed must exclude drafts not explicitly shared');
assert.match(worldApi, /toFixed\(3\)/, 'public coordinates must be rounded before publication');
assert.doesNotMatch(worldApi, /draft\.label/, 'public feed must not expose the private saved address label by default');
assert.match(worldApi, /minted:\s*draft\?\.blockchain\?\.minted === true/, 'World feed must preserve a safe minted-state field for opt-in property markers');
assert.match(world, /PUBLIC 3D WORLD/, 'World must remain available as a separate simple screen');
assert.match(world, /PlanetStreamGlobe/, 'World must use the interactive globe');
assert.match(globe, /community-property/, 'globe renderer must recognize shared community properties');

assert.match(dock, /if \(pathname === '\/property'\) return null;/, 'the bare maker must not be duplicated by a fixed app dock');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search must stay hidden on simple consumer routes');

console.log('VoxelPop property flow checks passed: private user-owned photo or newest open reference -> faithful/redoable voxel image -> source-matched 3D -> Vault -> one-parcel verification, with canonical duplicate-mint blocking and fractional ownership kept separate/fail-closed.');
