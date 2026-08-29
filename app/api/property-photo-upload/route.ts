import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { stripe } from '../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../lib/user-auth';
import { readCatalog3D, saveCatalog3D } from '../../../lib/catalog3dStore';
import { normalizePropertyDraftId, propertyDraftItemId } from '../../../lib/property-generation-ids';
import {
  createPropertyGenerationRecoveryTaskId,
  propertyGenerationCanonicalTaskId,
} from '../../../lib/property-generation-task';
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

const ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function clean(value: unknown, max = 260) {
  return String(value || '').trim().slice(0, max);
}

function privateJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) },
  });
}

function paidReceiptResponse(receipt: any, generationSessionId: string) {
  return {
    ok: true,
    paid: true,
    verifiedOnly: true,
    priceCents: PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
    priceLabel: PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
    paymentSessionId: generationSessionId,
    draftId: receipt.draftId,
    engine: receipt.engine,
    legacyReceipt: receipt.legacyMode === true,
  };
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
        error: `Pay ${PROPERTY_VOXEL_GENERATION_PRICE_LABEL} before VoxelPop starts the generated 3D house.`,
      }, { status: 402 });
    }

    const receipt = await paidPropertyGenerationReceipt(auth, stripe, generationSessionId);
    const photo = form.get('photo');
    if (!(photo instanceof File)) return privateJson(paidReceiptResponse(receipt, generationSessionId));

    const apiKey = process.env.MESHY_API_KEY?.trim();
    if (!apiKey) {
      return privateJson({ ok: false, error: 'VoxelPop 3D house generation is not configured on this deployment.' }, { status: 503 });
    }

    const submittedDraftId = normalizePropertyDraftId(clean(form.get('draftId'), 100));
    const rightsConfirmed = clean(form.get('rightsConfirmed'), 16) === 'true';
    if (receipt.draftId !== submittedDraftId) {
      return privateJson({ ok: false, error: 'This paid VoxelPop session does not match the selected house creation.' }, { status: 403 });
    }
    if (!rightsConfirmed) {
      return privateJson({ ok: false, error: 'Confirm that you took this photo or have permission to use it.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(String(photo.type || '').toLowerCase())) {
      return privateJson({ ok: false, error: 'Use a JPG, PNG, or WebP property photo.' }, { status: 415 });
    }
    if (photo.size <= 0 || photo.size > MAX_BYTES) {
      return privateJson({ ok: false, error: 'Property photos must be smaller than 8 MB after preparation.' }, { status: 413 });
    }

    const bytes = Buffer.from(await photo.arrayBuffer());
    const digest = createHash('sha256').update(bytes).digest('hex');
    const sourceFingerprint = `inline-photo:${digest}`;
    const itemId = propertyDraftItemId(auth.user.id, submittedDraftId, 'source');
    const existing = await readCatalog3D(itemId);
    if (existing?.task_id && clean(existing.source_image_url, 180) === sourceFingerprint) {
      return privateJson({
        ...paidReceiptResponse(receipt, generationSessionId),
        verifiedOnly: false,
        reused: true,
        source3d: {
          taskId: existing.task_id,
          status: existing.status || 'PENDING',
          progress: Number(existing.progress || 0),
          modelUrl: null,
        },
        reference: {
          url: null,
          draftId: submittedDraftId,
          rightsBasis: 'user-owned',
          label: 'Selected property photo',
          sourcePhotoId: `upload:${digest.slice(0, 20)}`,
          provider: 'user-photo-direct-generation',
          storagePath: `meshy-source:${existing.task_id}`,
        },
      });
    }
    if (existing?.task_id && !['FAILED', 'EXPIRED', 'CANCELED', 'CANCELLED'].includes(String(existing.status || '').toUpperCase())) {
      return privateJson({
        ok: false,
        generationAlreadyStarted: true,
        error: 'This paid creation already has a generated 3D house job. Finish or approve that house before starting a different paid creation.',
      }, { status: 409 });
    }

    const balance = await readMeshyCreditBalance(apiKey);
    if (!meshyCreditsSufficient(balance, MESHY_PROPERTY_CREDITS.source3d)) {
      return privateJson(
        meshyCreditError('starting the generated 3D house preview', MESHY_PROPERTY_CREDITS.source3d),
        { status: 503 },
      );
    }

    const dataUri = `data:${photo.type};base64,${bytes.toString('base64')}`;
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: dataUri,
        model_type: 'smart-topology',
        ai_model: 'meshy-t2',
        target_polycount: 15000,
        should_texture: true,
        enable_pbr: true,
        texture_resolution: '2k',
        target_formats: ['glb'],
      }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return privateJson(
        meshyProviderFailure(
          response.status,
          data,
          `3D house provider returned ${response.status}.`,
          'starting the generated 3D house preview',
          MESHY_PROPERTY_CREDITS.source3d,
        ),
        { status: meshyClientStatus(response.status) },
      );
    }

    const providerTaskId = clean(data?.result || data?.id, 240);
    if (!providerTaskId) throw new Error('The 3D house provider did not return a task ID.');
    const canonicalTaskId = propertyGenerationCanonicalTaskId(providerTaskId);
    const now = new Date().toISOString();
    const saved = await saveCatalog3D(itemId, {
      task_id: canonicalTaskId,
      source_image_url: sourceFingerprint,
      source_image_urls: [sourceFingerprint],
      provider: 'meshy-property-direct-photo-to-3d',
      status: 'PENDING',
      progress: 0,
      model_url: null,
      model_storage_path: null,
      thumbnail_url: null,
      exact_model_approved: false,
      started_at: now,
      completed_at: null,
      error: null,
    });

    const taskId = saved?.task_id
      || createPropertyGenerationRecoveryTaskId(apiKey, auth.user.id, providerTaskId);

    return privateJson({
      ...paidReceiptResponse(receipt, generationSessionId),
      verifiedOnly: false,
      reused: false,
      reference: {
        url: null,
        draftId: submittedDraftId,
        rightsBasis: 'user-owned',
        rightsReference: 'Signed-in Voxel Vault user confirmed they took this photo or have permission to use it for this digital creation.',
        label: 'Selected property photo',
        sourcePhotoId: `upload:${digest.slice(0, 20)}`,
        provider: 'user-photo-direct-generation',
        storagePath: `meshy-source:${taskId}`,
        uploadedAt: now,
      },
      source3d: {
        taskId,
        status: saved?.status || 'PENDING',
        progress: Number(saved?.progress || 0),
        modelUrl: null,
      },
      recoveryMode: !saved?.task_id,
      privacy: 'Voxel Vault does not store the original source photo in its Storage bucket for this flow. After payment and permission are verified, the authorized photo is sent directly to the private 3D generation provider for this house build; Voxel Vault retains only a fingerprint and account-bound job record.',
    });
  } catch (error) {
    return privateJson({
      ok: false,
      error: error instanceof Error ? error.message : 'Paid VoxelPop 3D house generation could not start.',
    }, { status: 400 });
  }
}
