import { Buffer } from 'node:buffer';
import { createHash, createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { stripe } from '../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../lib/user-auth';
import {
  PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
  PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
  paidPropertyGenerationReceipt,
} from '../../../lib/property-generation-payment';
import {
  MESHY_PROPERTY_CREDITS,
  meshyClientStatus,
  meshyCreditError,
  meshyCreditsSufficient,
  meshyProviderFailure,
  readMeshyCreditBalance,
} from '../../../lib/meshy-credits';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const IMAGE_ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-image';
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function clean(value: unknown, max = 260) {
  return String(value || '').trim().slice(0, max);
}

function taskToken(apiKey: string, userId: string, taskId: string) {
  return createHmac('sha256', apiKey).update(`property-voxel-image-v1:${userId}:${taskId}`).digest('hex');
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
    const photo = form.get('photo');

    // The checkout return first calls this route without a file so the browser can
    // recover the paid draft ID and reopen the source photo kept in IndexedDB.
    if (!(photo instanceof File)) {
      return privateJson({
        ok: true,
        paid: true,
        priceCents: PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
        priceLabel: PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
        paymentSessionId: generationSessionId,
        draftId: receipt.draftId,
        engine: 'voxelpop-direct-photo-voxel-v1',
        identityKey: receipt.identityKey,
        atlasId: receipt.atlasId,
        propertyAddress: receipt.propertyAddress,
        onePropertyOnePurchase: true,
        onePropertyOneMint: true,
        privacy: 'Payment was verified. Voxel Vault has not uploaded the source photo yet.',
      });
    }

    const rightsConfirmed = clean(form.get('rightsConfirmed'), 16) === 'true';
    if (!rightsConfirmed) {
      return privateJson({ ok: false, error: 'Confirm that you took this photo or have permission to use it.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(String(photo.type || '').toLowerCase())) {
      return privateJson({ ok: false, error: 'Use a JPG, PNG, or WebP property photo.' }, { status: 415 });
    }
    if (photo.size <= 0 || photo.size > MAX_BYTES) {
      return privateJson({ ok: false, error: 'Property photos must be smaller than 8 MB after preparation.' }, { status: 413 });
    }

    const apiKey = process.env.MESHY_API_KEY?.trim();
    if (!apiKey) {
      return privateJson({ ok: false, error: 'VoxelPop image generation is not configured on this deployment.' }, { status: 503 });
    }

    // Direct flow: voxel image (3 credits) + final 3D (15). It intentionally
    // skips the older generic source-3D pass so the product is exactly
    // photo -> voxel image -> 3D voxel.
    const balance = await readMeshyCreditBalance(apiKey);
    if (!meshyCreditsSufficient(balance, MESHY_PROPERTY_CREDITS.afterSource)) {
      return privateJson(
        meshyCreditError('starting the VoxelPop image and final 3D build', MESHY_PROPERTY_CREDITS.afterSource),
        { status: 503 },
      );
    }

    const bytes = Buffer.from(await photo.arrayBuffer());
    const digest = createHash('sha256').update(bytes).digest('hex');
    const dataUri = `data:${photo.type};base64,${bytes.toString('base64')}`;
    const address = clean(receipt.propertyAddress, 220);
    const prompt = [
      `Create a faithful VoxelPop-style voxel architectural image of the exact house shown in this uploaded photo${address ? ` at ${address}` : ''}.`,
      'Preserve the visible building identity, massing, roof shape and roofline, facade proportions, window and door placement, steps, trim, major openings, material colors, and other obvious permanent details visible in the source photo.',
      'Do not redesign, beautify, modernize, add floors, remove floors, invent windows, move doors, change the roof type, or substitute a generic house.',
      'Translate the same house into crisp premium block geometry with small readable voxel details and believable voxel materials.',
      'Keep the camera composition close to the source image and keep the ground and surroundings simple and secondary.',
      'No text, labels, logos, watermarks, UI, borders, people, vehicles, or fantasy additions.',
      'This is a digital voxel interpretation of the authorized photo, not a survey, deed, appraisal, or claim of hidden-side accuracy.',
    ].join(' ');

    const create = await fetch(IMAGE_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ai_model: 'nano-banana',
        prompt,
        reference_image_urls: [dataUri],
        aspect_ratio: '1:1',
        remove_background: false,
      }),
      cache: 'no-store',
    });
    const created = await create.json().catch(() => ({}));
    if (!create.ok) {
      return privateJson(
        meshyProviderFailure(
          create.status,
          created,
          `Voxel image provider returned ${create.status}.`,
          'starting the VoxelPop image pass',
          MESHY_PROPERTY_CREDITS.voxelImage,
        ),
        { status: meshyClientStatus(create.status) },
      );
    }

    const taskId = clean(created?.result || created?.id, 240);
    if (!taskId) throw new Error('The voxel image provider did not return a task ID.');

    return privateJson({
      ok: true,
      paid: true,
      draftId: receipt.draftId,
      paymentSessionId: generationSessionId,
      propertyAddress: receipt.propertyAddress,
      identityKey: receipt.identityKey,
      atlasId: receipt.atlasId,
      onePropertyOnePurchase: true,
      onePropertyOneMint: true,
      sourcePhotoId: `upload:${digest.slice(0, 20)}`,
      voxelImage: {
        status: 'PENDING',
        progress: 0,
        taskId,
        taskToken: taskToken(apiKey, auth.user.id, taskId),
      },
      privacy: 'The authorized source photo was sent directly to the image-generation provider for this one creation. Voxel Vault keeps no server-side copy of the original photo in this flow.',
    });
  } catch (error) {
    return privateJson({
      ok: false,
      error: error instanceof Error ? error.message : 'Paid VoxelPop creation could not be started.',
    }, { status: 400 });
  }
}
