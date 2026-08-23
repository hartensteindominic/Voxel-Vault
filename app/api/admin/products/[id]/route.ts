import { NextResponse } from 'next/server';
import { requireVaultAdmin } from '../../../../../lib/admin-auth';
import { getVaultReadyReport, normalizeSupplierUrl } from '../../../../../lib/vault-ready.mjs';

const TEXT_FIELDS = new Set([
  'source_name', 'name', 'physical_sku', 'currency', 'fulfillment_provider', 'fulfillment_sku',
  'fulfillment_status', 'shipping_status', 'model_uri', 'usdz_uri', 'model_license',
  'model_license_uri', 'model_hash', 'contract_address', 'token_id', 'mint_tx_hash',
  'mint_status', 'inventory_status',
]);
const NUMBER_FIELDS = new Set(['source_price_cents', 'retail_price_cents', 'chain_id']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizePatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (TEXT_FIELDS.has(key)) {
      if (value === null || value === '') patch[key] = key === 'name' || key === 'source_name' ? '' : null;
      else if (typeof value === 'string' && value.length <= 2048) patch[key] = value.trim();
      else throw new Error(`Invalid ${key}.`);
    }
    if (NUMBER_FIELDS.has(key)) {
      if (value === null || value === '') { patch[key] = null; continue; }
      const number = Number(value);
      if (!Number.isInteger(number) || number <= 0) throw new Error(`Invalid ${key}.`);
      patch[key] = number;
    }
  }
  if (typeof body.source_url === 'string') patch.source_url = normalizeSupplierUrl(body.source_url);
  for (const key of ['currency','fulfillment_provider','model_hash','contract_address','mint_tx_hash']) {
    if (typeof patch[key] === 'string') patch[key] = patch[key].toLowerCase();
  }
  return patch;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireVaultAdmin(request);
  if ('response' in auth) return auth.response;
  try {
    const { id } = await context.params;
    if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid product draft.' }, { status: 400 });
    const body = await request.json() as Record<string, unknown>;
    const { data: current, error: readError } = await auth.supabase.from('supplier_product_drafts').select('*').eq('id', id).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: 'Product draft not found.' }, { status: 404 });
    const patch = sanitizePatch(body);
    if (typeof patch.source_url === 'string') patch.source_host = new URL(patch.source_url).hostname.toLowerCase();
    const candidate = { ...current, ...patch };
    const readiness = getVaultReadyReport(candidate);
    const action = body.action;
    if (action && !['save', 'review'].includes(String(action))) {
      return NextResponse.json({ error: 'Invalid product action.' }, { status: 400 });
    }
    patch.readiness = readiness;
    patch.updated_at = new Date().toISOString();
    if (action === 'review') {
      patch.status = readiness.ready ? 'ready' : 'review';
      patch.published_at = null;
    }
    if (!action && current.status !== 'published') patch.status = readiness.ready ? 'ready' : 'draft';
    if (current.status === 'published' && !readiness.ready) {
      patch.status = 'draft';
      patch.published_at = null;
    }
    const { data, error } = await auth.supabase.from('supplier_product_drafts').update(patch).eq('id', id).select('*').single();
    if (error || !data) throw error || new Error('Draft update failed');
    return NextResponse.json({ product: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update product draft.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
