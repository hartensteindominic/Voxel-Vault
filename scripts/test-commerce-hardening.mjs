import fs from 'node:fs';

const catalog = fs.readFileSync('lib/catalog.js', 'utf8');
const checkout = fs.readFileSync('app/api/physical-nft-checkout/route.ts', 'utf8');
const webhook = fs.readFileSync('app/api/stripe/webhook/route.ts', 'utf8');
const verify = fs.readFileSync('app/api/mint-verify/route.ts', 'utf8');
const fulfillment = fs.readFileSync('lib/fulfillment.js', 'utf8');
const preflight = fs.readFileSync('lib/fulfillment-preflight.js', 'utf8');
const fulfillmentCallback = fs.readFileSync('app/api/fulfillment/status/route.ts', 'utf8');
const orders = fs.readFileSync('app/api/orders/route.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/005_one_sku_delivery_claim_pipeline.sql', 'utf8');
const marketplaceCheckout = fs.readFileSync('app/api/checkout/route.ts', 'utf8');
const marketplaceSecureCheckout = fs.readFileSync('app/api/checkout-secure/route.ts', 'utf8');
const sellerReadiness = fs.readFileSync('lib/marketplace-seller-readiness.ts', 'utf8');
const sellerPayoutMigration = fs.readFileSync('supabase/migrations/017_lock_seller_payout_fields.sql', 'utf8');
const receiptMint = fs.readFileSync('app/api/receipt-mint/route.ts', 'utf8');
const envExample = fs.readFileSync('.env.example', 'utf8');

const required = [
  ['catalog source URLs', /sourceUrl:/g, catalog],
  ['catalog reality basis', /realityBasis:/g, catalog],
  ['checkout fulfillment gate', /FULFILLMENT_NOT_READY/g, checkout],
  ['one-SKU pilot gate', /VOXEL_PILOT_CATALOG_KEY/g, checkout],
  ['live supplier preflight', /preflightPhysicalFulfillment/g, checkout],
  ['shipping address collection', /shipping_address_collection/g, checkout],
  ['automatic tax calculation', /automatic_tax/g, checkout],
  ['post-checkout order timeline', /\/orders\?session_id=/g, checkout],
  ['Stripe webhook signature verification', /constructEvent/g, webhook],
  ['durable Stripe event idempotency', /commerce_webhook_events/g, webhook],
  ['durable physical order lookup', /physical_orders/g, webhook],
  ['fulfillment idempotency key', /Idempotency-Key/g, fulfillment],
  ['supplier pilot preflight', /pilotEnabled/g, preflight],
  ['Shopify order creation support', /orderCreate/g, fulfillment],
  ['delivery-gated twin claim', /claim_eligible/g, verify],
  ['signed fulfillment callback', /timingSafeEqual/g, fulfillmentCallback],
  ['authenticated order history', /auth\.getUser/g, orders],
  ['atomic fulfillment state machine', /INVALID_ORDER_TRANSITION/g, migration],
  ['delivery unlock in database', /claim_eligible = \(p_status = 'delivered'\)/g, migration],
];

for (const [label, pattern, source] of required) {
  if (!pattern.test(source)) throw new Error(`Missing commerce hardening: ${label}`);
}

function requireText(source, value, label) {
  if (!source.includes(value)) throw new Error(`Missing commerce hardening: ${label}`);
}

function forbidText(source, value, label) {
  if (source.includes(value)) throw new Error(`Unsafe commerce behavior present: ${label}`);
}

for (const [label, source] of [
  ['marketplace checkout', marketplaceCheckout],
  ['secure marketplace checkout', marketplaceSecureCheckout],
]) {
  requireText(source, 'verifyMarketplaceSellerPayoutReadiness', `${label} must verify seller payout readiness`);
  requireText(source, 'sellerPayoutReady: false', `${label} must fail closed before charging an unready seller`);
  requireText(source, 'transfer_data: { destination: payout.destination }', `${label} must use the verified Stripe destination`);
  forbidText(source, 'seller?.stripe_account_id && seller.charges_enabled', `${label} must not trust database payout flags`);
}

requireText(sellerReadiness, 'MARKETPLACE_SELLER_PAYOUTS_ENABLED', 'marketplace payouts must have an explicit server-side activation gate');
requireText(sellerReadiness, 'stripe.accounts.retrieve', 'seller readiness must be verified directly with Stripe');
requireText(sellerReadiness, 'account.charges_enabled === true', 'Stripe charges state must be verified');
requireText(sellerReadiness, 'account.payouts_enabled === true', 'Stripe payouts state must be verified');
requireText(sellerReadiness, 'account.details_submitted === true', 'Stripe onboarding completion must be verified');
requireText(envExample, 'MARKETPLACE_SELLER_PAYOUTS_ENABLED=false', 'example environment must keep third-party marketplace payouts locked');

requireText(sellerPayoutMigration, 'drop policy if exists "user manages own seller account"', 'seller payout insert policy must be removed');
requireText(sellerPayoutMigration, 'drop policy if exists "user updates own seller account"', 'seller payout update policy must be removed');
forbidText(sellerPayoutMigration, 'for update to authenticated', 'authenticated users must not regain direct payout-row updates');

requireText(receiptMint, 'checkoutEnabled: false', 'incomplete receipt mint checkout must be explicitly disabled');
requireText(receiptMint, 'No charge has been created', 'disabled receipt mint must tell callers no charge was created');
forbidText(receiptMint, 'stripe.checkout.sessions.create', 'receipt mint must not charge until post-payment fulfillment exists');
forbidText(receiptMint, "from '../../../lib/stripe-server'", 'disabled receipt mint must not initialize Stripe checkout code');

const sourceCount = (catalog.match(/sourceUrl:/g) || []).length;
const realityCount = (catalog.match(/realityBasis:/g) || []).length;
if (sourceCount < 8 || realityCount !== sourceCount) throw new Error(`Catalog provenance mismatch: ${sourceCount} sources / ${realityCount} reality records`);
if (fs.existsSync('app/api/stripe/webhook/route.js')) throw new Error('Duplicate Stripe webhook route must not exist');

console.log(`Commerce hardening smoke test passed: ${sourceCount} source-verified products; marketplace payouts and incomplete paid routes fail closed.`);
