import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../lib/user-auth';
import { saveCatalog3D } from '../../../lib/catalog3dStore';
import { normalizePropertyDraftId, propertyDraftItemId } from '../../../lib/property-generation-ids';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SAVE_ATTEMPTS = 3;

function clean(value: unknown, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function taskKey(raw: string) {
  return raw.startsWith('property-voxel:task:') ? raw : `property-voxel:task:${raw}`;
}

function privateJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) },
  });
}

async function saveGenerationRecord(itemId: string, patch: Record<string, unknown>) {
  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
    const saved = await saveCatalog3D(itemId, patch);
    if (saved?.item_id) return saved;
    if (attempt + 1 < SAVE_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, 80 * (attempt + 1)));
    }
  }
  return null;
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
    const photo = form.get('photo');
    const draftId = normalizePropertyDraftId(clean(form.get('draftId'), 100));
    const rightsConfirmed = clean(form.get('rightsConfirmed'), 16) === 'true';

    if (!(photo instanceof File)) {
      return privateJson({ ok: false, error: 'Choose a property photo first.' }, { status: 400 });
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
    const dataUri = `data:${photo.type};base64,${bytes.toString('base64')}`;
    const itemId = propertyDraftItemId(auth.user.id, draftId, 'source');
    const sourceFingerprint = `inline-photo:${digest}`;
    const startedAt = new Date().toISOString();
    const baseRecord = {
      source_image_url: sourceFingerprint,
      source_image_urls: [sourceFingerprint],
      provider: 'meshy-property-direct-photo-to-3d',
      progress: 0,
      model_url: null,
      model_storage_path: null,
      thumbnail_url: null,
      exact_model_approved: false,
      started_at: startedAt,
      completed_at: null,
      error: null,
    };

    // Prove that this signed-in account has a durable generation record before
    // Meshy is allowed to start. This prevents paid/provider jobs from becoming
    // orphaned when Supabase is temporarily unavailable or schema cache is stale.
    const provisional = await saveGenerationRecord(itemId, {
      ...baseRecord,
      task_id: null,
      status: 'STARTING',
    });
    if (!provisional?.item_id) {
      return privateJson({
        ok: false,
        setupRequired: true,
        error: 'VoxelPop cannot save generation records right now, so no 3D job was started. Please try again shortly.',
      }, { status: 503 });
    }

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
      const providerError = data?.task_error?.message || data?.message || data?.error || `3D provider returned ${response.status}.`;
      await saveGenerationRecord(itemId, {
        ...baseRecord,
        task_id: null,
        status: 'FAILED',
        completed_at: new Date().toISOString(),
        error: providerError,
      });
      return privateJson({ ok: false, error: providerError }, { status: response.status });
    }

    const providerTaskId = clean(data?.result || data?.id, 240);
    if (!providerTaskId) throw new Error('The 3D provider did not return a task ID.');
    const taskId = taskKey(providerTaskId);
    const saved = await saveGenerationRecord(itemId, {
      ...baseRecord,
      task_id: taskId,
      status: 'PENDING',
    });
    if (!saved?.task_id) {
      return privateJson({
        ok: false,
        setupRequired: true,
        error: 'VoxelPop started the 3D job but could not attach its task ID to your account after retrying. Please try again shortly.',
      }, { status: 503 });
    }

    const uploadedAt = new Date().toISOString();
    return privateJson({
      ok: true,
      draftId,
      reference: {
        url: null,
        rightsBasis: 'user-owned',
        rightsReference: 'Signed-in Voxel Vault user confirmed they took this photo or have permission to use it for this digital creation.',
        label: 'Selected property photo',
        sourcePhotoId: `upload:${digest.slice(0, 20)}`,
        provider: 'user-photo-direct-generation',
        storagePath: `meshy-source:${taskId}`,
        uploadedAt,
      },
      source3d: {
        taskId,
        status: saved.status || 'PENDING',
        progress: Number(saved.progress || 0),
      },
      privacy: 'Voxel Vault does not store the original source photo in its Storage bucket for this flow. The authorized photo is sent directly to the 3D provider for this generation request; only a SHA-256 fingerprint and account-bound job record are retained by Voxel Vault.',
    });
  } catch (error) {
    return privateJson({
      ok: false,
      error: error instanceof Error ? error.message : 'Property photo generation handoff failed.',
    }, { status: 400 });
  }
}
