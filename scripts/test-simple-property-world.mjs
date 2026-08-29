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

assert.match(home, /Sign in first\./i, 'home must make authentication the first property step');
assert.match(home, /START PROPERTY → SIGN IN/, 'home must route into the account-gated property maker');
assert.match(home, /href="\/property"/, 'home property CTA must enter the property maker');
for (const label of ['SIGN IN', 'ADDRESS', 'PHOTO', 'MAKE VOXEL', '3D', 'VAULT']) {
  assert.match(home, new RegExp(label), `home flow must include ${label}`);
}
assert.match(home, /Nothing uploads, generates, buys, rents or saves before you sign in/i, 'home must explain the account-first boundary');
assert.match(home, /voxel image must finish first/i, 'home must put voxel image completion ahead of 3D');
assert.match(home, /does not buy, rent, or create deed\/title rights/i, 'home must preserve real-property rights truth');
assert.doesNotMatch(home, /BUY PIECE|BUY WHOLE|BUY A PIECE|BUY THE WHOLE THING/, 'unverified buying must stay out of the front door');

for (const source of [homeCss, propertyCss, claimCss, vault, world]) {
  assert.match(source, /#fffaf0/i, 'simple property surfaces should keep the warm VoxelPop canvas');
}
assert.match(propertyCss, /#7138f5/i, 'guided maker must preserve VoxelPop purple');
assert.match(propertyCss, /#c9ff54/i, 'guided maker must preserve VoxelPop lime progress');
assert.match(propertyCss, /#f7ae2d|#f2a11b/i, 'voxel-image step should use warm orange');
assert.match(propertyCss, /#45a7a0|#3c948e/i, '3D step should use teal');
assert.match(propertyCss, /border-radius:38px/, 'property should keep one large rounded visual card');
assert.match(propertyCss, /signinPanel/, 'property maker must style the account gate as a first-class VoxelPop step');

assert.match(property, /<h1>Property<\/h1>/, 'property maker must keep the simple title');
assert.match(property, /authReady/, 'property maker must wait for authentication state before exposing workflow controls');
assert.match(property, /Sign in first\./, 'signed-out property maker must expose only the account-first step');
assert.match(property, /Continue with Google/, 'account gate must have one clear sign-in action');
assert.match(property, /Nothing is uploaded, generated or saved before sign-in/i, 'property maker must explain that no workflow action occurs while signed out');
assert.match(property, /if \(!session\?\.access_token\) return setMessage\('Sign in before starting a property\.'\)/, 'property search itself must reject signed-out use');
assert.match(property, /if \(!session\?\.access_token\) return setMessage\('Sign in before choosing a photo\.'\)/, 'property photo picker must reject signed-out use');
assert.match(property, /STEP \{stage\} OF 6/, 'property maker must expose simple guided progress');
assert.match(property, /Which property\?/, 'step one after sign-in must be address');
assert.match(property, /Pick the clearest photo\./, 'step two must explicitly ask for the best photo');
assert.match(property, /Upload your photo/, 'photo step must expose upload before rights confirmation');
assert.match(property, /Use this street photo/, 'photo step may offer a rights-cleared street-photo fallback');
assert.match(property, /I took this photo or have permission to use it\./, 'user upload must require rights confirmation before server upload');
assert.match(property, /Make the voxel first\./, 'image generation must be an explicit required stage before 3D');
assert.match(property, /Make my voxel/, 'voxel-image action must be simple and explicit');
assert.match(property, /taskToken/, 'property page must poll the asynchronous image task instead of waiting on one long request');
assert.match(property, /Making your voxel/, 'property page must expose live image-processing state');
assert.match(property, /Make it 3D/, '3D step must unlock only after the voxel image exists');
assert.match(property, /Save to my Vault/, 'Vault step must stay explicit and account-bound');
assert.match(property, /Verify &amp; mint once/, 'saved property must continue into canonical verification');
assert.match(property, /accept="image\/\*,\.heic,\.heif"/, 'iPhone photo picker must allow HEIC/HEIF selection');
assert.match(property, /normalizeIphonePhoto/, 'iPhone HEIC/HEIF photos must have an automatic preparation path');
assert.match(property, /\/api\/property-photo-upload/, 'uploaded property photos must use the private upload route');
assert.match(property, /\/api\/world-atlas\/open-imagery/, 'maker must retain rights-cleared open imagery fallback');
assert.match(property, /\/api\/property-voxel-image/, 'Make my voxel must use the property voxel-image route');
assert.match(property, /\/api\/property-voxel-3d/, 'Make it 3D must use the generated-image 3D route');
assert.match(property, /MeshyModelViewer/, 'completed 3D must open in the interactive viewer');
assert.match(property, /references:\s*\[activeReference\]/, 'image generation must use the exact chosen/uploaded reference');
assert.match(property, /No facade invented\./, 'missing photo evidence must fail closed visually');
assert.match(property, /parcel identity—not the address text—blocks duplicate canonical mints/i, 'simple UI must preserve the one-parcel rule');
assert.doesNotMatch(property, /BUY A PIECE|BUY THE WHOLE THING|buyPortion|buyWhole/, 'unverified buying must stay absent');
assert.doesNotMatch(property, /mintVoxelFlip|eth_requestAccounts/, 'simple maker must not mint or request a wallet directly');

assert.match(photoUploadRoute, /requireVoxelVaultUser/, 'normal signed-in users must be able to upload their own property photos');
assert.doesNotMatch(photoUploadRoute, /requireVoxelVaultAdmin/, 'photo upload itself must not require the owner/admin allowlist');
assert.match(photoUploadRoute, /rightsConfirmed/, 'photo upload must reject missing rights confirmation');
assert.match(photoUploadRoute, /image\/jpeg/, 'server upload must restrict stored generation formats');
assert.match(photoUploadRoute, /MAX_BYTES/, 'upload route must bound file size');
assert.match(photoUploadRoute, /public:\s*false/, 'uploaded source photos must stay private');
assert.match(photoUploadRoute, /createSignedUrl/, 'generation must receive only a short-lived signed URL');
assert.match(photoUploadRoute, /user-owned/, 'uploaded references must be classified as user-owned/authorized');

assert.match(voxelImageRoute, /requireVoxelVaultUser/, 'voxel image generation must require a verified signed-in account');
assert.doesNotMatch(voxelImageRoute, /requireVoxelVaultAdmin/, 'normal signed-in property creators must not hit an admin-only image gate');
assert.match(voxelImageRoute, /export async function POST/, 'voxel image route must start an asynchronous provider job');
assert.match(voxelImageRoute, /export async function GET/, 'voxel image route must expose job polling');
assert.match(voxelImageRoute, /createHmac/, 'image polling token must be server-signed');
assert.match(voxelImageRoute, /property-voxel-image-v1:\$\{userId\}:\$\{taskId\}/, 'image task token must bind job to the signed-in user');
assert.match(voxelImageRoute, /open-licensed/, 'voxel image route must require explicit reference rights');
assert.match(voxelImageRoute, /BLOCKED_REFERENCE_HOSTS/, 'restricted source hosts must remain blocked');
assert.match(voxelImageRoute, /zillow/, 'listing-image blocklist must retain Zillow');
assert.match(voxelImageRoute, /Preserve the visible building identity/, 'image prompt must preserve photographed architecture');
assert.match(voxelImageRoute, /substitute a generic house/, 'image prompt must block generic-house drift');

assert.match(voxel3dRoute, /requireVoxelVaultUser/, '3D generation must require a verified signed-in account');
assert.doesNotMatch(voxel3dRoute, /requireVoxelVaultAdmin/, 'normal signed-in property creators must not hit an admin-only 3D gate');
assert.match(voxel3dRoute, /image-to-3d/, '3D must be created from the approved voxel image');
assert.match(voxel3dRoute, /itemIdFor\(auth\.user\.id, atlasId\)/, 'unverified 3D drafts must be scoped to the signed-in user and property');
assert.match(voxel3dRoute, /userItemPrefix\(auth\.user\.id\)/, '3D task polling must reject jobs from other users');
assert.match(voxel3dRoute, /sameSourceImage/, 'cached 3D reuse must be tied to the exact source voxel image');
assert.match(voxel3dRoute, /persistModelBinary/, 'completed GLBs must be persisted');

assert.match(openImagery, /selectionStrategy:\s*'newest-nearby-first'/, 'open imagery must prefer newest nearby references');
assert.match(openImagery, /primaryPhoto:\s*photos\[0\]/, 'newest nearby image must remain the primary fallback');

assert.match(propertyClaimRules, /Address text is intentionally excluded/, 'canonical identity must never use display-address text');
assert.match(propertyClaimsApi, /oneCanonicalTwinPerParcel:\s*true/, 'claim API must preserve one canonical twin per parcel');
assert.match(propertyClaimsApi, /addressUsedAsIdentityKey:\s*false/, 'claim API must reject address strings as identity');
assert.match(canonicalStatusRoute, /propertyFingerprint/, 'canonical status must use the normalized parcel fingerprint');
assert.match(canonicalStatusRoute, /alreadyMinted/, 'canonical status must expose duplicate-mint state');
assert.match(canonicalStatusRoute, /duplicateMintBlocked:\s*true/, 'duplicate canonical mints must stay blocked');
assert.match(canonicalRegistry, /PropertyAlreadyRegistered/, 'registry must reject duplicate property identity registration');
assert.match(propertyPassport, /PassportAlreadyMinted/, 'Passport must reject a second canonical mint');

assert.match(claim, /ONE PARCEL · ONE CANONICAL MINT/, 'verification must explain the one-parcel rule simply');
assert.match(claim, /Already minted\. Duplicate canonical mint blocked\./, 'verification must visibly stop duplicate minting');
assert.match(claim, /Own a piece/, 'fractional path may be explained separately');
assert.match(claim, /compliant fractional offering for this exact property actually exists/, 'fractional UI must remain fail-closed');
assert.match(interestToken, /off-chain legal/, 'fractional interest contract must preserve the legal-agreement boundary');

assert.match(vault, /Your properties\./, 'Vault should stay consumer-simple');
assert.match(vault, /OPEN 3D/, 'Vault should make opening a property primary');
assert.match(vault, /VERIFY \+ MINT/, 'Vault must keep verification ahead of minting');
assert.match(drafts, /world:\s*\{\s*public:\s*false/, 'new drafts must start private');
assert.match(worldApi, /draft\?\.world\?\.public !== true/, 'World must exclude unshared drafts');
assert.match(worldApi, /toFixed\(3\)/, 'public coordinates must remain privacy-rounded');
assert.match(world, /PUBLIC 3D WORLD/, 'World must remain a separate simple screen');
assert.match(globe, /community-property/, 'globe must recognize shared community properties');
assert.match(dock, /if \(pathname === '\/property'\) return null;/, 'fixed app dock must stay out of the guided maker');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search must stay hidden on simple routes');

console.log('Guided VoxelPop property checks passed: sign in -> address -> explicit photo -> asynchronous voxel image -> approved-image 3D -> account Vault -> optional one-parcel mint, with private/user-scoped jobs and no fake property rights.');
