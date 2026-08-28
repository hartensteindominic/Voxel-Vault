import { NextResponse } from 'next/server';
import { stripe, platformFee } from '../../../lib/stripe-server';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import { verifyMarketplaceSellerPayoutReadiness } from '../../../lib/marketplace-seller-readiness';

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { assetId } = await request.json();
    if (!assetId) return NextResponse.json({ error: 'assetId is required' }, { status: 400 });

    const { data: asset, error: assetError } = await supabaseAdmin
      .from('assets')
      .select('id,title,price_cents,currency,seller_id,status')
      .eq('id', String(assetId))
      .eq('status', 'published')
      .single();
    if (assetError || !asset) return NextResponse.json({ error: 'Asset unavailable' }, { status: 404 });
    if (asset.seller_id === user.id) return NextResponse.json({ error: 'You cannot purchase your own asset' }, { status: 400 });

    const { data: existing } = await supabaseAdmin
      .from('download_entitlements')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('asset_id', asset.id)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: 'Already purchased' }, { status: 409 });

    const { data: seller, error: sellerError } = await supabaseAdmin
      .from('seller_accounts')
      .select('stripe_account_id')
      .eq('user_id', asset.seller_id)
      .maybeSingle();
    if (sellerError) return NextResponse.json({ error: 'Seller payout state could not be verified.' }, { status: 503 });

    const payout = await verifyMarketplaceSellerPayoutReadiness(seller);
    if (!payout.ready) {
      return NextResponse.json({
        error: 'This seller is not currently payout-ready, so checkout is paused. No payment session was created.',
        sellerPayoutReady: false,
      }, { status: 409 });
    }

    const fee = platformFee(asset.price_cents);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://voxel-vault.vercel.app';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: asset.currency,
          unit_amount: asset.price_cents,
          product_data: { name: asset.title },
        },
      }],
      metadata: { asset_id: asset.id, buyer_id: user.id },
      payment_intent_data: {
        metadata: { asset_id: asset.id, buyer_id: user.id },
        application_fee_amount: fee,
        transfer_data: { destination: payout.destination },
      },
      success_url: `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('checkout creation failed', error);
    return NextResponse.json({ error: 'Unable to create checkout session' }, { status: 500 });
  }
}
