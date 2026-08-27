import fs from 'node:fs';

const checkout = fs.readFileSync('app/api/vault-store/checkout/route.ts', 'utf8');
const download = fs.readFileSync('app/api/vault-store/download/route.ts', 'utf8');
const webhook = fs.readFileSync('app/api/stripe/webhook/route.ts', 'utf8');
const accounting = fs.readFileSync('lib/vault-store-accounting.ts', 'utf8');
const storeServer = fs.readFileSync('lib/vault-store-server.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260827_vault_store.sql', 'utf8');

const required = [
  ['checkout private-file preflight', /preflightVaultStoreProduct/g, checkout],
  ['server-authoritative product lookup', /getVaultStoreProduct/g, checkout],
  ['server-authoritative Stripe amount', /unit_amount:\s*product\.priceCents/g, checkout],
  ['private storage existence check', /\.list\(folder,/g, storeServer],
  ['signed private download', /createSignedUrl/g, download],
  ['Stripe signature verification', /constructEvent/g, webhook],
  ['durable Stripe event idempotency', /commerce_webhook_events/g, webhook],
  ['gross sale journal before entitlement', /recordVaultStorePaidSale/g, webhook],
  ['refund delta accounting', /refundDelta/g, webhook],
  ['balanced client-side accounting guard', /debit !== credit/g, accounting],
  ['database balanced-journal RPC', /post_vault_store_journal/g, migration],
  ['serialized hash-chain append', /pg_advisory_xact_lock/g, migration],
  ['SHA-256 journal hash', /digest\(v_previous_hash/g, migration],
  ['journal chain verifier', /verify_vault_store_journal_chain/g, migration],
  ['service-role-only journal writer', /grant execute on function public\.post_vault_store_journal[\s\S]*service_role/g, migration],
];

for (const [label, pattern, source] of required) {
  if (!pattern.test(source)) throw new Error(`Missing Vault Store hardening: ${label}`);
}

const journalIndex = webhook.indexOf('await recordVaultStorePaidSale');
const entitlementIndex = webhook.indexOf("from('vault_store_entitlements').upsert", journalIndex);
if (journalIndex < 0 || entitlementIndex < 0 || journalIndex > entitlementIndex) {
  throw new Error('Vault Store access must not be granted before the paid sale journal is committed');
}

if (/fs\.readFileSync|private_storage/.test(download)) {
  throw new Error('Vault Store downloads must use private object storage, not server-local ZIP files');
}
if (/fallback_development_secret|DOWNLOAD_SIGNING_SECRET/.test(download + accounting + webhook)) {
  throw new Error('Vault Store security must not rely on a fallback signing secret');
}
if (/body\?\.price|body\.price|priceId/.test(checkout)) {
  throw new Error('Vault Store checkout must not trust client-supplied prices or Stripe price IDs');
}

console.log('Vault Store hardening smoke test passed');
