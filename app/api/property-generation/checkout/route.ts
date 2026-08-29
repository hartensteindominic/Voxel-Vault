import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import {
  PROPERTY_VOXEL_GENERATION_KIND,
  PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
  PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
  describePaidPropertyPhoto,
} from '../../../../lib/property-generation-payment';
import {
  MESHY_PROPERTY_CREDITS,
  meshyCreditError,
  meshyCreditsSufficient,
  readMeshyCreditBalance,
} from '../../../../lib/meshy-credits';

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

  const apiKey = process.env.MESHY_API_KEY?.trim();
  if (!apiKey) return privateJson({ ok: false, error: 'VoxelPop enhanced 3D generation is not configured on this deployment.' }, { status: 503 });

  try {
    const form = await request.formData();
    const photo = form.get('photo');
    const draftId = clean(form.get('draftId'), 100);
    const rightsConfirmed = clean(form.get('rightsConfirmed'), 16) === 'true';
    if (!(photo instanceof File)) return privateJson({ ok: false, error: 'Choose a property photo first.' }, { status: 400 });
    if (!rightsConfirmed) return privateJson({ ok: false, error: 'Confirm that you took this photo or have permission to use it.' }, { status: 400 });

    // This route is optional enhanced AI 3D. The default map-voxel path never
    // calls Meshy. For the paid enhancement, never charge unless the provider
    // account can currently afford the complete three-stage generation.
    const balance = await readMeshyCreditBalance(apiKey);
    if (!meshyCreditsSufficient(balance, MESHY_PROPERTY_CREDITS.fullPipeline)) {
      return privateJson(meshyCreditError('opening optional enhanced VoxelPop checkout', MESHY_PROPERTY_CREDITS.fullPipeline), { status: 503 });
    }

    // Hash and validate the source in request memory only. The browser keeps its
    // own copy across Stripe; Voxel Vault does not create or write a checkout
    // Storage bucket, which removes the previous private-storage failure mode.
    const source = await describePaidPropertyPhoto(draftId, photo);
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
            name: 'VoxelPop Enhanced 3D Creation',
            description: 'Optional enhanced AI 3D: source 3D, voxel-style render, and final interactive GLB. Digital creation only; no rights in physical real estate.',
          },
        },
      }],
      client_reference_id: auth.user.id,
      ...(email ? { customer_email: email } : {}),
      metadata: {
        kind: PROPERTY_VOXEL_GENERATION_KIND,
        voxelpop_user_id: auth.user.id,
        draft_id: source.draftId,
        source_sha256: source.digest,
        source_content_type: source.contentType,
        source_name: source.fileName,
        source_size_bytes: String(source.sizeBytes),
        source_storage: 'browser_only_until_payment',
        rights_confirmed: 'true',
        price_cents: String(PROPERTY_VOXEL_GENERATION_PRICE_CENTS),
      },
      success_url: `${origin}/property?generation_session={CHECKOUT_SESSION_ID}&draftId=${encodeURIComponent(source.draftId)}`,
      cancel_url: `${origin}/property?generation_checkout=cancelled&draftId=${encodeURIComponent(source.draftId)}`,
    });

    if (!checkout.url) throw new Error('Stripe did not return a checkout URL.');
    return privateJson({
      ok: true,
      url: checkout.url,
      priceCents: PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
      priceLabel: PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
      draftId: source.draftId,
      photoHeldOnDevice: true,
      serverStaging: false,
    });
  } catch (error) {
    return privateJson({
      ok: false,
      error: error instanceof Error ? error.message : 'VoxelPop checkout could not be opened.',
    }, { status: 500 });
  }
}

// Compatibility endpoint for older clients. There is no server checkout photo
// staging anymore, so cancellation has nothing private to delete on the server.
export async function DELETE(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });
  return privateJson({ ok: true, deleted: false, serverStaging: false });
}
