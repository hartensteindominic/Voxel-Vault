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
          unit_amount: 1197,
          product_data: {
            name: 'VoxelPop 3D Pack — 3 Voxels',
            description: 'Three custom voxel-style PNG sources and three movable GLB meshes generated from your words or reference image',
          },
        },
      }],
      metadata: { product: 'ai-voxel-pack-v3', style, generations: '0' },
      success_url: `${origin}/pack/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled#make`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('creator pack checkout failed', error);
    return NextResponse.json({ error: 'Secure checkout is temporarily unavailable.' }, { status: 500 });
  }
}
