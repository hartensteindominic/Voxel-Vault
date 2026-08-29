import assert from 'node:assert/strict';
import fs from 'node:fs';

const mine = fs.readFileSync(new URL('../app/vault/estates/mine/page.js', import.meta.url), 'utf8');
const voxel = fs.readFileSync(new URL('../app/vault/estates/mine/[estateId]/voxel/page.js', import.meta.url), 'utf8');
const viewer = fs.readFileSync(new URL('../app/vault/estates/mine/PurchasedEstateVoxelViewer.js', import.meta.url), 'utf8');
const vault = fs.readFileSync(new URL('../app/vault/page.js', import.meta.url), 'utf8');
const more = fs.readFileSync(new URL('../app/more/page.js', import.meta.url), 'utf8');
const productMap = fs.readFileSync(new URL('../lib/product-map.js', import.meta.url), 'utf8');
const account = fs.readFileSync(new URL('../lib/voxelpop-account.ts', import.meta.url), 'utf8');

assert.match(mine, /CREATE MY 3D VOXEL/, 'A secured purchased Digital Estate must expose an obvious voxel creation action.');
assert.match(mine, /\/vault\/estates\/mine\/\$\{encodeURIComponent\(item\.estate\.id\)\}\/voxel/, 'Each bought-property CTA must target that exact purchased estate.');
assert.match(mine, /no second creation charge/i, 'The purchased-to-voxel path must not imply another creation payment.');
assert.match(mine, /CONNECT WALLET \+ MINT · ENCOURAGED/, 'Optional minting must remain available after the new voxel action.');

assert.match(voxel, /fetch\('\/api\/digital-estates\/mine'/, 'Voxel creation must verify ownership through the signed-in My Digital Twins API.');
assert.match(voxel, /item\?\.estate\?\.id === estateId/, 'The builder must select only the exact estate owned by this account.');
assert.match(voxel, /does not have a secured purchase/, 'Unowned estate routes must fail closed.');
assert.match(voxel, /PurchasedEstateVoxelViewer/, 'The purchased design must render as an interactive 3D voxel before saving.');
assert.match(voxel, /window\.localStorage\.setItem\(`voxelpop:\$\{sessionId\}`/, 'The created voxel must join the normal local VoxelPop Creator Gallery.');
assert.match(voxel, /saveVoxelToAccount/, 'The created voxel must also use the existing signed-in Creator Gallery sync path.');
assert.match(voxel, /kind: 'digital-estate-purchase'/, 'Creator Gallery records must retain their purchased-estate provenance.');
assert.match(voxel, /no second creation payment/i, 'Owned-estate voxel creation must explicitly be included with the secured purchase.');
assert.doesNotMatch(voxel, /digital-estates\/checkout|property-generation\/checkout|mintVoxelFlip/, 'Opening or saving a purchased-estate voxel must never trigger checkout or minting.');

assert.match(viewer, /import\('three'\)/, 'Purchased-estate voxel creation must use the local Three.js renderer.');
assert.match(viewer, /architecture/, 'The voxel recipe must derive from the purchased design architecture.');
assert.match(viewer, /floors/, 'The voxel recipe must retain the purchased design floor count.');
for (const architecture of ['courtyard', 'glass', 'waterfront', 'villa', 'sky-villa']) {
  assert.match(viewer, new RegExp(`architecture === '${architecture}'`), `The renderer must support the ${architecture} purchased design.`);
}
assert.match(viewer, /pointerdown/);
assert.match(viewer, /pointermove/);
assert.match(viewer, /toDataURL\('image\/jpeg'/, 'The actual rendered voxel should provide the Creator Gallery thumbnail.');

assert.match(account, /source\?: \{[\s\S]*referenceId\?: string;[\s\S]*href\?: string;/, 'VoxelPop account records must preserve source provenance and a safe reopen link.');
assert.match(account, /source: normalized\.payload\.source \|\| null/, 'Summarized Creator Gallery items must expose provenance to the Vault UI.');

assert.match(vault, /01 · BOUGHT PROPERTIES/, 'Vault must lead with purchases instead of technical provider wings.');
assert.match(vault, /Create my 3D voxel →/, 'Vault purchased cards must continue directly into voxel creation.');
assert.match(vault, /voxel\.source\?\.href/, 'Creator Gallery must reopen a purchased-estate voxel in its dedicated 3D builder instead of a pack success route.');
assert.match(vault, /Money \+ legal property are advanced, not the main Vault/, 'Finance and legal-property tools must remain available without dominating the consumer Vault.');

assert.match(productMap, /id: 'bought-estates'/, 'More/product navigation must expose Bought Properties as a first-class creative path.');
assert.match(productMap, /create its interactive 3D voxel/, 'Product navigation must explain the purchased-to-voxel continuation.');
assert.match(more, /MORE · WITHOUT THE MESS/, 'More must use the simplified VoxelPop organization.');
assert.match(more, /The useful stuff first/, 'More must put everyday actions before advanced/provider tools.');

console.log('Purchased Digital Estate -> verified interactive 3D voxel -> Creator Gallery flow checks passed; no second checkout or automatic mint is introduced.');
