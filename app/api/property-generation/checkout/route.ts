import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import { normalizePropertyDraftId } from '../../../../lib/property-generation-ids';
import { inspectWorldAtlas } from '../../../../lib/world-atlas.js';
import {
  acquirePropertyCollectibleReservation,
  propertyCollectibleIdentity,
  releasePropertyCollectibleReservation,
  updatePropertyCollectibleReservation,
} from '../../../../lib/property-collectible-commerce';
import {
  PROPERTY_VOXEL_GENERATION_ENGINE,
  PROPERTY_VOXEL_GENERATION_KIND,
  PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
  PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
} from '../../../../lib/property-generation-payment';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function privateJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) },
  });
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });

  let identityKey = '';
  let reservationCreated = false;
  try {
    const form = await request.formData();
    const draftId = normalizePropertyDraftId(clean(form.get('draftId'), 100));
    const rightsConfirmed = clean(form.get('rightsConfirmed'), 16) === 'true';
    const address = clean(form.get('address'), 220);
    if (!rightsConfirmed) return privateJson({ ok: false, error: 'Confirm that you took this photo or have permission to use it.' }, { status: 400 });
    if (!address) return privateJson({ ok: false, error: 'Enter the property address so this property can be locked to one purchase and one mint.' }, { status: 400 });

    const atlas = await inspectWorldAtlas({ address, radiusMeters: 180 });
    const selectedBuilding = atlas?.selectedBuilding || null;
    const atlasId = clean(selectedBuilding?.atlasId, 180);
    if (!atlas?.ok || !atlasId) {
      return privateJson({ ok: false, error: 'Voxel Vault could not verify a source-backed building at that address. Check the address before paying.' }, { status: 409 });
    }

    identityKey = propertyCollectibleIdentity(atlasId);
    const hold = await acquirePropertyCollectibleReservation({
      identityKey,
      buyerId: auth.user.id,
      atlasId,
      address: clean(atlas.address || address, 220),
      draftId,
      modelTaskId: draftId,
      priceCents: PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
      priceTier: 'photo-one-of-one',
      priceLabel: 'One-of-One Property Voxel',
      source: 'generation-stripe',
    });

    if (hold.sold) {
      return privateJson({
        ok: false,
        sold: true,
        ownedByYou: hold.reservation?.buyerId === auth.user.id,
        error: hold.reservation?.buyerId === auth.user.id
          ? 'This property has already been purchased by your account. Open it from Vault instead of buying it again.'
          : 'This property has already been purchased. Voxel Vault only allows one collectible purchase per property.',
      }, { status: 409 });
    }
    if (!hold.reservedByYou) {
      return privateJson({ ok: false, reserved: true, error: 'Another checkout is temporarily holding this property. No duplicate purchase was created.' }, { status: 409 });
    }
    reservationCreated = hold.acquired;

    if (hold.reservation?.state === 'checkout' && hold.reservation.sourceId) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(hold.reservation.sourceId);
        if (existing.payment_status === 'paid') {
          return privateJson({
            ok: true,
            paid: true,
            reused: true,
            url: `/property?generation_session=${encodeURIComponent(existing.id)}`,
            sessionId: existing.id,
            identityKey,
            atlasId,
          });
        }
        if (existing.status === 'open' && existing.url) {
          return privateJson({ ok: true, reused: true, url: existing.url, sessionId: existing.id, identityKey, atlasId });
        }
      } catch {}
    }

    const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    const email = typeof auth.user.email === 'string' && auth.user.email.includes('@') ? auth.user.email : undefined;
    const canonicalAddress = clean(atlas.address || address, 220);
    const checkout = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
          product_data: {
            name: 'VoxelPop One-of-One Property Voxel',
            description: 'One custom digital VoxelPop creation from your authorized property photo. The mapped property identity is permanently limited to one purchase and one NFT mint. Digital collectible only; no rights in physical real estate.',
          },
        },
      }],
      client_reference_id: auth.user.id,
      ...(email ? { customer_email: email } : {}),
      metadata: {
        kind: PROPERTY_VOXEL_GENERATION_KIND,
        voxelpop_user_id: auth.user.id,
        draft_id: draftId,
        rights_confirmed: 'true',
        price_cents: String(PROPERTY_VOXEL_GENERATION_PRICE_CENTS),
        generation_engine: PROPERTY_VOXEL_GENERATION_ENGINE,
        source_storage: 'device-local',
        identity_key: identityKey,
        atlas_id: atlasId,
        property_address: canonicalAddress,
        one_property_one_purchase: 'true',
      },
      payment_intent_data: {
        metadata: {
          kind: PROPERTY_VOXEL_GENERATION_KIND,
          voxelpop_user_id: auth.user.id,
          identity_key: identityKey,
          atlas_id: atlasId,
          one_property_one_purchase: 'true',
        },
      },
      success_url: `${origin}/property?generation_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/property?generation_checkout=cancelled&draftId=${encodeURIComponent(draftId)}`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    if (!checkout.url) throw new Error('Stripe did not return a checkout URL.');
    await updatePropertyCollectibleReservation({
      identityKey,
      buyerId: auth.user.id,
      state: 'checkout',
      source: 'generation-stripe',
      sourceId: checkout.id,
    });

    return privateJson({
      ok: true,
      url: checkout.url,
      sessionId: checkout.id,
      priceCents: PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
      priceLabel: PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
      draftId,
      identityKey,
      atlasId,
      propertyAddress: canonicalAddress,
      onePropertyOnePurchase: true,
      staged: false,
      storage: 'device-local',
      engine: PROPERTY_VOXEL_GENERATION_ENGINE,
    });
  } catch (error) {
    if (reservationCreated && identityKey) {
      try { await releasePropertyCollectibleReservation(identityKey, auth.user.id); } catch {}
    }
    return privateJson({
      ok: false,
      error: error instanceof Error ? error.message : 'VoxelPop checkout could not be opened.',
    }, { status: 500 });
  }
}

// Kept for compatibility with older clients. There is no photo staging to
// delete because the source photo never leaves the device. Once a checkout is
// paid, its canonical property reservation remains permanent by design.
export async function DELETE(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });
  return privateJson({ ok: true, deleted: false, storage: 'device-local' });
}
