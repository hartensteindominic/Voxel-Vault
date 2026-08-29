import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/HouseVoxelMintFlow.js');
const confirmAddress = read('app/api/property-generation/confirm/route.ts');
const finalize = read('app/api/property-generation/finalize/route.ts');
const mint = read('lib/property-voxel-mint.ts');
const prepare = read('app/api/property-voxel-nft/prepare/route.ts');
const confirmMint = read('app/api/property-voxel-nft/confirm/route.ts');
const mintState = read('lib/property-collectible-mint-state.ts');

assert.match(property, /Confirm the address\./, 'live creator confirms the property identity before generation');
assert.match(confirmAddress, /propertyCollectibleIdentity\(atlasId\)/, 'address confirmation derives a canonical source-backed identity');
assert.match(confirmAddress, /acquirePropertyCollectibleReservation/, 'address confirmation atomically reserves the property before voxel generation');
assert.match(confirmAddress, /hold\.sold/, 'already completed or minted properties are rejected before creation');
assert.match(finalize, /state: 'paid'/, 'a completed 3D voxel promotes the temporary property hold to the permanent pre-mint state');
assert.match(mint, /voxelpop-property-nft-v2:\$\{identity\}/, 'on-chain voucher is derived from canonical property identity rather than user or photo task');
assert.match(prepare, /listPaidPropertyCollectiblesForBuyer/, 'mint preparation resolves the permanent property lock server-side');
assert.match(prepare, /propertyVoxelVoucherUsed/, 'mint preparation checks the on-chain one-use voucher');
assert.match(confirmMint, /markPropertyCollectibleMinted/, 'verified Base mint records the property as minted');
assert.match(mintState, /state: 'minted'/, 'mint state transition persists the permanent minted state');
assert.match(mintState, /current\.state !== 'paid'/, 'only the valid permanent pre-mint state can transition to minted');

console.log('One-of-one property regression passed: confirmed address -> one finished voxel -> one Base mint.');
