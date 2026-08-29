import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/page.js');
const legacyCheckout = read('app/api/property-generation/checkout/route.ts');
const collectibleCheckout = read('app/api/property-collectible/checkout/route.ts');
const collectibleCommerce = read('lib/property-collectible-commerce.ts');

assert.doesNotMatch(property, /CREATION_PRICE_LABEL|Pay \$4\.99|Opening \$4\.99 checkout/, 'normal property creation must not carry the old $4.99 generation paywall');
assert.doesNotMatch(property, /\/api\/property-generation\/checkout/, 'photo approval must not invoke pre-generation checkout');
assert.match(property, /Preview is made on this device · no Meshy credits · no generation checkout\./, 'maker must plainly describe the free local creation step');
assert.match(property, /Creation itself does not require Meshy credits or a pre-generation payment\./, 'collection screen must keep generation and optional purchase separate');

assert.match(legacyCheckout, /requireVoxelVaultUser/, 'legacy endpoint remains account gated while stale clients phase out');
assert.match(legacyCheckout, /migrated: true/, 'legacy endpoint must explicitly signal the retired flow');
assert.match(legacyCheckout, /Refresh the Property maker/, 'stale clients should get a useful recovery action');
assert.doesNotMatch(legacyCheckout, /stagePaidPropertyPhoto/, 'legacy endpoint must never stage a private photo');
assert.doesNotMatch(legacyCheckout, /storage\.|createBucket|voxel-system/, 'legacy endpoint must not touch private checkout storage');
assert.doesNotMatch(legacyCheckout, /readMeshyCreditBalance|MESHY_PROPERTY_CREDITS|MESHY_API_KEY/, 'legacy endpoint must not depend on Meshy capacity');
assert.doesNotMatch(legacyCheckout, /stripe\.checkout\.sessions\.create/, 'legacy endpoint must not charge for generation');
assert.doesNotMatch(legacyCheckout, /Private VoxelPop checkout storage could not be prepared/, 'the exact private-storage failure must be unreachable from the retired checkout');

assert.match(collectibleCheckout, /stripe\.checkout\.sessions\.create/, 'optional final Collect remains a real server-created Stripe checkout');
assert.match(collectibleCheckout, /unit_amount: quote\.priceCents/, 'optional collectible price remains server-authoritative');
assert.match(collectibleCheckout, /source-backed mapped 3D geometry/, 'Stripe must accurately describe a map-backed digital collectible');
assert.match(collectibleCheckout, /rights: 'digital_only_no_real_property_rights'/, 'collection payment must preserve the digital-only rights boundary');
assert.match(collectibleCheckout, /minting: 'optional_after_purchase_and_property_verification'/, 'minting stays optional and downstream of verification');

for (const cents of ['199', '299', '399']) assert.match(collectibleCommerce, new RegExp(`priceCents: ${cents}`), 'optional collectible pricing should remain in the $1.99-$3.99 sandbox range');
assert.match(collectibleCommerce, /mapBacked: true/, 'optional checkout may securely collect the map-backed asset without a GLB');

console.log('VoxelPop generation-paywall retirement regression passed: creation uses no Meshy credits or private checkout staging, while optional end-of-flow digital collection remains server-authoritative and legally separate from real property.');
