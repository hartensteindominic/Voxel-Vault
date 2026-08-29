import assert from 'node:assert/strict';
import fs from 'node:fs';

const home = fs.readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');
const homeCss = fs.readFileSync(new URL('../app/home.module.css', import.meta.url), 'utf8');
const property = fs.readFileSync(new URL('../app/property/page.js', import.meta.url), 'utf8');
const propertyCss = fs.readFileSync(new URL('../app/property/property.module.css', import.meta.url), 'utf8');
const vault = fs.readFileSync(new URL('../app/vault/property-drafts/page.js', import.meta.url), 'utf8');
const world = fs.readFileSync(new URL('../app/world/page.js', import.meta.url), 'utf8');
const worldApi = fs.readFileSync(new URL('../app/api/world-properties/route.ts', import.meta.url), 'utf8');
const globe = fs.readFileSync(new URL('../app/vault/earth/PlanetStreamGlobe.js', import.meta.url), 'utf8');
const drafts = fs.readFileSync(new URL('../lib/property-drafts.js', import.meta.url), 'utf8');
const productMap = fs.readFileSync(new URL('../lib/product-map.js', import.meta.url), 'utf8');
const dock = fs.readFileSync(new URL('../app/components/FinancialOSNav.js', import.meta.url), 'utf8');
const command = fs.readFileSync(new URL('../app/components/AppCommandCenter.js', import.meta.url), 'utf8');

assert.match(home, /Add a property\./, 'home must lead with one property action');
assert.match(home, /name="q"/, 'home must have one address input');
assert.match(home, /action="\/property"/, 'home address input must open the simple property screen');
assert.match(home, /BUY PIECE \/ WHOLE/, 'home must explain the condensed ownership choice');
assert.match(home, /href="\/vault\/property-drafts"/, 'home must link directly to the property Vault');
assert.match(home, /href="\/world"/, 'home must link directly to the shared 3D World');
assert.match(home, /See it in voxels\./, 'home should use the friendly VoxelPop-like promise');
assert.doesNotMatch(home, /FOUR CORE JOBS|HomeCapabilityStrip|Digital REITs/, 'advanced product taxonomy must not dominate the home screen');

