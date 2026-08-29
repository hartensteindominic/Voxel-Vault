import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import { inspectWorldAtlas } from '../../../../lib/world-atlas.js';
import {
  acquirePropertyCollectibleReservation,
  propertyCollectibleIdentity,
  quotePropertyCollectible,
  releasePropertyCollectibleReservation,
  secureStripePropertyCollectiblePurchase,
  updatePropertyCollectibleReservation,
  verifyOwnedFinalVoxelModel,
} from '../../../../lib/property-collectible-commerce';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function findMappedBuilding(atlas: any, atlasId: string) {
  const candidates = [atlas?.selectedBuilding, ...(Array.isArray(atlas?.buildings) ? atlas.buildings : [])].filter(Boolean);
  return candidates.find((item: any) => String(item?.atlasId || '') === atlasId) || null;
}

function paidSuccessUrl(sessionId: string) {
  return `/property/success?session_id=${encodeURIComponent(sessionId)}`;
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  let identityKey = '';
  let reservationCreated = false;
  try {
    const body = await request.json().catch(() => ({}));
    const address = clean(body?.address, 220);
    const atlasId = clean(body?.atlasId, 180);
    const draftId = clean(body?.draftId, 100);
    const modelTaskId = clean(body?.modelTaskId, 260);
    if (!address || !atlasId || !draftId || !modelTaskId) {
      return NextResponse.json({ ok: false, error: 'Finish the voxel and verify its My World location before collection.' }, { status: 400 });
    }

    const atlas = await inspectWorldAtlas({ address, radiusMeters: 180 });
    if (!atlas?.ok) throw new Error(atlas?.error || 'The mapped property reference could not be re-checked before collection.');
    const building = findMappedBuilding(atlas, atlasId);
    if (!building) {
      return NextResponse.json({ ok: false, error: 'The mapped building identity changed or could not be re-verified. No checkout was created.' }, { status: 409 });
    }

    const verifiedModel = await verifyOwnedFinalVoxelModel({ userId: auth.user.id, draftId, modelTaskId, atlasId });
    identityKey = propertyCollectibleIdentity(atlasId);
    const quote = quotePropertyCollectible(building);
    const hold = await acquirePropertyCollectibleReservation({
      identityKey,
      buyerId: auth.user.id,
      atlasId,
      address,
      draftId,
      modelTaskId,
      priceCents: quote.priceCents,
      priceTier: quote.tier,
      priceLabel: quote.label,
      source: 'stripe',
    });

    if (hold.sold) {
      if (hold.reservation?.buyerId === auth.user.id && hold.reservation?.sourceId) {
        try {
          const paidSession = await stripe.checkout.sessions.retrieve(hold.reservation.sourceId);
          if (paidSession.payment_status === 'paid') {
            await secureStripePropertyCollectiblePurchase({ session: paidSession, expectedBuyerId: auth.user.id });
            const successUrl = paidSuccessUrl(paidSession.id);
            return NextResponse.json({ ok: true, paid: true, sessionId: paidSession.id, successUrl, url: successUrl, quote });
          }
        } catch {}
      }
      return NextResponse.json({ ok: false, sold: true, error: 'This mapped digital voxel has already been collected.' }, { status: 409 });
    }
    if (!hold.reservedByYou) {
      return NextResponse.json({ ok: false, reserved: true, error: 'Another checkout is temporarily holding this mapped digital voxel. Try again later.' }, { status: 409 });
    }
    reservationCreated = hold.acquired;

    if (hold.reservation?.state === 'checkout' && hold.reservation.sourceId) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(hold.reservation.sourceId);
        if (existing.payment_status === 'paid') {
          await secureStripePropertyCollectiblePurchase({ session: existing, expectedBuyerId: auth.user.id });
          const successUrl = paidSuccessUrl(existing.id);
          return NextResponse.json({ ok: true, paid: true, sessionId: existing.id, successUrl, url: successUrl, quote });
        }
        if (existing.status === 'open' && existing.url) {
          return NextResponse.json({ ok: true, reused: true, url: existing.url, sessionId: existing.id, quote });
        }
      } catch {}
    }

    const origin = new URL(request.url).origin;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: auth.user.email || undefined,
      client_reference_id: auth.user.id,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: quote.priceCents,
          product_data: {
            name: `VoxelPop Digital Voxel · ${quote.label}`,
            description: verifiedModel.mapBacked
              ? 'One digital VoxelPop collectible using source-backed mapped 3D geometry for this World reference. This checkout does not buy the physical property or create deed/title, rent, investment, occupancy, or appreciation rights.'
              : 'One digital VoxelPop collectible using the completed generated 3D model for this World reference. This checkout does not buy the physical property or create deed/title, rent, investment, occupancy, or appreciation rights.',
          },
        },
      }],
      metadata: {
        kind: 'property_voxel_collectible',
        buyer_id: auth.user.id,
        identity_key: identityKey,
        atlas_id: atlasId,
        draft_id: draftId,
        model_task_id: modelTaskId,
        model_kind: verifiedModel.mapBacked ? 'source_backed_map_3d' : 'generated_glb',
        price_cents: String(quote.priceCents),
        rights: 'digital_only_no_real_property_rights',
        minting: 'optional_after_purchase_and_property_verification',
      },
      payment_intent_data: {
        metadata: {
          kind: 'property_voxel_collectible',
          buyer_id: auth.user.id,
          identity_key: identityKey,
          atlas_id: atlasId,
          price_cents: String(quote.priceCents),
        },
      },
      success_url: `${appUrl}/property/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/property?checkout=cancelled`,
    });

    await updatePropertyCollectibleReservation({
      identityKey,
      buyerId: auth.user.id,
      state: 'checkout',
      source: 'stripe',
      sourceId: session.id,
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      quote,
      modelKind: verifiedModel.mapBacked ? 'source-backed-map-3d' : 'generated-glb',
      disclosure: 'This checkout collects the digital voxel only. Verify & Mint is optional later and does not create deed/title or any other real-property rights.',
    });
  } catch (error) {
    if (reservationCreated && identityKey) {
      try { await releasePropertyCollectibleReservation(identityKey, auth.user.id); } catch {}
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Digital voxel checkout could not be created.' }, { status: 500 });
  }
}
