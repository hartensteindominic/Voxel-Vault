import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { getVaultStoreProduct } from '../../../../lib/vault-store-products';

export async function GET(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('vault_store_entitlements')
      .select('sku,created_at,revoked_at')
      .eq('buyer_id', user.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const products = (data || [])
      .map(row => {
        const product = getVaultStoreProduct(row.sku);
        if (!product) return null;
        return {
          sku: product.sku,
          name: product.name,
          priceCents: product.priceCents,
          purchasedAt: row.created_at,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ products });
  } catch (error) {
    console.error('vault store entitlement lookup failed', error);
    return NextResponse.json({ error: 'Library unavailable.' }, { status: 500 });
  }
}
