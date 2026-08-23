import { NextResponse } from 'next/server';
import { stripe } from '../../../lib/stripe-server';
import { getCatalogItem } from '../../../lib/catalog';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id');
    const wallet = url.searchParams.get('wallet')?.toLowerCase();
    if (!sessionId || !wallet) return NextResponse.json({ error: 'session_id and wallet are required' }, { status: 400 });
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const metadataWallet = session.metadata?.wallet?.toLowerCase();
    const mintMode = session.metadata?.mint_mode;
    const catalogId = Number(session.metadata?.catalog_id);
    if (!['usd', 'physical_nft'].includes(String(mintMode)) || metadataWallet !== wallet || session.payment_status !== 'paid') {
      return NextResponse.json({ paid: false }, { status: 402 });
    }
    if (!Number.isInteger(catalogId) || catalogId < 1) return NextResponse.json({ error: 'Invalid mint object' }, { status: 400 });

    const item = getCatalogItem(catalogId - 1);
    if (!item) return NextResponse.json({ error: 'Catalog object unavailable' }, { status: 404 });

    let fulfillmentStatus = null;
    let claimEligible = mintMode !== 'physical_nft';
    let orderId = null;
    if (mintMode === 'physical_nft') {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: order, error } = await supabaseAdmin
        .from('physical_orders')
        .select('id,catalog_key,fulfillment_status,order_status,claim_eligible,tracking_number,tracking_url')
        .eq('stripe_checkout_session_id', sessionId)
        .maybeSingle();
      if (error) throw error;
      if (!order) return NextResponse.json({ paid: false, pending: true, error: 'Payment confirmed; waiting for the physical order record to be created.' }, { status: 202 });
      if (order.catalog_key !== item.id) return NextResponse.json({ paid: false, error: 'Order/catalog mismatch' }, { status: 409 });
      if (['cancelled', 'failed'].includes(order.fulfillment_status)) return NextResponse.json({ paid: false, error: 'Physical fulfillment is not available for this order.' }, { status: 409 });
      fulfillmentStatus = order.fulfillment_status;
      claimEligible = order.claim_eligible === true && order.fulfillment_status === 'delivered';
      orderId = order.id;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io';
    return NextResponse.json({
      paid: true,
      fulfillmentIncluded: mintMode === 'physical_nft',
      fulfillmentStatus,
      claimEligible,
      orderId,
      catalogId,
      wallet,
      item: {
        id: item.id,
        name: item.name,
        creator: item.creator,
        rarity: item.rarity,
        realityBasis: item.realityBasis,
        material: item.material,
        priceUsd: item.priceUsd,
        sourceUrl: item.sourceUrl,
        sourceName: item.sourceName,
        nftAnimationUrl: `${appUrl}/twin?asset=${catalogId}`,
        nftImageUrl: `${appUrl}/api/og?asset=${catalogId}`,
      },
      sessionId,
    });
  } catch (error) {
    console.error('USD mint verification failed', error);
    return NextResponse.json({ error: 'Unable to verify payment' }, { status: 500 });
  }
}
