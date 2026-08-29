import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import {
  PROPERTY_VOXEL_GENERATION_KIND,
  PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
  PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
  paidPropertyGenerationReceipt,
  propertyGenerationCheckoutDraft,
} from '../../../../lib/property-generation-payment';

export const runtime = 'nodejs';
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
    const body = await request.json().catch(() => ({}));
    const draftId = propertyGenerationCheckoutDraft(body?.draftId);
    const rightsConfirmed = body?.rightsConfirmed === true;
    if (!rightsConfirmed) {
      return privateJson({ ok: false, error: 'Confirm that you took this photo or have permission to use it.' }, { status: 400 });
    }

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
            name: 'VoxelPop Property Creation',
            description: 'One digital VoxelPop property creation with an on-device voxel preview and source-backed interactive 3D map. No Meshy generation credits are used. No rights in physical real estate.',
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
        creation_engine: 'on_device_voxel_plus_source_backed_3d_map',
        source_photo_storage: 'device_only_not_uploaded_for_creation',
        meshy_credits: '0',
      },
      success_url: `${origin}/property?generation_session={CHECKOUT_SESSION_ID}&draftId=${encodeURIComponent(draftId)}`,
      cancel_url: `${origin}/property?generation_checkout=cancelled&draftId=${encodeURIComponent(draftId)}`,
    });

    if (!checkout.url) throw new Error('Stripe did not return a checkout URL.');
    return privateJson({
      ok: true,
      url: checkout.url,
      draftId,
      priceCents: PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
      priceLabel: PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
      meshyCredits: 0,
      sourcePhotoUploaded: false,
    });
  } catch (error) {
    return privateJson({
      ok: false,
      error: error instanceof Error ? error.message : 'VoxelPop checkout could not be opened.',
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const url = new URL(request.url);
    const sessionId = clean(url.searchParams.get('sessionId'), 260);
    const expectedDraftId = clean(url.searchParams.get('draftId'), 100);
    const receipt = await paidPropertyGenerationReceipt(auth, stripe, sessionId);
    if (expectedDraftId && receipt.draftId !== propertyGenerationCheckoutDraft(expectedDraftId)) {
      return privateJson({ ok: false, error: 'This payment does not match the current VoxelPop creation.' }, { status: 409 });
    }
    return privateJson({
      ok: true,
      paid: true,
      draftId: receipt.draftId,
      priceCents: PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
      priceLabel: PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
      meshyCredits: 0,
      creationEngine: 'on-device-voxel-plus-source-backed-3d-map',
    });
  } catch (error) {
    return privateJson({
      ok: false,
      error: error instanceof Error ? error.message : 'VoxelPop payment could not be verified.',
    }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });
  return privateJson({ ok: true, deleted: false, localOnly: true });
}
