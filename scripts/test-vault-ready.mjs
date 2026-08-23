import assert from 'node:assert/strict';
import { buildProductDraft, getVaultReadyReport, normalizeSupplierUrl } from '../lib/vault-ready.mjs';

const ready = {
  source_url: 'https://supplier.example/products/001', source_name: 'Supplier', name: 'Pilot product',
  physical_sku: 'PHYSICAL-001', source_price_cents: 1000, retail_price_cents: 1500,
  fulfillment_provider: 'generic', fulfillment_sku: 'SUPPLIER-001', fulfillment_status: 'verified', shipping_status: 'verified',
  model_uri: 'https://cdn.example/product.glb', model_license: 'Commercial display and NFT association',
  model_license_uri: 'https://vault.example/licenses/001', model_hash: 'a'.repeat(64),
  contract_address: `0x${'b'.repeat(40)}`, chain_id: 8453, token_id: '1', mint_tx_hash: `0x${'c'.repeat(64)}`,
  mint_confirmed_at: '2026-08-23T00:00:00.000Z', mint_confirmed_block: 35000000, mint_owner: `0x${'d'.repeat(40)}`,
  mint_status: 'confirmed', inventory_status: 'available',
};

assert.equal(getVaultReadyReport(ready).ready, true);
assert.equal(getVaultReadyReport({ ...ready, mint_status: 'pending' }).ready, false);
assert.equal(getVaultReadyReport({ ...ready, model_uri: 'https://cdn.example/photo.jpg' }).ready, false);
assert.equal(getVaultReadyReport({ ...ready, retail_price_cents: 500 }).ready, false);
assert.equal(getVaultReadyReport({ ...ready, fulfillment_provider: 'random-website-bot' }).ready, false);
assert.equal(getVaultReadyReport({ ...ready, chain_id: 1 }).ready, false);
assert.equal(getVaultReadyReport({ ...ready, mint_confirmed_at: null }).ready, false);
assert.equal(buildProductDraft({ sourceUrl: 'https://www.temu.com/item/123' }).status, 'draft');
assert.throws(() => normalizeSupplierUrl('http://localhost:3000/private'));
assert.throws(() => normalizeSupplierUrl('https://127.0.0.1/private'));

console.log('Vault Ready qualification tests passed');
