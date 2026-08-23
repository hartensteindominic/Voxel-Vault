const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const SHA256 = /^[a-fA-F0-9]{64}$/;
const TOKEN_ID = /^(0|[1-9][0-9]*)$/;
const TRANSACTION_HASH = /^0x[a-fA-F0-9]{64}$/;
const BASE_CHAIN_ID = 8453;
const PUBLIC_HOST_BLOCKLIST = new Set(['localhost', 'localhost.localdomain']);
const AUTHORIZED_FULFILLMENT_PROVIDERS = new Set(['shopify', 'generic']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function publicHttpsUrl(value) {
  try {
    const url = new URL(text(value));
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (PUBLIC_HOST_BLOCKLIST.has(host) || host.endsWith('.local')) return null;
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null;
    const private172 = host.match(/^172\.(\d+)\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return null;
    return url;
  } catch {
    return null;
  }
}

function modelUrl(value) {
  const raw = text(value);
  if (raw.startsWith('ipfs://')) return raw;
  const url = publicHttpsUrl(raw);
  if (!url) return null;
  const path = url.pathname.toLowerCase();
  return path.endsWith('.glb') || path.endsWith('.gltf') ? url.toString() : null;
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export function normalizeSupplierUrl(value) {
  const url = publicHttpsUrl(value);
  if (!url) throw new Error('Supplier URL must be a public HTTPS URL.');
  url.hash = '';
  return url.toString();
}

export function buildProductDraft(input = {}) {
  const sourceUrl = normalizeSupplierUrl(input.sourceUrl);
  const url = new URL(sourceUrl);
  const sourceName = text(input.sourceName) || url.hostname.replace(/^www\./, '');
  return {
    source_url: sourceUrl,
    source_host: url.hostname.toLowerCase(),
    source_name: sourceName.slice(0, 160),
    name: text(input.name).slice(0, 200),
    status: 'draft',
    fulfillment_status: 'unverified',
    shipping_status: 'unverified',
    mint_status: 'unverified',
    inventory_status: 'unverified',
  };
}

export function getVaultReadyReport(product = {}) {
  const missing = [];
  const invalid = [];
  const requiredText = [
    ['source_url', 'supplier URL'],
    ['source_name', 'supplier name'],
    ['name', 'product name'],
    ['physical_sku', 'physical SKU'],
    ['fulfillment_provider', 'fulfillment provider'],
    ['fulfillment_sku', 'fulfillment SKU'],
    ['model_license', 'model license'],
    ['model_license_uri', 'model license evidence'],
    ['model_hash', 'model hash'],
    ['contract_address', 'contract address'],
    ['token_id', 'pre-minted token ID'],
    ['mint_tx_hash', 'confirmed mint transaction'],
  ];
  for (const [key, label] of requiredText) if (!text(product[key])) missing.push(label);

  if (text(product.source_url) && !publicHttpsUrl(product.source_url)) invalid.push('supplier URL');
  if (!modelUrl(product.model_uri)) {
    if (text(product.model_uri)) invalid.push('GLB/GLTF model URI');
    else missing.push('GLB/GLTF model URI');
  }
  if (text(product.model_license_uri) && !publicHttpsUrl(product.model_license_uri)) invalid.push('model license evidence');
  if (text(product.model_hash) && !SHA256.test(text(product.model_hash))) invalid.push('SHA-256 model hash');
  if (text(product.contract_address) && !EVM_ADDRESS.test(text(product.contract_address))) invalid.push('contract address');
  if (text(product.token_id) && !TOKEN_ID.test(text(product.token_id))) invalid.push('token ID');
  if (!product.chain_id) missing.push('Base chain ID');
  if (product.chain_id && Number(product.chain_id) !== BASE_CHAIN_ID) invalid.push('Base chain ID');
  if (text(product.mint_tx_hash) && !TRANSACTION_HASH.test(text(product.mint_tx_hash))) invalid.push('mint transaction hash');
  if (!positiveInteger(product.source_price_cents)) missing.push('verified supplier price');
  if (!positiveInteger(product.retail_price_cents)) missing.push('retail price');
  if (positiveInteger(product.source_price_cents) && positiveInteger(product.retail_price_cents) && product.retail_price_cents < product.source_price_cents) invalid.push('retail price');
  if (text(product.fulfillment_provider) && !AUTHORIZED_FULFILLMENT_PROVIDERS.has(text(product.fulfillment_provider).toLowerCase())) invalid.push('fulfillment provider');
  if (product.fulfillment_status !== 'verified') missing.push('verified fulfillment route');
  if (product.shipping_status !== 'verified') missing.push('tested shipping and returns');
  if (product.mint_status !== 'confirmed') missing.push('confirmed pre-mint');
  if (product.inventory_status !== 'available') missing.push('available inventory');

  return { ready: missing.length === 0 && invalid.length === 0, missing: [...new Set(missing)], invalid: [...new Set(invalid)] };
}

export function isVaultReady(product) {
  return getVaultReadyReport(product).ready;
}
