import fs from 'node:fs';

const products = fs.readFileSync('lib/vault-store-products.ts', 'utf8');
const server = fs.readFileSync('lib/vault-store-server.ts', 'utf8');
const checkout = fs.readFileSync('app/api/vault-store/checkout/route.ts', 'utf8');
const entitlements = fs.readFileSync('app/api/vault-store/entitlements/route.ts', 'utf8');
const download = fs.readFileSync('app/api/vault-store/download/route.ts', 'utf8');
const webhook = fs.readFileSync('app/api/stripe/webhook/route.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260827_vault_store.sql', 'utf8');
const client = fs.readFileSync('app/vault-store/VaultStoreClient.tsx', 'utf8');
const success = fs.readFileSync('app/vault-store/success/page.tsx', 'utf8');

const required = [
  ['production feature gate', /VAULT_STORE_ENABLED/g, server],
  ['server-owned commerce kit price', /priceCents:\s*4900/g, products],
  ['server-owned audit pack price', /priceCents:\s*2900/g, products],
  ['checkout bearer authentication', /auth\.getUser\(token\)/g, checkout],
  ['checkout server SKU lookup', /getVaultStoreProduct/g, checkout],
  ['checkout server-owned price data', /unit_amount:\s*product\.priceCents/g, checkout],
  ['checkout duplicate ownership guard', /already own this product/g, checkout],
  ['entitlement bearer authentication', /auth\.getUser\(token\)/g, entitlements],
  ['download bearer authentication', /auth\.getUser\(token\)/g, download],
  ['download entitlement lookup', /vault_store_entitlements/g, download],
  ['short-lived private download', /createSignedUrl\(storagePath,\s*60/g, download],
  ['webhook signed event verification', /constructEvent/g, webhook],
  ['webhook paid status requirement', /payment_status !== 'paid'/g, webhook],
  ['webhook server amount verification', /amount !== product\.priceCents/g, webhook],
  ['webhook entitlement grant', /vault_store_entitlements/g, webhook],
  ['refund entitlement revocation', /revoked_at/g, webhook],
  ['RLS enabled on store orders', /alter table public\.vault_store_orders enable row level security/g, migration],
  ['RLS enabled on store entitlements', /alter table public\.vault_store_entitlements enable row level security/g, migration],
  ['buyer-scoped order policy', /buyer_id = auth\.uid\(\)/g, migration],
  ['storefront owned state', /OWNED · PRIVATE DOWNLOAD/g, client],
  ['success page waits for entitlement', /WAITING FOR VERIFIED ACCESS/g, success],
];

for (const [label, pattern, source] of required) {
  if (!pattern.test(source)) throw new Error(`Missing Vault Store hardening: ${label}`);
}

if (/body\?\.price|body\?\.amount|body\?\.priceId/.test(checkout)) {
  throw new Error('Vault Store checkout must not accept client-controlled price or Stripe price IDs');
}
if (/customerEmail/.test(checkout)) {
  throw new Error('Vault Store checkout must derive customer identity from authenticated account data');
}
if (/private_storage|readFileSync\([^)]*storage/i.test(download)) {
  throw new Error('Vault Store downloads must use private object storage, not local runtime files');
}

console.log('Vault Store hardening smoke test passed');
