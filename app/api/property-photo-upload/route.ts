import { NextResponse } from 'next/server';
import { stripe } from '../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../lib/user-auth';
import {
  PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
  PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
  paidPropertyGenerationReceipt,
} from '../../../lib/property-generation-payment';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 260) {
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
  if (auth.ok === false) {
    return privateJson({ ok: false, error: auth.error, setupRequired: auth.setupRequired === true }, { status: auth.status });
  }

  try {
    const form = await request.formData();
    const generationSessionId = clean(form.get('generationSessionId'), 260);
    if (!generationSessionId) {
      return privateJson({
        ok: false,
        paymentRequired: true,
        priceCents: PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
        priceLabel: PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
        checkoutEndpoint: '/api/property-generation/checkout',
        error: `Pay ${PROPERTY_VOXEL_GENERATION_PRICE_LABEL} before VoxelPop unlocks this creation.`,
      }, { status: 402 });
    }

    const receipt = await paidPropertyGenerationReceipt(auth, stripe, generationSessionId);
    return privateJson({
      ok: true,
      paid: true,
      priceCents: PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
      priceLabel: PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
      paymentSessionId: generationSessionId,
      draftId: receipt.draftId,
      engine: receipt.engine,
      identityKey: receipt.identityKey,
      atlasId: receipt.atlasId,
      propertyAddress: receipt.propertyAddress,
      onePropertyOnePurchase: true,
      reference: {
        url: null,
        draftId: receipt.draftId,
        rightsBasis: 'user-owned',
        rightsReference: 'Signed-in Voxel Vault user confirmed they took this photo or have permission to use it for this digital creation.',
        label: 'Selected property photo',
        provider: 'voxelpop-local-webgl-v1',
        storagePath: null,
      },
      privacy: 'Payment is verified without uploading the source photo. The authorized source stays in this browser device storage while VoxelPop builds the image and interactive 3D locally.',
    });
  } catch (error) {
    return privateJson({
      ok: false,
      error: error instanceof Error ? error.message : 'Paid VoxelPop creation could not be verified.',
    }, { status: 400 });
  }
}
