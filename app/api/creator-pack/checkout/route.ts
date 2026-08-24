import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';

export async function POST(request: Request) {
  try {
    const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
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
          unit_amount: 199,
          product_data: {
            name: 'VoxelPop 3D Asset',
            description: 'One custom voxel-style 3D asset with a downloadable GLB model and source image',
          },
        },
      }],
      metadata: { product: 'voxelpop-3d-asset', style, generations: '0' },
      success_url: `${origin}/pack/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/studio?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('creator pack checkout failed', error);
    return NextResponse.json({ error: 'Secure checkout is temporarily unavailable.' }, { status: 500 });
  }
}
