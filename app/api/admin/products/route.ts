import { NextResponse } from 'next/server';
import { requireVaultAdmin } from '../../../../lib/admin-auth';
import { buildProductDraft, getVaultReadyReport } from '../../../../lib/vault-ready.mjs';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireVaultAdmin(request);
  if ('response' in auth) return auth.response;
  const { data, error } = await auth.supabase.from('supplier_product_drafts').select('*').order('updated_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: 'Unable to load product drafts.' }, { status: 500 });
  return NextResponse.json({ products: data || [] }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  const auth = await requireVaultAdmin(request);
  if ('response' in auth) return auth.response;
  try {
    const body = await request.json();
    if (!body || typeof body.sourceUrl !== 'string' || body.sourceUrl.length > 2048) {
      return NextResponse.json({ error: 'A supplier product URL is required.' }, { status: 400 });
    }
    const draft = buildProductDraft(body);
    const readiness = getVaultReadyReport(draft);
    const { data, error } = await auth.supabase.from('supplier_product_drafts').insert({ ...draft, readiness, created_by: auth.user.id }).select('*').single();
    if (error || !data) throw error || new Error('Draft creation failed');
    return NextResponse.json({ product: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create product draft.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
