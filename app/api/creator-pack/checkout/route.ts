import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';

export async function POST(request: Request) {
  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    let style = 'polished';
    try {
      const body = await request.json();
      if (typeof body?.style === 'string') style = body.style.slice(0, 30);
    } catch {}

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: 1500,
          product_data: {
            name: 'Custom AI Voxel Asset Pack — 25 Assets',
            description: 'One custom 25-piece voxel-style PNG pack generated from your words or reference image',
          },
        },
      }],
      metadata: { product: 'ai-voxel-pack-v2', style, generations: '0' },
      success_url: `${origin}/pack/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/studio?checkout=cancelled#make`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('creator pack checkout failed', error);
    return NextResponse.json({ error: 'Secure checkout is temporarily unavailable.' }, { status: 500 });
  }
}
