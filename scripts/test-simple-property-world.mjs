import assert from 'node:assert/strict';
import fs from 'node:fs';

const home = fs.readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');
const homeCss = fs.readFileSync(new URL('../app/home.module.css', import.meta.url), 'utf8');
const property = fs.readFileSync(new URL('../app/property/page.js', import.meta.url), 'utf8');
const propertyCss = fs.readFileSync(new URL('../app/property/property.module.css', import.meta.url), 'utf8');
const voxelImageRoute = fs.readFileSync(new URL('../app/api/property-voxel-image/route.ts', import.meta.url), 'utf8');
const voxel3dRoute = fs.readFileSync(new URL('../app/api/property-voxel-3d/route.ts', import.meta.url), 'utf8');
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
assert.doesNotMatch(home, /BUY PIECE|BUY WHOLE|BUY A PIECE|BUY THE WHOLE THING/, 'buying must stay out of the troubleshooting MVP front door');
assert.doesNotMatch(home, /FOUR CORE JOBS|HomeCapabilityStrip|Digital REITs/, 'advanced taxonomy must not clutter home');

for (const source of [homeCss, propertyCss, vault, world]) {
  assert.match(source, /#fffaf0/i, 'simple property surfaces should keep the warm VoxelPop canvas');
}
assert.match(propertyCss, /#f2a11b/i, 'Create image should use the approved warm orange');
assert.match(propertyCss, /#3c948e/i, 'Create 3D should use the approved teal');
assert.match(propertyCss, /#7662b4/i, 'Vault should use the approved purple');
assert.match(propertyCss, /border-radius:38px/, 'property should keep one large rounded visual card');

assert.match(property, /<h1>Property<\/h1>/, 'property maker must use the approved simple title');
assert.match(property, /Create image/, 'property maker must expose Create image');
assert.match(property, /Create 3D/, 'property maker must expose Create 3D');
assert.match(property, /'Vault'/, 'property maker must expose Vault');
assert.match(property, /Mint later/, 'property maker must expose Mint later');
assert.match(property, /\/api\/world-atlas\/open-imagery/, 'property maker must load rights-cleared street imagery');
assert.match(property, /\/api\/property-voxel-image/, 'Create image must use the property voxel-image route');
assert.match(property, /\/api\/property-voxel-3d/, 'Create 3D must use the generated-image 3D route');
assert.match(property, /MeshyModelViewer/, 'completed 3D must open in the interactive model viewer');
assert.match(property, /references:\s*\[activeReference\]/, 'image generation must use the user-selected facade reference, not an uncontrolled neighborhood batch');
assert.match(property, /No facade invented\./, 'missing photo evidence must fail closed visually');
assert.match(property, /The photo guides appearance\. Map data guides location\./, 'UI must explain the split between visual and geographic truth');
assert.doesNotMatch(property, /GeoReferenceModel/, 'simple maker must not substitute a generic map extrusion for the photo-guided property');
assert.doesNotMatch(property, /BUY A PIECE|BUY THE WHOLE THING|buyPortion|buyWhole/, 'buying must be absent from the troubleshooting property maker');
assert.doesNotMatch(property, /mintVoxelFlip|eth_requestAccounts/, 'simple maker must not mint or request a wallet directly');

assert.match(voxelImageRoute, /requireVoxelVaultAdmin/, 'paid image generation must remain owner-gated during troubleshooting');
assert.match(voxelImageRoute, /open-licensed/, 'voxel image route must require explicit reference rights');
assert.match(voxelImageRoute, /zillow\.com/, 'restricted listing-image hosts must remain blocked from derivative generation');
assert.match(voxelImageRoute, /Preserve the visible building identity/, 'image prompt must preserve the actual photographed architecture');
assert.match(voxelImageRoute, /Do not redesign, beautify, modernize, add floors, remove floors, invent windows, move doors, change the roof type, or substitute a generic house\./, 'image prompt must explicitly block generic-house drift');

assert.match(voxel3dRoute, /requireVoxelVaultAdmin/, 'paid 3D generation must remain owner-gated during troubleshooting');
assert.match(voxel3dRoute, /image-to-3d/, '3D must be created from the approved voxel image');
assert.match(voxel3dRoute, /property-voxel:/, 'property 3D models must be cached per mapped property');
assert.match(voxel3dRoute, /persistModelBinary/, 'completed GLBs must be persisted instead of relying only on provider URLs');

assert.match(openImagery, /selectionStrategy:\s*'newest-nearby-first'/, 'open imagery must expose newest-nearby-first selection');
assert.match(openImagery, /primaryPhoto:\s*photos\[0\]/, 'newest nearby image must be the primary property reference');

assert.match(vault, /Your properties\./, 'Vault should stay consumer-simple');
assert.match(vault, /OPEN 3D/, 'Vault should make opening a property the primary action');
assert.match(vault, /VERIFY \+ MINT/, 'Vault must keep verification ahead of minting');
assert.match(drafts, /world:\s*\{\s*public:\s*false/, 'all new drafts must start private');

assert.match(worldApi, /draft\?\.world\?\.public !== true/, 'public feed must exclude drafts not explicitly shared');
assert.match(worldApi, /toFixed\(3\)/, 'public coordinates must be rounded before publication');
assert.doesNotMatch(worldApi, /draft\.label/, 'public feed must not expose the private saved address label by default');
assert.match(world, /PUBLIC 3D WORLD/, 'World must remain available as a separate simple screen');
assert.match(world, /PlanetStreamGlobe/, 'World must use the interactive globe');
assert.match(globe, /community-property/, 'globe renderer must recognize shared community properties');

assert.match(dock, /if \(pathname === '\/property'\) return null;/, 'the bare maker must not be duplicated by a fixed app dock');
assert.match(command, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search must stay hidden on simple consumer routes');

console.log('Bare VoxelPop property flow checks passed: real address -> newest selectable open photo -> faithful voxel image -> image-driven 3D -> Vault -> mint later, with no consumer buying clutter and no generic map-extrusion facade.');
