import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import { normalizePropertyDraftId } from '../../../../lib/property-generation-ids';
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

  try {
    const form = await request.formData();
    const draftId = normalizePropertyDraftId(clean(form.get('draftId'), 100));
    const rightsConfirmed = clean(form.get('rightsConfirmed'), 16) === 'true';
    if (!rightsConfirmed) return privateJson({ ok: false, error: 'Confirm that you took this photo or have permission to use it.' }, { status: 400 });

    const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    const email = typeof auth.user.email === 'string' && auth.user.email.includes('@') ? auth.user.email : undefined;
    const checkout = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
          product_data: {
            name: 'VoxelPop 3D Voxel Creation',
            description: 'One custom digital VoxelPop creation with a voxel-style image and interactive 3D model built by Voxel Vault without metered Meshy generation. Digital creation only; no rights in physical real estate.',
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
      },
      success_url: `${origin}/property?generation_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/property?generation_checkout=cancelled&draftId=${encodeURIComponent(draftId)}`,
    });

    if (!checkout.url) throw new Error('Stripe did not return a checkout URL.');
    return privateJson({
      ok: true,
      url: checkout.url,
      priceCents: PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
      priceLabel: PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
      draftId,
      staged: false,
      storage: 'device-local',
      engine: PROPERTY_VOXEL_GENERATION_ENGINE,
    });
  } catch (error) {
    return privateJson({
      ok: false,
      error: error instanceof Error ? error.message : 'VoxelPop checkout could not be opened.',
    }, { status: 500 });
  }
}

// Kept for compatibility with older clients. There is no checkout staging to
// delete in the local engine because the source photo never leaves the device.
export async function DELETE(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });
  return privateJson({ ok: true, deleted: false, storage: 'device-local' });
}
