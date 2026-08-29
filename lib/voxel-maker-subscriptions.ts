import type Stripe from 'stripe';
import { getSupabaseAdmin } from './supabase-admin';
import { stripe } from './stripe-server';
import { voxelMakerPlan, type VoxelMakerPlanId } from './voxel-maker-plans';

const SUBSCRIPTION_PROVIDER = 'voxel-maker-subscription';
const GENERATION_PROVIDER = 'voxel-maker-generation';

export type VoxelMakerSubscriptionRecord = {
  userId: string;
  planId: VoxelMakerPlanId;
  status: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeCheckoutSessionId?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  updatedAt: string;
};

function clean(value: unknown, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function activeStatus(status: unknown) {
  return status === 'active' || status === 'trialing';
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const unix = Number((subscription as any)?.current_period_end || 0);
  return Number.isFinite(unix) && unix > 0 ? new Date(unix * 1000).toISOString() : null;
}

function decodeRecord(userId: string, row: any): VoxelMakerSubscriptionRecord | null {
  if (!row?.event_type) return null;
  try {
    const parsed = JSON.parse(String(row.event_type));
    const plan = voxelMakerPlan(parsed?.planId);
    if (!plan) return null;
    return {
      userId,
      planId: plan.id,
      status: clean(parsed?.status, 40) || 'unknown',
      stripeCustomerId: clean(parsed?.stripeCustomerId, 160) || undefined,
      stripeSubscriptionId: clean(parsed?.stripeSubscriptionId, 160) || undefined,
      stripeCheckoutSessionId: clean(parsed?.stripeCheckoutSessionId, 160) || undefined,
      cancelAtPeriodEnd: Boolean(parsed?.cancelAtPeriodEnd),
      currentPeriodEnd: clean(parsed?.currentPeriodEnd, 80) || null,
      updatedAt: clean(parsed?.updatedAt, 80) || String(row.processed_at || ''),
    };
  } catch {
    return null;
  }
}

export async function readVoxelMakerSubscription(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('commerce_webhook_events')
    .select('event_type,processed_at')
    .eq('provider', SUBSCRIPTION_PROVIDER)
    .eq('event_id', userId)
    .maybeSingle();
  if (error) throw error;
  return decodeRecord(userId, data);
}

export async function writeVoxelMakerSubscription(record: VoxelMakerSubscriptionRecord) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const payload = { ...record, updatedAt: now };
  const { error } = await supabase.from('commerce_webhook_events').upsert({
    provider: SUBSCRIPTION_PROVIDER,
    event_id: record.userId,
    event_type: JSON.stringify(payload),
    processed_at: now,
  }, { onConflict: 'provider,event_id' });
  if (error) throw error;
  return payload;
}

export async function beginVoxelMakerCheckout(input: {
  userId: string;
  planId: VoxelMakerPlanId;
  checkoutSessionId: string;
}) {
  const current = await readVoxelMakerSubscription(input.userId);
  return writeVoxelMakerSubscription({
    userId: input.userId,
    planId: input.planId,
    status: current && activeStatus(current.status) ? current.status : 'checkout_pending',
    stripeCustomerId: current?.stripeCustomerId,
    stripeSubscriptionId: current?.stripeSubscriptionId,
    stripeCheckoutSessionId: input.checkoutSessionId,
    cancelAtPeriodEnd: current?.cancelAtPeriodEnd || false,
    currentPeriodEnd: current?.currentPeriodEnd || null,
    updatedAt: new Date().toISOString(),
  });
}

async function recordFromStripeSubscription(userId: string, subscription: Stripe.Subscription, fallback?: VoxelMakerSubscriptionRecord | null) {
  const plan = voxelMakerPlan(subscription.metadata?.plan_id || fallback?.planId);
  if (!plan) throw new Error('Voxel Maker subscription plan metadata is missing.');
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  return writeVoxelMakerSubscription({
    userId,
    planId: plan.id,
    status: subscription.status,
    stripeCustomerId: customerId || fallback?.stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    stripeCheckoutSessionId: fallback?.stripeCheckoutSessionId,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    currentPeriodEnd: subscriptionPeriodEnd(subscription),
    updatedAt: new Date().toISOString(),
  });
}

export async function refreshVoxelMakerSubscription(userId: string) {
  let record = await readVoxelMakerSubscription(userId);
  if (!record) return null;

  try {
    if (record.stripeSubscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(record.stripeSubscriptionId);
      return await recordFromStripeSubscription(userId, subscription, record);
    }

    if (record.stripeCheckoutSessionId) {
      const checkout = await stripe.checkout.sessions.retrieve(record.stripeCheckoutSessionId);
      const checkoutUser = clean(checkout.client_reference_id || checkout.metadata?.voxelpop_user_id, 100);
      if (checkoutUser !== userId) return record;
      const subscriptionId = typeof checkout.subscription === 'string' ? checkout.subscription : checkout.subscription?.id;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        return await recordFromStripeSubscription(userId, subscription, record);
      }
    }
  } catch (error) {
    console.warn('Voxel Maker subscription refresh failed', error);
  }

  return record;
}

export async function getVoxelMakerEntitlement(userId: string) {
  const record = await refreshVoxelMakerSubscription(userId);
  const plan = record ? voxelMakerPlan(record.planId) : null;
  return {
    active: Boolean(record && plan && activeStatus(record.status)),
    record,
    plan,
  };
}

function monthStartIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString();
}

export async function countVoxelMakerGenerations(userId: string) {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from('commerce_webhook_events')
    .select('event_id', { count: 'exact', head: true })
    .eq('provider', GENERATION_PROVIDER)
    .like('event_id', `${userId}:%`)
    .gte('processed_at', monthStartIso());
  if (error) throw error;
  return Math.max(0, Number(count || 0));
}

export async function registerVoxelMakerGeneration(input: { userId: string; draftId: string; planId: VoxelMakerPlanId; address?: string }) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const eventId = `${input.userId}:${clean(input.draftId, 120)}`;
  const { error } = await supabase.from('commerce_webhook_events').upsert({
    provider: GENERATION_PROVIDER,
    event_id: eventId,
    event_type: JSON.stringify({ userId: input.userId, draftId: input.draftId, planId: input.planId, address: clean(input.address, 220) || null }),
    processed_at: now,
  }, { onConflict: 'provider,event_id', ignoreDuplicates: true });
  if (error) throw error;
}