for (const source of [homeCss, propertyCss, vault, world]) {
  assert.match(source, /#7138f5/i, 'simple property surfaces should keep the VoxelPop purple');
  assert.match(source, /#c9ff54/i, 'simple property surfaces should keep the VoxelPop lime');
  assert.match(source, /#fffaf0/i, 'simple property surfaces should keep the warm VoxelPop canvas');
}
assert.match(homeCss, /border-radius:34px/, 'home should retain one large rounded maker card');
assert.match(propertyCss, /\.steps\{display:none\}/, 'the old five-step strip must stay visually hidden');

assert.match(property, /1 · ADD PROPERTY/, 'simple property screen must start with adding one address');
assert.match(property, /BUY A PIECE/, 'simple property screen must expose fractional intent');
assert.match(property, /BUY THE WHOLE THING/, 'simple property screen must expose full-purchase intent');
assert.match(property, /SAVE TO VAULT/, 'simple property screen must save the 3D property');
assert.match(property, /VERIFY → MINT/, 'mint must stay downstream of rights verification');
assert.match(property, /SHOW ON WORLD/, 'property must have one explicit public-share action');
assert.match(property, /fractionRail\?\.liveExecutionReady === true/, 'fractional execution must be gated by a verified live rail');
assert.match(property, /No verified fractional offering is connected to this exact property yet/, 'unavailable fractional purchases must fail closed in plain language');
assert.match(property, /listingMatchesResolvedAddress\(item, resolvedQuery\)/, 'whole-property handoff must require an exact resolved-address match, not just geographic proximity');
assert.match(property, /Boolean\(item\?\.sourceUrl\)/, 'whole-property handoff must require an authorized source URL');
assert.match(property, /if \(exactSale\?\.sourceUrl\)/, 'whole-property action must fail closed unless the exact authorized sale is resolved');
assert.match(property, /not currently tied to an authorized matching sale listing/, 'unlisted or mismatched full-property purchase must fail closed');
assert.match(property, /resolvedQuery/, 'saved property identity must stay tied to the address that actually resolved');
assert.match(property, /NO BUILDING INVENTED/, 'land and location-only properties must not receive a fake building');
assert.match(property, /savePropertyDraft/, '3D property saving must not depend on purchase execution');
assert.match(property, /setPropertyDraftWorldVisibility/, 'public World sharing must be explicit');
assert.match(property, /A 3D model or mint is digital provenance, not a deed/, 'simple UI must preserve deed/mint truth');
assert.doesNotMatch(property, /mintVoxelFlip|eth_requestAccounts/, 'the simple property screen must not mint or request a wallet before verification');

assert.match(vault, /Your properties\./, 'Vault should stay consumer-simple');
assert.match(vault, /OPEN 3D/, 'Vault should make opening a property the primary action');
assert.match(vault, /VERIFY \+ MINT/, 'Vault should preserve verification before minting');

assert.match(drafts, /world:\s*\{\s*public:\s*false/, 'all new drafts must start private');
assert.match(drafts, /setPropertyDraftWorldVisibility/, 'drafts need an explicit visibility transition');

assert.match(worldApi, /draft\?\.world\?\.public !== true/, 'public feed must exclude drafts not explicitly shared');
assert.match(worldApi, /toFixed\(3\)/, 'public coordinates must be rounded before publication');
assert.match(worldApi, /shiftedGeometry/, 'public geometry must be shifted to the rounded public coordinate');
assert.match(worldApi, /publicId/, 'public feed must not expose raw user and draft IDs');
assert.doesNotMatch(worldApi, /draft\.label/, 'public feed must not expose the private saved address label by default');

assert.match(world, /PUBLIC 3D WORLD/, 'World must be a first-class simple screen');
assert.match(world, /One little world\./, 'World should use friendly consumer copy');
assert.match(world, /PlanetStreamGlobe/, 'World must use the interactive globe');
assert.match(world, /simpleMode/, 'World globe must use the condensed controls');
assert.match(world, /GeoReferenceModel/, 'tapping a shared building must open a 3D model');
assert.match(world, /MODEL ONLY/, 'World must distinguish a public model from verified rights');
assert.match(world, /A visible voxel property or NFT does not by itself prove deed\/title/, 'World must keep public model and legal ownership separate');

assert.match(globe, /community-property/, 'globe renderer must recognize shared community properties');
assert.match(globe, /BoxGeometry/, 'community property markers must include a voxel building body');
assert.match(globe, /ConeGeometry/, 'community property markers must include a simple roof');
assert.match(globe, /PUBLIC 3D PROPERTY WORLD/, 'simple globe mode must use consumer-facing copy');

assert.match(productMap, /SIMPLE_PROPERTY_DOCK/, 'simple property routes must have their own dock');
assert.match(productMap, /label: 'Home'/, 'simple dock must include Home');
assert.match(productMap, /label: 'Add'/, 'simple dock must include Add');
assert.match(productMap, /label: 'Vault'/, 'simple dock must include Vault');
assert.match(productMap, /label: 'World'/, 'simple dock must include World');
assert.match(productMap, /isSimplePropertyRoute/, 'simple consumer routes must be explicitly classified');
assert.match(dock, /simple \? SIMPLE_PROPERTY_DOCK : APP_DOCK/, 'consumer routes must render the four-item dock instead of the legacy five-product dock');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search must disappear from Home/Add/Vault/World');

console.log('VoxelPop-simple property flow checks passed: one address, warm maker UI, exact-match gated piece/whole purchase, verify-before-mint, simple Vault, opt-in public World, privacy-rounded geography, voxel-house globe markers, and a four-button iPhone dock.');
