import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { getVaultStoreProduct } from '../../../../lib/vault-store-products';
import { getVaultStoreBucket, getVaultStoreStoragePath } from '../../../../lib/vault-store-server';

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const product = getVaultStoreProduct(typeof body?.sku === 'string' ? body.sku : '');
    if (!product) return NextResponse.json({ error: 'Unknown Vault Store product.' }, { status: 400 });

    const { data: entitlement, error: entitlementError } = await supabaseAdmin
      .from('vault_store_entitlements')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('sku', product.sku)
      .is('revoked_at', null)
      .maybeSingle();
    if (entitlementError) throw entitlementError;
    if (!entitlement) return NextResponse.json({ error: 'Purchase confirmation is still pending or access is unavailable.' }, { status: 403 });

    const storagePath = getVaultStoreStoragePath(product.sku);
    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(getVaultStoreBucket())
      .createSignedUrl(storagePath, 60, { download: storagePath.split('/').pop() || `${product.sku}.zip` });

    if (signedError || !signed?.signedUrl) {
      console.error('vault store signed download failed', signedError);
      return NextResponse.json({ error: 'The paid file is not available in private storage yet.' }, { status: 503 });
    }

    return NextResponse.json({ url: signed.signedUrl, expiresIn: 60 });
  } catch (error) {
    console.error('vault store download authorization failed', error);
    return NextResponse.json({ error: 'Download unavailable.' }, { status: 500 });
  }
}
