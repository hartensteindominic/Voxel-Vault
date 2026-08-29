import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/page.js');
const generationCheckout = read('app/api/property-generation/checkout/route.ts');
const payment = read('lib/property-generation-payment.ts');
const browserStore = read('lib/property-generation-browser-store.js');
const collectibleCheckout = read('app/api/property-collectible/checkout/route.ts');
const collectibleCommerce = read('lib/property-collectible-commerce.ts');

assert.match(property, /CREATION_PRICE_LABEL = '\$4\.99'/, 'normal property creation must keep the $4.99 create price');
assert.match(property, /Pay \$\{CREATION_PRICE_LABEL\} → create VoxelPop/, 'maker must disclose payment before creation');
assert.match(property, /\/api\/property-generation\/checkout/, 'photo approval must invoke the creation checkout');
assert.match(property, /savePaidPropertyPhoto/, 'photo must stay on-device while the user is at Stripe');
assert.match(property, /loadPaidPropertyPhoto/, 'paid return must restore the on-device photo');
assert.match(property, /zero Meshy credits|0 Meshy credits/i, 'creation must remain zero-credit despite the payment gate');
assert.doesNotMatch(property, /fetch\('\/api\/property-photo-upload'/, 'creation payment must not lead to Meshy source upload');
assert.doesNotMatch(property, /fetch\('\/api\/property-voxel-3d'|fetch\('\/api\/property-voxel-image'/, 'paid creation must not call paid Meshy generation routes');

assert.match(payment, /PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499/, 'server-authoritative VoxelPop creation price must be $4.99');
assert.match(payment, /PROPERTY_VOXEL_GENERATION_KIND = 'property_voxel_generation_v1'/, 'creation checkout must retain the existing product rail');
assert.match(payment, /session\.payment_status !== 'paid'/, 'creation unlock must require a paid Stripe session');
assert.match(payment, /session\.client_reference_id !== auth\.user\.id/, 'paid creation must remain bound to the signed-in buyer');
assert.match(payment, /metadata\.voxelpop_user_id !== auth\.user\.id/, 'Stripe metadata must independently bind payment to the account');
assert.match(payment, /Number\(session\.amount_total \|\| 0\) !== PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'server must verify the exact paid amount');
assert.doesNotMatch(payment, /storage\.|createBucket|voxel-system|stagePaidPropertyPhoto|loadPaidPropertyGenerationPhoto|MESHY/i, 'payment helper must never depend on private source storage or Meshy');

assert.match(generationCheckout, /requireVoxelVaultUser/, 'checkout must require a signed-in account');
assert.match(generationCheckout, /stripe\.checkout\.sessions\.create/, 'creation gate must use server-created Stripe Checkout');
assert.match(generationCheckout, /unit_amount: PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'client cannot choose the generation price');
assert.match(generationCheckout, /creation_engine: 'on_device_voxel_plus_source_backed_3d_map'/, 'Stripe must record the truthful zero-credit creation engine');
assert.match(generationCheckout, /source_photo_storage: 'device_only_not_uploaded_for_creation'/, 'Stripe must record that the source photo stays on-device');
assert.match(generationCheckout, /meshy_credits: '0'/, 'Stripe metadata must explicitly record zero Meshy credits');
assert.match(generationCheckout, /paidPropertyGenerationReceipt/, 'success return must re-verify Stripe server-side');
assert.doesNotMatch(generationCheckout, /readMeshyCreditBalance|MESHY_PROPERTY_CREDITS|MESHY_API_KEY|storage\.|createBucket|voxel-system|stagePaidPropertyPhoto/, 'creation checkout must not touch Meshy or private source storage');
assert.doesNotMatch(generationCheckout, /Private VoxelPop checkout storage could not be prepared/, 'the old checkout-storage failure must be unreachable');

assert.match(browserStore, /indexedDB/, 'source photo must remain on the customer device through Stripe');
assert.match(browserStore, /MAX_AGE_MS = 24 \* 60 \* 60 \* 1000/, 'temporary on-device checkout photo must expire');

assert.match(collectibleCheckout, /stripe\.checkout\.sessions\.create/, 'optional final Collect remains a separate real server-created Stripe checkout');
assert.match(collectibleCheckout, /unit_amount: quote\.priceCents/, 'optional collectible price remains server-authoritative');
assert.match(collectibleCheckout, /source-backed mapped 3D geometry/, 'collectible Stripe copy must accurately describe the map-backed asset');
assert.match(collectibleCheckout, /rights: 'digital_only_no_real_property_rights'/, 'collection payment must preserve the digital-only rights boundary');
assert.match(collectibleCheckout, /minting: 'optional_after_purchase_and_property_verification'/, 'minting stays optional and downstream of verification');

for (const cents of ['199', '299', '399']) assert.match(collectibleCommerce, new RegExp(`priceCents: ${cents}`), 'optional collectible pricing should remain in the $1.99-$3.99 sandbox range');
assert.match(collectibleCommerce, /mapBacked: true/, 'optional checkout may securely collect the map-backed asset without a GLB');

console.log('Paid zero-credit creation regression passed: $4.99 is required for the on-device VoxelPop + source-backed 3D map creation, the source photo never enters checkout storage, Meshy usage stays at zero, and optional later digital collection remains legally separate from real property.');
