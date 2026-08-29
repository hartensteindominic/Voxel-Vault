import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const property = read('app/property/page.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const photoHandoff = read('app/api/property-photo-upload/route.ts');
const payment = read('lib/property-generation-payment.ts');

assert.match(payment, /PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499/, 'server-authoritative VoxelPop creation price must be $4.99');
assert.match(payment, /PROPERTY_VOXEL_GENERATION_KIND = 'property_voxel_generation_v1'/, 'paid property creation must have its own Stripe product rail');
assert.match(payment, /session\.payment_status !== 'paid'/, 'generation unlock must require a paid Stripe session');
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
assert.match(payment, /getSupabaseAdminCandidates/, 'checkout staging should reuse every configured server credential rather than trusting only the auth credential');
assert.match(payment, /for \(const admin of storageClients\(auth\)\)/, 'private checkout upload, read, and cleanup paths must be able to fall through to another server credential');
assert.match(payment, /No payment was started/, 'storage failure must make clear that Stripe was never opened');

assert.match(checkout, /requireVoxelVaultUser/, 'checkout must require a signed-in Voxel Vault account');
assert.match(checkout, /MESHY_PROPERTY_CREDITS\.fullPipeline/, 'provider capacity must be checked before charging');
assert.match(checkout, /readMeshyCreditBalance\(apiKey\)/, 'checkout must read the live Meshy service-credit balance before Stripe');
assert.match(checkout, /stagePaidPropertyPhoto/, 'the authorized source photo must be staged privately across Stripe checkout');
assert.match(checkout, /stripe\.checkout\.sessions\.create/, 'the generation paywall must use server-created Stripe Checkout');
assert.match(checkout, /unit_amount: PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the client cannot choose the generation price');
assert.match(checkout, /VoxelPop 3D Voxel Creation/, 'Stripe must identify exactly what is being purchased');
assert.match(checkout, /Digital creation only; no rights in physical real estate/, 'checkout copy must preserve the real-property boundary');
assert.match(checkout, /generation_session=\{CHECKOUT_SESSION_ID\}/, 'successful payment must return through the paid generation resume path');
assert.match(checkout, /generation_checkout=cancelled/, 'canceled checkout must return without starting generation');
assert.match(checkout, /deleteStagedPropertyPhoto/, 'canceled or failed checkout staging must have cleanup support');

assert.match(photoHandoff, /if \(!generationSessionId\)/, 'direct source generation must reject calls without a payment session');
assert.match(photoHandoff, /paymentRequired: true/, 'unpaid direct calls must expose an explicit payment-required response');
assert.match(photoHandoff, /status: 402/, 'unpaid source-generation calls must fail closed');
assert.match(photoHandoff, /paidPropertyGenerationReceipt\(auth, stripe, generationSessionId\)/, 'the paid Stripe receipt must be verified before any Meshy task starts');
assert.match(photoHandoff, /readCatalog3D\(itemId\)/, 'Stripe-return refreshes must check for an existing generation before spending credits again');
assert.match(photoHandoff, /existing\?\.source_image_url === sourceFingerprint/, 'idempotency must be tied to the exact paid source photo');
assert.match(photoHandoff, /deleteStagedPropertyPhoto\(auth, draftId\)/, 'the private checkout source must be removed after provider handoff');

assert.match(property, /CREATION_PRICE_LABEL = '\$4\.99'/, 'the maker must show the $4.99 creation price');
assert.match(property, /\/api\/property-generation\/checkout/, 'photo approval must open paid generation checkout instead of calling Meshy directly');
assert.match(property, /Pay \$4\.99 · Use photo → start build/, 'the primary CTA must clearly disclose the creation charge');
assert.match(property, /generation_session/, 'the maker must resume a successfully paid creation after Stripe');
assert.match(property, /form\.append\('generationSessionId', generationSessionId\)/, 'Stripe return must pass the verified session into the source-generation gate');
assert.match(property, /generation_checkout.*cancelled/, 'the maker must recognize canceled creation checkout');
assert.match(property, /method: 'DELETE'/, 'canceled checkout must request cleanup of the staged source photo');
assert.match(property, /The \{CREATION_PRICE_LABEL\} charge is for one digital VoxelPop creation/, 'UI copy must explain that $4.99 buys digital generation rather than real estate');

console.log('Paid VoxelPop property-generation regression passed: signed-in photo -> direct-upload-first private staging with multi-credential recovery -> Meshy capacity preflight -> server-authoritative $4.99 Stripe checkout -> paid account/draft verification -> idempotent Meshy start -> automatic voxel pipeline, with unpaid calls failing closed.');
