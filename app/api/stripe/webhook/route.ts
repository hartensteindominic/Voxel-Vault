import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '../../../../lib/stripe-server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { getCatalogItem } from '../../../../lib/catalog';
import { submitPhysicalFulfillment } from '../../../../lib/fulfillment';
import { buildVerifiedRewardRecord } from '../../../../lib/rewards/stripeWebhook.js';
import { persistRewardEvent } from '../../../../lib/rewards/persistence.js';
import { getVaultStoreProduct } from '../../../../lib/vault-store-products';

const WALLET_RE = /^0x[a-f0-9]{40}$/;
type ShippingDetails = {
  name?: string | null;
  phone?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
};
type CheckoutSessionWithShipping = Stripe.Checkout.Session & { shipping_details?: ShippingDetails | null };

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
  const payload = await request.text();
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(payload, signature, secret); }
  catch { return NextResponse.json({ error: 'Invalid signature' }, { status: 400 }); }

  const supabaseAdmin = getSupabaseAdmin();
  let eventRecorded = false;
  try {
    const { error: eventError } = await supabaseAdmin.from('commerce_webhook_events').insert({ provider: 'stripe', event_id: event.id, event_type: event.type });
    if (eventError?.code === '23505') return NextResponse.json({ received: true, duplicate: true });
    if (eventError) throw eventError;
    eventRecorded = true;
    await supabaseAdmin.from('stripe_events').upsert({ id: event.id, type: event.type, livemode: Boolean(event.livemode) }, { onConflict: 'id', ignoreDuplicates: true });
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as CheckoutSessionWithShipping;
      if (session.payment_status !== 'paid') return NextResponse.json({ received: true });

      if (session.metadata?.mint_mode === 'physical_nft') {
        const wallet = session.metadata?.wallet?.toLowerCase();
        const buyerId = session.metadata?.buyer_id || null;
        const catalogId = Number(session.metadata?.catalog_id);
        const catalogKey = session.metadata?.catalog_key;
        const item = Number.isInteger(catalogId) ? getCatalogItem(catalogId - 1) : null;
        const shipping = session.shipping_details;
        const address = shipping?.address;
        if (!WALLET_RE.test(wallet || '') || !item || !catalogKey || !buyerId) throw new Error('Invalid physical + NFT checkout metadata');
        if (!shipping?.name || !address?.line1 || !address.city || !address.state || !address.postal_code || !address.country) throw new Error('Incomplete shipping address');

        const { data: existing, error: lookupError } = await supabaseAdmin
          .from('physical_orders')
          .select('id,fulfillment_status,fulfillment_order_id,tracking_number,tracking_url')
          .eq('stripe_checkout_session_id', session.id)
          .maybeSingle();
        if (lookupError) throw lookupError;

        let order = existing;
        if (!order) {
          const { data: created, error } = await supabaseAdmin.from('physical_orders').insert({
            buyer_id: buyerId,
            catalog_id: catalogId,
            catalog_key: catalogKey,
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            shipping_name: shipping.name,
            shipping_line1: address.line1,
            shipping_line2: address.line2 || null,
            shipping_city: address.city,
            shipping_state: address.state || '',
            shipping_postal_code: address.postal_code,
            shipping_country: address.country,
            currency: session.currency || 'usd',
            physical_amount_cents: Number(session.metadata?.physical_amount_cents || 0),
            nft_amount_cents: Number(session.metadata?.nft_amount_cents || 0),
            shipping_amount_cents: Number(session.metadata?.shipping_amount_cents || 0),
            tax_amount_cents: Number(session.total_details?.amount_tax || 0),
            total_amount_cents: Number(session.amount_total || 0),
            order_status: 'fulfillment_pending',
            fulfillment_status: 'awaiting_fulfillment',
          }).select('id,fulfillment_status,fulfillment_order_id,tracking_number,tracking_url').single();
          if (error || !created) throw error ?? new Error('Physical order creation failed');
          order = created;
          const { error: timelineError } = await supabaseAdmin.from('physical_order_events').insert({ physical_order_id: order.id, event_id: `${event.id}:paid`, event_type: 'payment_confirmed', public_message: 'Payment confirmed. Preparing your physical product.' });
          if (timelineError) throw timelineError;
        }

        if (!['submitted', 'shipped', 'delivered'].includes(order.fulfillment_status)) {
          try {
            const fulfillment = await submitPhysicalFulfillment({
              orderId: order.id,
              externalOrderId: session.id,
              catalogKey,
              shipping,
              email: session.customer_details?.email || session.customer_email || undefined,
            });
            const update: Record<string, unknown> = { fulfillment_status: fulfillment.status, updated_at: new Date().toISOString() };
            update.order_status = fulfillment.status === 'submitted' ? 'submitted' : 'fulfillment_pending';
            if ('fulfillmentOrderId' in fulfillment && fulfillment.fulfillmentOrderId) update.fulfillment_order_id = fulfillment.fulfillmentOrderId;
            if ('trackingNumber' in fulfillment && fulfillment.trackingNumber) update.tracking_number = fulfillment.trackingNumber;
            if ('trackingUrl' in fulfillment && fulfillment.trackingUrl) update.tracking_url = fulfillment.trackingUrl;
            const { error: orderUpdateError } = await supabaseAdmin.from('physical_orders').update(update).eq('id', order.id);
            if (orderUpdateError) throw orderUpdateError;
            const { error: fulfillmentTimelineError } = await supabaseAdmin.from('physical_order_events').upsert({ physical_order_id: order.id, event_id: `${event.id}:fulfillment`, event_type: 'fulfillment_submitted', public_message: fulfillment.status === 'submitted' ? 'Your order was accepted by the fulfillment partner.' : 'Your order is queued for fulfillment.' }, { onConflict: 'event_id' });
            if (fulfillmentTimelineError) throw fulfillmentTimelineError;
          } catch (fulfillmentError) {
            console.error('VoxelVault physical fulfillment submission failed', fulfillmentError);
            throw fulfillmentError;
          }
        }
        return NextResponse.json({ received: true });
      }

      const storeSku = session.metadata?.vault_store_sku;
      const storeBuyerId = session.metadata?.buyer_id;
      if (session.metadata?.commerce_kind === 'vault_store' || storeSku) {
        const product = getVaultStoreProduct(storeSku);
        if (!product || !storeBuyerId) throw new Error('Invalid Vault Store checkout metadata');
        const amount = Number(session.amount_total ?? -1);
        const currency = String(session.currency || '').toLowerCase();
        if (amount !== product.priceCents || currency !== product.currency) {
          throw new Error('Vault Store payment amount does not match the server catalog');
        }

        const { data: order, error: orderError } = await supabaseAdmin.from('vault_store_orders').upsert({
          buyer_id: storeBuyerId,
          sku: product.sku,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          currency: product.currency,
          amount_cents: product.priceCents,
          status: 'paid',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'stripe_checkout_session_id' }).select('id').single();
        if (orderError || !order) throw orderError ?? new Error('Vault Store order creation failed');

        const { error: entitlementError } = await supabaseAdmin.from('vault_store_entitlements').upsert({
          buyer_id: storeBuyerId,
          sku: product.sku,
          order_id: order.id,
          revoked_at: null,
        }, { onConflict: 'buyer_id,sku' });
        if (entitlementError) throw entitlementError;
        return NextResponse.json({ received: true });
      }

      const assetId = session.metadata?.asset_id;
      const buyerId = session.metadata?.buyer_id;
      if (assetId && buyerId) {
        const { data: asset, error: assetError } = await supabaseAdmin.from('assets').select('id,seller_id,price_cents,currency').eq('id', assetId).eq('status', 'published').single();
        if (assetError || !asset) throw assetError ?? new Error('Asset not found');
        const amount = session.amount_total ?? asset.price_cents;
        const { data: order, error: orderError } = await supabaseAdmin.from('orders').upsert({ buyer_id: buyerId, stripe_checkout_session_id: session.id, stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null, currency: session.currency ?? asset.currency, subtotal_cents: amount, platform_fee_cents: Math.floor(amount * 0.2), status: 'paid' }, { onConflict: 'stripe_checkout_session_id' }).select('id').single();
        if (orderError || !order) throw orderError ?? new Error('Order creation failed');
        const { error: itemError } = await supabaseAdmin.from('order_items').upsert({ order_id: order.id, asset_id: asset.id, seller_id: asset.seller_id, unit_amount_cents: amount }, { onConflict: 'order_id,asset_id' });
        if (itemError) throw itemError;
        const { error: entitlementError } = await supabaseAdmin.from('download_entitlements').upsert({ buyer_id: buyerId, asset_id: asset.id, order_id: order.id }, { onConflict: 'buyer_id,asset_id' });
        if (entitlementError) throw entitlementError;
      }
    }
    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntent) {
        const refundedAt = new Date().toISOString();
        const { data: storeOrder, error: storeRefundError } = await supabaseAdmin
          .from('vault_store_orders')
          .update({ status: 'refunded', updated_at: refundedAt })
          .eq('stripe_payment_intent_id', paymentIntent)
          .select('id')
          .maybeSingle();
        if (storeRefundError) throw storeRefundError;
        if (storeOrder) {
          const { error: revokeError } = await supabaseAdmin
            .from('vault_store_entitlements')
            .update({ revoked_at: refundedAt })
            .eq('order_id', storeOrder.id)
            .is('revoked_at', null);
          if (revokeError) throw revokeError;
        }

        const { data: order } = await supabaseAdmin.from('physical_orders').update({ order_status: 'refunded', return_status: 'refunded', refunded_at: refundedAt, claim_eligible: false, updated_at: refundedAt }).eq('stripe_payment_intent_id', paymentIntent).select('id').maybeSingle();
        if (order) await supabaseAdmin.from('physical_order_events').upsert({ physical_order_id: order.id, event_id: `${event.id}:refunded`, event_type: 'refunded', public_message: 'The order was refunded. Its delivery claim is closed.' }, { onConflict: 'event_id' });
      }
    }
    const reward = buildVerifiedRewardRecord(event);
    if (reward) await persistRewardEvent(reward);
  } catch (error) {
    console.error('VoxelVault webhook failed', error);
    if (eventRecorded) await supabaseAdmin.from('commerce_webhook_events').delete().eq('provider', 'stripe').eq('event_id', event.id);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
