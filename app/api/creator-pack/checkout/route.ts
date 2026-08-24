import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';

export async function POST(request: Request) {
  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: 1500, product_data: { name: 'Voxel Creator Pack — 36 Editable Assets', description: '36 editable SVG assets, commercial-use license and Facebook ad copy starters' } } }],
      metadata: { product: 'voxel-creator-pack-v1' },
      success_url: `${origin.replace(/\/$/, '')}/pack/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin.replace(/\/$/, '')}/?checkout=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('creator pack checkout failed', error);
    return NextResponse.json({ error: 'Secure checkout is temporarily unavailable.' }, { status: 500 });
  }
}