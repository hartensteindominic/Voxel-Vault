import { NextResponse } from 'next/server';
import { stripe } from '../../../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../../../lib/user-auth';
import { refreshVoxelMakerSubscription } from '../../../../../lib/voxel-maker-subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const record = await refreshVoxelMakerSubscription(auth.user.id);
    if (!record?.stripeCustomerId) {
      return NextResponse.json({ ok: false, error: 'Billing management is not available for this account yet.' }, { status: 409 });
    }
    const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    const session = await stripe.billingPortal.sessions.create({
      customer: record.stripeCustomerId,
      return_url: `${origin}/property`,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    console.error('Voxel Maker billing portal failed', error);
    return NextResponse.json({ ok: false, error: 'Billing management is temporarily unavailable.' }, { status: 500 });
  }
}
