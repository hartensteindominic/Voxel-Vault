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

assert.match(more, /The main product is Create → 3D voxel photo → movable voxel → Vault\./, 'More must reinforce the current VoxelPop creation journey.');
assert.match(more, /Bought or saved a property\?/, 'More must keep the reusable purchased/saved property workflow.');
assert.match(more, /Open My Vault/, 'More must keep Vault as the single destination for purchased Digital Twins and saved voxels.');
assert.match(more, /review the <b>3D voxel photo<\/b> before the separate movable model is built/, 'More must preserve voxel-photo-before-movable-voxel ordering.');
assert.match(more, /<details className=\{styles\.advanced\}/, 'Advanced/owner tools must be collapsed away from the normal customer path.');
assert.doesNotMatch(more, /APP_SECTIONS/, 'More must not dump the full internal product map into the customer UI.');

assert.match(mineApi, /propertyDraftItemId\(user\.id, `estate-\$\{estate\.id\}`, 'voxel'\)/, 'Purchased-twin lookup must use the account-bound stable estate voxel item ID.');
assert.match(mineApi, /readCatalog3D/, 'Purchase restore must detect an already-built voxel from the account catalog.');
assert.match(mineApi, /voxelIncluded:\s*true/, 'Eligible purchased Digital Twins must explicitly include the custom voxel path.');
assert.match(mineApi, /voxelReady/, 'Purchase response must expose whether the voxel already exists.');

assert.match(maker, /\/api\/digital-estates\/mine/, 'The maker must verify the signed-in account actually owns the Digital Twin.');
assert.match(maker, /This Digital Twin is not a paid purchase on the signed-in account/, 'Unowned catalog items must fail closed.');
assert.match(maker, /No second \$4\.99 VoxelPop creation charge/, 'A verified purchase must not be charged the normal property creation fee again.');
assert.match(maker, /Use the twin I bought → Voxel photo/, 'The purchased digital design itself must be usable as a voxel-photo source.');
assert.match(maker, /Use my property photo instead/, 'The buyer may optionally use an authorized real photo for a more personal visual match.');
assert.match(maker, /See the 3D voxel photo first\. The movable voxel does not start until you approve this review\./, 'The purchased flow must keep review-before-model ordering explicit.');
assert.match(maker, /Looks right → Build movable 3D voxel/, 'The buyer must approve the voxel photo before the separate movable model is built.');
assert.match(maker, /PhotoReliefModelViewer/, 'The purchased flow must use the production 3D voxel-photo reviewer.');
assert.match(maker, /LocalVoxelModelViewer/, 'The purchased flow must build the separate movable voxel model.');
assert.match(maker, /BUILDING MOVABLE 3D VOXEL/, 'The model-building stage must be clearly distinct from the voxel-photo review.');
assert.match(maker, /SavedVoxelModelViewer/, 'Reopening a finished purchase must show the exact saved voxel rather than a recreated placeholder.');
assert.match(maker, /EXACT SAVED MOVABLE 3D VOXEL/, 'The final purchased-twin stage must identify the durable movable model.');
assert.match(savedViewer, /GLTFLoader/, 'The exact saved purchased-twin voxel must reopen from its durable glTF URL.');
assert.match(maker, /\/api\/property-local-voxel/, 'The resulting voxel must be account-bound through the existing local voxel registration rail.');
assert.match(maker, /\/property\/mint\?draftId=/, 'The finished purchased-twin voxel must lead to the digital voxel mint path.');
assert.match(maker, /Minting is optional/, 'The purchased-twin maker must keep minting optional after saving.');
assert.doesNotMatch(maker, /\/api\/property-generation\/checkout|\/api\/property-voxel-3d|\/api\/property-voxel-image|Make 3D Picture|3D PICTURE/, 'Purchased-twin voxel creation must not open a second checkout, metered generation route, or retired 3D-picture flow.');

console.log('Purchased Digital Twin flow passed: simple Vault/More -> account-verified purchase -> included 3D voxel-photo review -> explicit approval -> movable local voxel -> exact saved reopen -> optional mint.');