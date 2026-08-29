import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const property = read('app/property/page.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const photoHandoff = read('app/api/property-photo-upload/route.ts');
const payment = read('lib/property-generation-payment.ts');

assert.match(payment, /PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499/, 'server-authoritative enhanced VoxelPop creation price must remain $4.99');
assert.match(payment, /PROPERTY_VOXEL_GENERATION_KIND = 'property_voxel_generation_v1'/, 'paid property creation must keep its own Stripe product rail');
assert.match(payment, /session\.payment_status !== 'paid'/, 'paid Meshy generation unlock must require a paid Stripe session');
assert.match(payment, /session\.client_reference_id !== auth\.user\.id/, 'paid generation must remain bound to the signed-in buyer');
assert.match(payment, /metadata\.voxelpop_user_id !== auth\.user\.id/, 'Stripe metadata must independently bind the payment to the account');
assert.match(payment, /Number\(session\.amount_total \|\| 0\) !== PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the server must verify the exact paid amount');
assert.match(payment, /source_sha256/, 'the staged source must be cryptographically bound to the checkout');
assert.match(payment, /digest !== receipt\.digest/, 'source bytes must be re-verified after returning from Stripe');
assert.match(payment, /function bucketMissing\(error/, 'checkout staging must distinguish a genuinely missing storage bucket from unrelated storage errors');
assert.match(payment, /let uploaded = await admin\.storage\.from\(BUCKET\)\.upload/, 'checkout staging must try the existing private bucket directly before management operations');
assert.match(payment, /if \(!bucketMissing\(uploaded\.error\)\)/, 'bucket creation must not run for ordinary upload failures');
assert.match(payment, /await ensureBucket\(admin\)/, 'a genuinely missing private bucket must retain a one-time recovery path');
assert.doesNotMatch(payment, /storage\.listBuckets\(\)/, 'checkout must not fail just because runtime bucket listing is unavailable');
assert.doesNotMatch(payment, /Private VoxelPop checkout storage could not be prepared/i, 'the old misleading checkout-storage failure must stay removed');

assert.match(checkout, /requireVoxelVaultUser/, 'enhanced checkout must require a signed-in Voxel Vault account');
assert.match(checkout, /MESHY_PROPERTY_CREDITS\.fullPipeline/, 'paid provider capacity must be checked before charging');
assert.match(checkout, /readMeshyCreditBalance\(apiKey\)/, 'paid checkout must read the live Meshy service-credit balance before Stripe');
assert.match(checkout, /stagePaidPropertyPhoto/, 'the authorized source photo must be staged privately across paid Stripe checkout');
assert.match(checkout, /stripe\.checkout\.sessions\.create/, 'the enhanced generation paywall must use server-created Stripe Checkout');
assert.match(checkout, /unit_amount: PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the client cannot choose the enhanced generation price');
assert.match(checkout, /VoxelPop 3D Voxel Creation/, 'Stripe must identify exactly what the enhanced purchase is');
assert.match(checkout, /Digital creation only; no rights in physical real estate/, 'checkout copy must preserve the real-property boundary');
assert.match(checkout, /generation_session=\{CHECKOUT_SESSION_ID\}/, 'successful paid generation must return through the resume path');
assert.match(checkout, /generation_checkout=cancelled/, 'canceled enhanced checkout must return without starting generation');
assert.match(checkout, /deleteStagedPropertyPhoto/, 'canceled or failed paid checkout staging must have cleanup support');

assert.match(photoHandoff, /if \(!generationSessionId\)/, 'direct Meshy source generation must reject calls without a payment session');
assert.match(photoHandoff, /paymentRequired: true/, 'unpaid direct Meshy calls must expose an explicit payment-required response');
assert.match(photoHandoff, /status: 402/, 'unpaid direct Meshy source-generation calls must fail closed');
assert.match(photoHandoff, /paidPropertyGenerationReceipt\(auth, stripe, generationSessionId\)/, 'the paid Stripe receipt must be verified before any Meshy task starts');
assert.match(photoHandoff, /readCatalog3D\(itemId\)/, 'Stripe-return refreshes must check for an existing generation before spending credits again');
assert.match(photoHandoff, /existing\?\.source_image_url === sourceFingerprint/, 'idempotency must be tied to the exact paid source photo');
assert.match(photoHandoff, /deleteStagedPropertyPhoto\(auth, draftId\)/, 'the private checkout source must be removed after provider handoff');

assert.match(property, /CREATION_PRICE_LABEL = '\$4\.99'/, 'the maker must still disclose the optional enhanced $4.99 price');
assert.match(property, /\/api\/property-generation\/checkout/, 'the optional enhanced path must continue through paid generation checkout instead of calling Meshy directly');
assert.match(property, /Enhanced AI 3D/, 'the Meshy-backed purchase must be clearly presented as an optional enhanced path');
assert.match(property, /Preview with map · 0 Meshy credits/, 'the default maker path must offer a no-Meshy alternative before paid generation');
assert.match(property, /generation_session/, 'the maker must resume a successfully paid enhanced creation after Stripe');
assert.match(property, /form\.append\('generationSessionId', generationSessionId\)/, 'Stripe return must pass the verified session into the source-generation gate');
assert.match(property, /generation_checkout.*cancelled/, 'the maker must recognize canceled enhanced checkout');
assert.match(property, /method: 'DELETE'/, 'canceled enhanced checkout must request cleanup of the staged source photo');
assert.match(property, /optional \{CREATION_PRICE_LABEL\} enhanced AI path is separate/, 'UI copy must distinguish the optional paid AI build from the free map path');

console.log('Paid VoxelPop regression passed: the zero-credit map path is primary while optional enhanced Meshy generation keeps private staging, provider-capacity preflight, exact $4.99 Stripe verification, account binding, idempotency, and cleanup.');
