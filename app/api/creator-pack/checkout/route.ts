import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';
import { cleanAttribution, normalizeFlowId, recordVoxelPopEvent } from '../../../../lib/voxelpop-analytics';

export async function POST(request: Request) {
  try {
    const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    let style = 'polished';
    let flowId: string | null = null;
    let attribution = cleanAttribution(null);
    try {
      const body = await request.json();
      if (typeof body?.style === 'string') style = body.style.slice(0, 30);
      flowId = normalizeFlowId(body?.flowId);
      attribution = cleanAttribution(body?.attribution);
    } catch {}

    const metadata: Record<string, string> = { product: 'voxelpop-3d-asset', style, generations: '0' };
    if (flowId) metadata.flow_id = flowId;
    if (attribution.source) metadata.utm_source = attribution.source;
    if (attribution.medium) metadata.utm_medium = attribution.medium;
    if (attribution.campaign) metadata.utm_campaign = attribution.campaign;
    if (attribution.content) metadata.utm_content = attribution.content;

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
      metadata,
      consent_collection: { promotions: 'auto' },
      after_expiration: { recovery: { enabled: true } },
      success_url: `${origin}/pack/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/studio?checkout=cancelled`,
    });

    await recordVoxelPopEvent({
      eventName: 'checkout_started',
      eventKey: `checkout_started:${session.id}`,
      flowId,
      stripeSessionId: session.id,
      attribution,
      details: { amount_cents: 199, currency: 'usd', recovery_enabled: true },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('creator pack checkout failed', error);
    return NextResponse.json({ error: 'Secure checkout is temporarily unavailable.' }, { status: 500 });
  }
}
