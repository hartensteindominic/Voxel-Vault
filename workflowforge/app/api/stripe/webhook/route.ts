import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

function planForPrice(priceId?: string | null) {
  if (priceId && priceId === process.env.STRIPE_STUDIO_PRICE_ID) return 'studio';
  if (priceId && priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro';
  return 'free';
}

export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return new NextResponse('Missing Stripe configuration', { status: 400 });
  try {
    const event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
    const admin = getSupabaseAdminClient();

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (userId && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id ?? null;
        await admin.from('profiles').update({ plan: planForPrice(priceId), stripe_customer_id: String(session.customer), updated_at: new Date().toISOString() }).eq('id', userId);
        await admin.from('subscriptions').upsert({ user_id: userId, stripe_subscription_id: subscription.id, status: subscription.status, price_id: priceId, current_period_end: new Date(subscription.current_period_end * 1000).toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'stripe_subscription_id' });
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
      const subscription = event.data.object as Stripe.Subscription;
      const customer = String(subscription.customer);
      const { data: profile } = await admin.from('profiles').select('id').eq('stripe_customer_id', customer).maybeSingle();
      if (profile) {
        const priceId = subscription.items.data[0]?.price.id ?? null;
        const active = ['active', 'trialing'].includes(subscription.status);
        await admin.from('profiles').update({ plan: active ? planForPrice(priceId) : 'free', updated_at: new Date().toISOString() }).eq('id', profile.id);
        await admin.from('subscriptions').upsert({ user_id: profile.id, stripe_subscription_id: subscription.id, status: subscription.status, price_id: priceId, current_period_end: new Date(subscription.current_period_end * 1000).toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'stripe_subscription_id' });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const customer = String(subscription.customer);
      const { data: profile } = await admin.from('profiles').select('id').eq('stripe_customer_id', customer).maybeSingle();
      if (profile) {
        await admin.from('profiles').update({ plan: 'free', updated_at: new Date().toISOString() }).eq('id', profile.id);
        await admin.from('subscriptions').update({ status: subscription.status, updated_at: new Date().toISOString() }).eq('stripe_subscription_id', subscription.id);
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(error);
    return new NextResponse(`Webhook Error: ${error instanceof Error ? error.message : 'invalid event'}`, { status: 400 });
  }
}