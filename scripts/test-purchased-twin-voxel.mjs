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

assert.match(more, /Keep VoxelPop simple\./, 'More must explain that optional tools stay secondary to the core product.');
assert.match(more, /The main product is Create → 3D voxel photo → movable voxel → Vault/, 'More must preserve the actual VoxelPop creation order.');
assert.match(more, /Create VoxelPop · \$4\.99 →/, 'More must route directly back to the paid VoxelPop creator.');
assert.match(more, /See free sample →/, 'More must keep the no-login product sample easy to reach.');
assert.match(more, /Purchased twins/, 'More must expose purchased twins without turning the page into a giant directory.');
assert.match(more, /OWNER \/ PROVIDER TOOLS/, 'Owner/provider systems must remain separated from the normal customer path.');
assert.match(more, /not part of the \$4\.99 VoxelPop product/i, 'Regulated/provider tools must remain distinct from the VoxelPop creation purchase.');
assert.doesNotMatch(more, /APP_SECTIONS/, 'More must not dump the full internal product map into the customer UI.');

assert.match(mineApi, /propertyDraftItemId\(user\.id, `estate-\$\{estate\.id\}`, 'voxel'\)/, 'Purchased-twin lookup must use the account-bound stable estate voxel item ID.');
assert.match(mineApi, /readCatalog3D/, 'Purchase restore must detect an already-built voxel from the account catalog.');
assert.match(mineApi, /voxelIncluded:\s*true/, 'Eligible purchased Digital Twins must explicitly include the custom voxel path.');
assert.match(mineApi, /voxelReady/, 'Purchase response must expose whether the voxel already exists.');

assert.match(maker, /\/api\/digital-estates\/mine/, 'The maker must verify the signed-in account actually owns the Digital Twin.');
assert.match(maker, /This Digital Twin is not a paid purchase on the signed-in account/, 'Unowned catalog items must fail closed.');
assert.match(maker, /No second \$4\.99 VoxelPop creation charge/, 'A verified purchase must not be charged the normal property creation fee again.');
assert.match(maker, /\['SOURCE', '3D VOXEL PHOTO', 'VOXEL', 'MINT'\]/, 'Purchased-twin maker must use the same 3D voxel photo terminology as the core creator.');
assert.match(maker, /Use the twin I bought → 3D voxel photo/, 'The purchased digital design itself must be usable as a voxel-photo source.');
assert.match(maker, /Use my property photo instead/, 'The buyer may optionally use an authorized real photo for a more personal visual match.');
assert.match(maker, /Use this photo → 3D voxel photo/, 'An authorized property photo must enter the same voxel-photo review stage.');
assert.match(maker, /See the 3D voxel photo first and compare it with the source/, 'Purchased flow must require visual review before the movable voxel starts.');
assert.match(maker, /Looks right → Build my movable 3D voxel/, 'Purchased flow must require explicit approval before building the movable voxel.');
assert.match(maker, /PhotoReliefModelViewer/, 'The purchased flow must use the real 3D voxel photo viewer before voxelization.');
assert.match(maker, /LocalVoxelModelViewer/, 'The purchased flow must build the separate movable voxel model.');
assert.match(maker, /SavedVoxelModelViewer/, 'Reopening a finished purchase must show the exact saved voxel rather than a recreated placeholder.');
assert.match(savedViewer, /GLTFLoader/, 'The exact saved purchased-twin voxel must reopen from its durable glTF URL.');
assert.match(maker, /\/api\/property-local-voxel/, 'The resulting voxel must be account-bound through the existing local voxel registration rail.');
assert.match(maker, /\/property\/mint\?draftId=/, 'The finished purchased-twin voxel must lead to the digital voxel mint path.');
assert.match(maker, /Minting is optional/, 'Purchased-twin minting must remain optional.');
assert.doesNotMatch(maker, /\/api\/property-generation\/checkout|\/api\/property-voxel-3d|\/api\/property-voxel-image/, 'Purchased-twin voxel creation must not open a second checkout or metered property generation route.');
assert.doesNotMatch(maker, /3D picture|3D PREVIEW/, 'Purchased-twin maker must not regress to ambiguous legacy preview language.');

console.log('Purchased Digital Twin flow passed: simple Vault/More -> account-verified purchase -> included 3D voxel photo -> explicit approval -> movable local voxel -> exact saved reopen -> optional mint.');
