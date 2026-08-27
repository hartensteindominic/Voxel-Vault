import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { getVaultStoreProduct } from '../../../../lib/vault-store-products';
import { preflightVaultStoreProduct, vaultStoreEnabled } from '../../../../lib/vault-store-server';

export async function POST(request: Request) {
  try {
    if (!vaultStoreEnabled()) {
      return NextResponse.json({ error: 'Vault Store checkout is not enabled yet.' }, { status: 503 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const product = getVaultStoreProduct(typeof body?.sku === 'string' ? body.sku : '');
    if (!product) return NextResponse.json({ error: 'Unknown Vault Store product.' }, { status: 400 });

    // Fail closed before Stripe can accept money. The feature flag alone is not
    // enough: the exact paid ZIP must already exist in private storage.
    const delivery = await preflightVaultStoreProduct(product.sku);
    if (!delivery.available) {
      console.error('vault store checkout blocked by delivery preflight', { sku: product.sku, reason: delivery.reason });
      return NextResponse.json({ error: 'This product is not ready for paid delivery yet.' }, { status: 503 });
    }

    const { data: existing, error: entitlementLookupError } = await supabaseAdmin
      .from('vault_store_entitlements')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('sku', product.sku)
      .is('revoked_at', null)
      .maybeSingle();
    if (entitlementLookupError) throw entitlementLookupError;
    if (existing) return NextResponse.json({ error: 'You already own this product.' }, { status: 409 });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.voxelvault.io').replace(/\/$/, '');
    const metadata = {
      commerce_kind: 'vault_store',
      vault_store_sku: product.sku,
      buyer_id: user.id,
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: product.currency,
          unit_amount: product.priceCents,
          product_data: {
            name: product.name,
            description: product.description.slice(0, 500),
          },
        },
      }],
      metadata,
      payment_intent_data: { metadata },
      allow_promotion_codes: false,
      success_url: `${appUrl}/vault-store/success?sku=${encodeURIComponent(product.sku)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/vault-store?checkout=cancelled`,
    });

    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('vault store checkout creation failed', error);
    return NextResponse.json({ error: 'Unable to start secure checkout.' }, { status: 500 });
  }
}
