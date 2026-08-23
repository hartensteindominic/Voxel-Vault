import fs from 'node:fs';

const catalog = fs.readFileSync('lib/catalog.js', 'utf8');
const checkout = fs.readFileSync('app/api/physical-nft-checkout/route.ts', 'utf8');
const webhook = fs.readFileSync('app/api/stripe/webhook/route.ts', 'utf8');
const verify = fs.readFileSync('app/api/mint-verify/route.ts', 'utf8');
const fulfillment = fs.readFileSync('lib/fulfillment.js', 'utf8');
const fulfillmentCallback = fs.readFileSync('app/api/fulfillment/status/route.ts', 'utf8');
const orders = fs.readFileSync('app/api/orders/route.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/005_one_sku_delivery_claim_pipeline.sql', 'utf8');

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
  ['supplier inventory preflight', /inventoryQuantity/g, fulfillment],
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

const sourceCount = (catalog.match(/sourceUrl:/g) || []).length;
const realityCount = (catalog.match(/realityBasis:/g) || []).length;
if (sourceCount < 8 || realityCount !== sourceCount) throw new Error(`Catalog provenance mismatch: ${sourceCount} sources / ${realityCount} reality records`);
if (fs.existsSync('app/api/stripe/webhook/route.js')) throw new Error('Duplicate Stripe webhook route must not exist');

console.log(`Commerce hardening smoke test passed: ${sourceCount} source-verified products`);
