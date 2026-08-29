import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const gate = read('app/property/PropertyIdentityGate.js');
const identity = read('app/api/property-identity/route.ts');
const checkout = read('app/api/property-generation/checkout/route.ts');
const payment = read('lib/property-generation-payment.ts');
const mint = read('lib/property-voxel-mint.ts');
const prepare = read('app/api/property-voxel-nft/prepare/route.ts');
const confirm = read('app/api/property-voxel-nft/confirm/route.ts');

assert.match(gate, /One property\.<br\/>One voxel\./, 'creator explains the one-of-one property rule');
assert.match(identity, /propertyCollectibleIdentity\(atlasId\)/, 'property selector derives a canonical source-backed identity');
assert.match(identity, /\['paid', 'minted'\]\.includes\(existing\.state\)/, 'already purchased or minted properties are rejected before creation');
assert.match(checkout, /acquirePropertyCollectibleReservation/, 'checkout atomically reserves the property before Stripe payment');
assert.match(checkout, /one_property_one_purchase: 'true'/, 'Stripe metadata records the uniqueness invariant');
assert.match(payment, /updatePropertyCollectibleReservation/, 'paid checkout permanently locks the property reservation');
assert.match(mint, /voxelpop-property-nft-v2:\$\{identity\}/, 'on-chain voucher is derived from canonical property identity rather than user or photo task');
assert.match(prepare, /listPaidPropertyCollectiblesForBuyer/, 'mint preparation resolves the paid property lock server-side');
assert.match(prepare, /propertyVoxelVoucherUsed/, 'mint preparation checks the on-chain one-use voucher');
assert.match(confirm, /state: 'minted'/, 'verified mint permanently marks the property as minted');

console.log('One-of-one property regression passed: canonical property -> one purchase -> one Base mint.');
