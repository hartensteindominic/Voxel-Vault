import { NextResponse } from 'next/server';
import { getStripe } from '../../../../lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');

  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '');

  return new URL(request.url).origin.replace(/\/$/, '');
}

export async function POST(request: Request) {
  try {
    const origin = getOrigin(request);
    let style = 'polished';
    let idea = '';

    try {
      const body = await request.json();
      if (typeof body?.style === 'string') style = body.style.slice(0, 30);
      if (typeof body?.idea === 'string') idea = body.idea.trim().slice(0, 180);
    } catch {}

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      allow_promotion_codes: false,
      billing_address_collection: 'auto',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: 199,
          product_data: {
            name: 'VoxelPop 3D Asset',
            description: 'One custom voxel-style 3D asset with GLB, OBJ and PNG downloads',
          },
        },
      }],
      metadata: {
        product: 'voxelpop-3d-asset',
        style,
        idea,
        generations: '0',
      },
      success_url: `${origin}/pack/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/studio?checkout=cancelled`,
    });

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL');
    }

    return NextResponse.json({ url: session.url }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('creator pack checkout failed', error);
    const message = error instanceof Error ? error.message : 'Unknown checkout error';
    const configurationError = message.includes('STRIPE_SECRET_KEY');

    return NextResponse.json({
      error: configurationError
        ? 'Checkout is not configured on the production server yet.'
        : 'Secure checkout is temporarily unavailable. Please try again.',
    }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
