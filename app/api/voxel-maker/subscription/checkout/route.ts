import { NextResponse } from 'next/server';
import { stripe } from '../../../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../../../lib/user-auth';
import { beginVoxelMakerCheckout, getVoxelMakerEntitlement } from '../../../../../lib/voxel-maker-subscriptions';
import { voxelMakerPlan } from '../../../../../lib/voxel-maker-plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const plan = voxelMakerPlan(body?.planId);
    if (!plan) return NextResponse.json({ ok: false, error: 'Choose a valid Voxel Maker plan.' }, { status: 400 });

    const current = await getVoxelMakerEntitlement(auth.user.id);
    if (current.active) {
      return NextResponse.json({ ok: false, active: true, plan: current.plan, error: 'You already have an active Voxel Maker subscription. Manage billing to change or cancel it.' }, { status: 409 });
    }

    const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    const email = typeof auth.user.email === 'string' && auth.user.email.includes('@') ? auth.user.email : undefined;
    const metadata = {
      kind: 'voxel_maker_subscription',
      plan_id: plan.id,
      voxelpop_user_id: auth.user.id,
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: auth.user.id,
      ...(email ? { customer_email: email } : {}),
      allow_promotion_codes: true,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: plan.priceCents,
          recurring: { interval: 'month' },
          product_data: {
            name: `Voxel Maker ${plan.name}`,
            description: `${plan.monthlyVoxels} house-to-voxel creations each month, saved to Voxel Vault inventory.`,
          },
        },
      }],
      metadata,
      subscription_data: { metadata },
      success_url: `${origin}/property?subscription=success`,
      cancel_url: `${origin}/property?subscription=cancelled`,
    });

    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    await beginVoxelMakerCheckout({ userId: auth.user.id, planId: plan.id, checkoutSessionId: session.id });
    return NextResponse.json({ ok: true, url: session.url, plan });
  } catch (error) {
    console.error('Voxel Maker subscription checkout failed', error);
    return NextResponse.json({ ok: false, error: 'Subscription checkout is temporarily unavailable.' }, { status: 500 });
  }
}
