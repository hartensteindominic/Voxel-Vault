import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import {
  PROPERTY_VOXEL_GENERATION_KIND,
  PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
  PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
  preparePropertyGenerationCheckoutPhoto,
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
  if (!apiKey) return privateJson({ ok: false, error: 'VoxelPop 3D generation is not configured on this deployment.' }, { status: 503 });

  try {
    const form = await request.formData();
    const rightsConfirmed = clean(form.get('rightsConfirmed'), 16) === 'true';
    if (!rightsConfirmed) return privateJson({ ok: false, error: 'Confirm that you took this photo or have permission to use it.' }, { status: 400 });

    const prepared = preparePropertyGenerationCheckoutPhoto({
      draftId: form.get('draftId'),
      digest: form.get('sourceSha256'),
      contentType: form.get('sourceContentType'),
      fileName: form.get('sourceName'),
      sizeBytes: form.get('sourceSizeBytes'),
    });

    // This is a read-only provider balance check. It does not start a Meshy task
    // or spend credits. Do not charge a customer unless the service can afford
    // the complete automatic source-3D -> voxel-image -> final-3D flow.
    const balance = await readMeshyCreditBalance(apiKey);
    if (!meshyCreditsSufficient(balance, MESHY_PROPERTY_CREDITS.fullPipeline)) {
      return privateJson(meshyCreditError('opening VoxelPop checkout', MESHY_PROPERTY_CREDITS.fullPipeline), { status: 503 });
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
            name: 'VoxelPop 3D Voxel Creation',
            description: 'One custom digital VoxelPop creation: source 3D, voxel-style render, and final interactive 3D GLB. Digital creation only; no rights in physical real estate.',
          },
        },
      }],
      client_reference_id: auth.user.id,
      ...(email ? { customer_email: email } : {}),
      metadata: {
        kind: PROPERTY_VOXEL_GENERATION_KIND,
        voxelpop_user_id: auth.user.id,
        draft_id: prepared.draftId,
        source_sha256: prepared.digest,
        source_content_type: prepared.contentType,
        source_name: prepared.fileName,
        source_size_bytes: String(prepared.sizeBytes),
        source_retention: 'browser_indexeddb_until_paid_handoff',
        rights_confirmed: 'true',
        price_cents: String(PROPERTY_VOXEL_GENERATION_PRICE_CENTS),
      },
      success_url: `${origin}/property?generation_session={CHECKOUT_SESSION_ID}&draftId=${encodeURIComponent(prepared.draftId)}`,
      cancel_url: `${origin}/property?generation_checkout=cancelled&draftId=${encodeURIComponent(prepared.draftId)}`,
    });

    if (!checkout.url) throw new Error('Stripe did not return a checkout URL.');
    return privateJson({
      ok: true,
      url: checkout.url,
      priceCents: PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
      priceLabel: PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
      draftId: prepared.draftId,
      sourceDigest: prepared.digest,
      retainedOnDevice: true,
    });
  } catch (error) {
    return privateJson({
      ok: false,
      error: error instanceof Error ? error.message : 'VoxelPop checkout could not be opened.',
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });
  return privateJson({ ok: true, deleted: false, localOnly: true });
}
