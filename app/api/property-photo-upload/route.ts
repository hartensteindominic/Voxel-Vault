import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { stripe } from '../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../lib/user-auth';
import { readCatalog3D, saveCatalog3D } from '../../../lib/catalog3dStore';
import { propertyDraftItemId } from '../../../lib/property-generation-ids';
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

function generationResult(input: {
  draftId: string;
  digest: string;
  taskId: string;
  status?: string | null;
  progress?: number | null;
  recoveryMode?: boolean;
  reused?: boolean;
  paymentSessionId: string;
}) {
  const uploadedAt = new Date().toISOString();
  const taskId = input.taskId;
  return {
    ok: true,
    paid: true,
    reused: input.reused === true,
    priceCents: PROPERTY_VOXEL_GENERATION_PRICE_CENTS,
    priceLabel: PROPERTY_VOXEL_GENERATION_PRICE_LABEL,
    paymentSessionId: input.paymentSessionId,
    draftId: input.draftId,
    reference: {
      url: null,
      draftId: input.draftId,
      rightsBasis: 'user-owned',
      rightsReference: 'Signed-in Voxel Vault user confirmed they took this photo or have permission to use it for this digital creation.',
      label: 'Selected property photo',
      sourcePhotoId: `upload:${input.digest.slice(0, 20)}`,
      provider: 'user-photo-direct-generation',
      storagePath: `meshy-source:${taskId}`,
      uploadedAt,
    },
    source3d: {
      taskId,
      status: input.status || 'PENDING',
      progress: Number(input.progress || 0),
    },
    recoveryMode: input.recoveryMode === true,
    privacy: 'The selected photo stayed on the customer device through Stripe checkout. After payment, Voxel Vault verifies its SHA-256 fingerprint and sends it directly to the 3D provider for this paid generation. Voxel Vault does not store the original source photo in its Storage bucket for this flow and does not require a private checkout Storage bucket.',
  };
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) {
    return privateJson({ ok: false, error: auth.error, setupRequired: auth.setupRequired === true }, { status: auth.status });
  }

  const apiKey = process.env.MESHY_API_KEY?.trim();
  if (!apiKey) {
    return privateJson({ ok: false, error: 'VoxelPop 3D generation is not configured on this deployment.' }, { status: 503 });
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
        error: `Pay ${PROPERTY_VOXEL_GENERATION_PRICE_LABEL} before VoxelPop starts paid 3D generation.`,
      }, { status: 402 });
    }

    const receipt = await paidPropertyGenerationReceipt(auth, stripe, generationSessionId);
    const draftId = receipt.draftId;
    const digest = receipt.digest;
    const itemId = propertyDraftItemId(auth.user.id, draftId, 'source');
    const sourceFingerprint = `inline-photo:${digest}`;

    // Stripe success pages can be refreshed. Reuse the exact paid account/draft
    // job instead of spending Meshy credits a second time. A refresh therefore
    // does not require the browser-retained source once the first job exists.
    const existing = await readCatalog3D(itemId);
    if (existing?.task_id && existing?.source_image_url === sourceFingerprint) {
      return privateJson(generationResult({
        draftId,
        digest,
        taskId: existing.task_id,
        status: existing.status,
        progress: existing.progress,
        reused: true,
        paymentSessionId: generationSessionId,
      }));
    }

    const photo = form.get('photo');
    if (!(photo instanceof File)) {
      return privateJson({
        ok: false,
        sourcePhotoRequired: true,
        draftId,
        error: 'Payment is verified, but this browser no longer has the selected photo. Re-select the exact same photo to continue; you will not be charged again.',
      }, { status: 409 });
    }
    const contentType = String(photo.type || '').toLowerCase();
    if (!ALLOWED_TYPES.has(contentType) || contentType !== receipt.contentType) {
      return privateJson({ ok: false, error: 'The selected photo format does not match the paid checkout.' }, { status: 415 });
    }
    if (photo.size <= 0 || photo.size > MAX_BYTES || photo.size !== receipt.sizeBytes) {
      return privateJson({ ok: false, error: 'The selected photo size does not match the paid checkout.' }, { status: 400 });
    }

    const bytes = Buffer.from(await photo.arrayBuffer());
    const verifiedDigest = createHash('sha256').update(bytes).digest('hex');
    if (verifiedDigest !== digest) {
      return privateJson({
        ok: false,
        sourcePhotoRequired: true,
        draftId,
        error: 'That is not the same photo used for checkout. Re-select the exact paid photo; you will not be charged again.',
      }, { status: 409 });
    }

    // Read-only provider balance check again after Stripe. This still spends no
    // credits; only the image-to-3D POST below starts the paid provider work.
    const balance = await readMeshyCreditBalance(apiKey);
    if (!meshyCreditsSufficient(balance, MESHY_PROPERTY_CREDITS.fullPipeline)) {
      return privateJson(
        meshyCreditError('starting the complete paid property build', MESHY_PROPERTY_CREDITS.fullPipeline),
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
          `3D provider returned ${response.status}.`,
          'starting the first paid property 3D build',
          MESHY_PROPERTY_CREDITS.source3d,
        ),
        { status: meshyClientStatus(response.status) },
      );
    }

    const providerTaskId = clean(data?.result || data?.id, 240);
    if (!providerTaskId) throw new Error('The 3D provider did not return a task ID.');
    const canonicalTaskId = propertyGenerationCanonicalTaskId(providerTaskId);
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
      started_at: new Date().toISOString(),
      completed_at: null,
      error: null,
    });

    const taskId = saved?.task_id
      || createPropertyGenerationRecoveryTaskId(apiKey, auth.user.id, providerTaskId);

    return privateJson(generationResult({
      draftId,
      digest,
      taskId,
      status: saved?.status || 'PENDING',
      progress: Number(saved?.progress || 0),
      recoveryMode: !saved?.task_id,
      paymentSessionId: generationSessionId,
    }));
  } catch (error) {
    return privateJson({
      ok: false,
      error: error instanceof Error ? error.message : 'Property photo generation handoff failed.',
    }, { status: 400 });
  }
}
