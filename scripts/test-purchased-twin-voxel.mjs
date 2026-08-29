import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const vault = read('app/vault/page.js');
const more = read('app/more/page.js');
const mineApi = read('app/api/digital-estates/mine/route.ts');
const maker = read('app/vault/estates/[estateId]/voxel/page.js');
const savedViewer = read('app/vault/estates/[estateId]/voxel/SavedVoxelModelViewer.js');

assert.match(vault, /MY PURCHASED TWINS/, 'Vault must put purchased Digital Twins in a clear first-class section.');
assert.match(vault, /Create my 3D Voxel · included/, 'A purchased twin must have an obvious included voxel-creation action.');
assert.match(vault, /\/api\/digital-estates\/mine/, 'Vault must restore purchases from the signed-in account rather than browser claims.');
assert.match(vault, /loadAccountPropertyDrafts/, 'Vault must restore account property sources alongside purchases.');
assert.match(vault, /DEMO_PURCHASE_KEY/, 'The latest Vault must keep the $1.99 Test Buy reference visible instead of dropping it.');
assert.match(vault, /TEST BUY · NOT REAL OWNERSHIP/, 'Demo Test Buy must remain explicitly non-ownership.');
assert.match(vault, /Need the other tools\?/, 'Financial, wallet, and legal tools should remain outside the main collection sections.');
assert.doesNotMatch(vault, /UnifiedVaultCanvas|useWalletIdentity|DIRECT PROPERTY.*LOCKED/s, 'The simple Vault home must not lead with the old spatial/wallet/provider dashboard.');

assert.match(more, /main product is Create → 3D voxel photo → movable voxel → Vault/i, 'Extras must reinforce the focused VoxelPop creation journey.');
assert.match(more, /Open Vault →/, 'Extras must keep saved creations and purchased twins reachable through the first-class Vault destination.');
assert.match(more, /3D voxel photo[\s\S]*separate movable model/i, 'Extras must preserve voxel-photo approval before the separate movable model.');
assert.match(more, /World, minting, and the tools below are optional/, 'Extras must keep World and minting outside the required creation funnel.');
assert.match(more, /<details className=\{styles\.advanced\}/, 'Advanced/owner tools must be collapsed away from the normal customer path.');
assert.doesNotMatch(more, /APP_SECTIONS/, 'Extras must not dump the full internal product map into the customer UI.');

assert.match(mineApi, /propertyDraftItemId\(user\.id, `estate-\$\{estate\.id\}`, 'voxel'\)/, 'Purchased-twin lookup must use the account-bound stable estate voxel item ID.');
assert.match(mineApi, /readCatalog3D/, 'Purchase restore must detect an already-built voxel from the account catalog.');
assert.match(mineApi, /voxelIncluded:\s*true/, 'Eligible purchased Digital Twins must explicitly include the custom voxel path.');
assert.match(mineApi, /voxelReady/, 'Purchase response must expose whether the voxel already exists.');

assert.match(maker, /\/api\/digital-estates\/mine/, 'The maker must verify the signed-in account actually owns the Digital Twin.');
assert.match(maker, /This Digital Twin is not a paid purchase on the signed-in account/, 'Unowned catalog items must fail closed.');
assert.match(maker, /No second \$4\.99 VoxelPop creation charge/, 'A verified purchase must not be charged the normal property creation fee again.');
assert.match(maker, /Use the twin I bought → 3D preview/, 'The purchased digital design itself must be usable as a voxel source.');
assert.match(maker, /Use my property photo instead/, 'The buyer may optionally use an authorized real photo for a more personal visual match.');
assert.match(maker, /PhotoReliefModelViewer/, 'The purchased flow must show its recognizable approval preview before voxelization.');
assert.match(maker, /LocalVoxelModelViewer/, 'The purchased flow must build the separate movable voxel model.');
assert.match(maker, /SavedVoxelModelViewer/, 'Reopening a finished purchase must show the exact saved voxel rather than a recreated placeholder.');
assert.match(savedViewer, /GLTFLoader/, 'The exact saved purchased-twin voxel must reopen from its durable glTF URL.');
assert.match(maker, /\/api\/property-local-voxel/, 'The resulting voxel must be account-bound through the existing local voxel registration rail.');
assert.match(maker, /\/property\/mint\?draftId=/, 'The finished purchased-twin voxel must lead to the digital voxel mint path.');
assert.doesNotMatch(maker, /\/api\/property-generation\/checkout|\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'Purchased-twin voxel creation must not open a second checkout or metered property generation route.');

console.log('Purchased Digital Twin checks passed: simple Extras -> Vault -> account-verified purchase -> included recognizable preview -> local voxel -> exact saved reopen -> optional mint.');
