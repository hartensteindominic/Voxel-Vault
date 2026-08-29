import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../lib/user-auth';
import {
  createModelSignedUrl,
  persistModelBinary,
  readCatalog3D,
  readCatalog3DByTask,
  saveCatalog3D,
} from '../../../lib/catalog3dStore';
import {
  normalizePropertyDraftId,
  normalizePropertyGenerationPhase,
  propertyDraftItemId,
  propertyGenerationItemBelongsToUser,
  propertyLegacyItemId,
} from '../../../lib/property-generation-ids';
import {
  createPropertyGenerationRecoveryTaskId,
  propertyGenerationCanonicalTaskId,
  propertyGenerationProviderTaskId,
  verifyPropertyGenerationRecoveryTaskId,
} from '../../../lib/property-generation-task';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const IMAGE_ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-image';
const SYSTEM_BUCKET = 'voxel-system';

function clean(value: unknown, max = 1200) {
  return String(value || '').trim().slice(0, max);
}

function cleanAtlasId(input: unknown) {
  const value = clean(input, 180);
  if (!value || !/^[a-zA-Z0-9:._-]+$/.test(value)) throw new Error('A valid mapped property is required.');
  return value;
}

function safeSegment(value: unknown, fallback = 'property') {
  const text = clean(value, 180).replace(/[^a-zA-Z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '');
  return text || fallback;
}

function isHttpUrl(value: unknown) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function voxelImageTaskToken(apiKey: string, userId: string, taskId: string) {
  return createHmac('sha256', apiKey).update(`property-voxel-image-v1:${userId}:${taskId}`).digest('hex');
}

async function displayUrlFor(saved: any) {
  if (saved?.model_storage_path) {
    const signed = await createModelSignedUrl(saved.model_storage_path, 60 * 60);
    if (signed) return signed;
  }
  return saved?.model_url || null;
}

function publicState(saved: any, displayModelUrl: string | null = null) {
  return {
    itemId: saved?.item_id || null,
    taskId: saved?.task_id || null,
    status: saved?.status || 'NOT_STARTED',
    progress: Number(saved?.progress || 0),
    modelUrl: displayModelUrl,
    thumbnailUrl: saved?.thumbnail_url || null,
    error: saved?.error || null,
  };
}

function privateJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) },
  });
}

async function sourcePhotoUrl(auth: any, draftId: string, storagePathRaw: unknown) {
  const storagePath = clean(storagePathRaw, 900);
  const userId = safeSegment(auth.user.id, 'user');
  const expectedPrefix = `property-references/${userId}/${safeSegment(draftId)}/`;
  if (!storagePath.startsWith(expectedPrefix)) throw new Error('That private photo does not belong to this signed-in creation.');
  const signed = await auth.admin.storage.from(SYSTEM_BUCKET).createSignedUrl(storagePath, 60 * 60);
  if (signed.error || !signed.data?.signedUrl) throw new Error('The private property photo could not be opened for 3D generation.');
  return signed.data.signedUrl;
}

async function verifiedVoxelImageUrl(apiKey: string, userId: string, taskIdRaw: unknown, taskTokenRaw: unknown) {
  const taskId = clean(taskIdRaw, 240);
  const suppliedToken = clean(taskTokenRaw, 128);
  if (!taskId || suppliedToken !== voxelImageTaskToken(apiKey, userId, taskId)) {
    throw new Error('That voxel image job does not belong to this signed-in account.');
  }
  const response = await fetch(`${IMAGE_ENDPOINT}/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });
  const task = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(task?.message || task?.error || 'The voxel image job could not be verified.');
  if (String(task?.status || '').toUpperCase() !== 'SUCCEEDED') throw new Error('Finish the voxel image before building the final 3D collectible.');
  const imageUrl = Array.isArray(task?.image_urls) ? clean(task.image_urls[0], 2200) : '';
  if (!isHttpUrl(imageUrl)) throw new Error('The completed voxel image is unavailable.');
  return imageUrl;
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });
  const apiKey = process.env.MESHY_API_KEY?.trim();
  if (!apiKey) return privateJson({ ok: false, error: 'Property 3D generation is not configured on this deployment.' }, { status: 503 });

  try {
    const body = await request.json().catch(() => ({}));
    const draftIdRaw = clean(body?.draftId, 100);
    const atlasIdRaw = clean(body?.atlasId, 180);
    let itemId = '';
    let imageUrl = '';
    let provider = 'meshy-property-voxel-image-to-3d';

    if (draftIdRaw) {
      const draftId = normalizePropertyDraftId(draftIdRaw);
      const phase = normalizePropertyGenerationPhase(body?.phase);
      itemId = propertyDraftItemId(auth.user.id, draftId, phase);
      if (phase === 'source') {
        const sourceStoragePath = clean(body?.sourceStoragePath, 900);
        if (sourceStoragePath.startsWith('meshy-source:')) {
          const taskId = clean(sourceStoragePath.slice('meshy-source:'.length), 420);
          const directJob = await readCatalog3DByTask(taskId);
          if (directJob?.item_id) {
            if (directJob.item_id !== itemId) {
              throw new Error('That direct photo 3D job does not belong to this signed-in creation.');
            }
            return privateJson({
              ok: true,
              reused: true,
              directPhoto: true,
              ...publicState(directJob, await displayUrlFor(directJob)),
            });
          }

          const recoveryProviderTaskId = verifyPropertyGenerationRecoveryTaskId(apiKey, auth.user.id, taskId);
          if (!recoveryProviderTaskId) {
            throw new Error('That direct photo 3D job does not belong to this signed-in creation.');
          }
          return privateJson({
            ok: true,
            reused: true,
            directPhoto: true,
            recoveryMode: true,
            ...publicState({ item_id: itemId, task_id: taskId, status: 'PENDING', progress: 0 }),
          });
        }
        imageUrl = await sourcePhotoUrl(auth, draftId, sourceStoragePath);
        provider = 'meshy-property-photo-to-3d';
      } else {
        imageUrl = await verifiedVoxelImageUrl(apiKey, auth.user.id, body?.voxelImageTaskId, body?.voxelImageTaskToken);
        provider = 'meshy-property-voxel-style-to-3d';
      }
    } else {
      const atlasId = cleanAtlasId(atlasIdRaw);
      imageUrl = clean(body?.imageUrl, 2200);
      if (!isHttpUrl(imageUrl)) return privateJson({ ok: false, error: 'Make the voxel image first.' }, { status: 400 });
      itemId = propertyLegacyItemId(auth.user.id, atlasId);
    }

    if (!isHttpUrl(imageUrl)) return privateJson({ ok: false, error: 'A usable generation image is required.' }, { status: 400 });
    const existing = await readCatalog3D(itemId);
    const sameSourceImage = clean(existing?.source_image_url, 2200) === imageUrl;
    if (sameSourceImage && (existing?.model_url || existing?.model_storage_path)) {
      return privateJson({ ok: true, reused: true, ...publicState(existing, await displayUrlFor(existing)), progress: 100 });
    }
    if (sameSourceImage && existing?.task_id && ['PENDING', 'IN_PROGRESS'].includes(String(existing.status || '').toUpperCase())) {
      return privateJson({ ok: true, reused: true, ...publicState(existing) });
    }

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
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
    if (!response.ok) return privateJson({ ok: false, error: data?.task_error?.message || data?.message || data?.error || `3D provider returned ${response.status}.` }, { status: response.status });

    const providerTaskId = clean(data?.result || data?.id, 240);
    if (!providerTaskId) throw new Error('The 3D provider did not return a task ID.');
    const canonicalTaskId = propertyGenerationCanonicalTaskId(providerTaskId);
    const saved = await saveCatalog3D(itemId, {
      task_id: canonicalTaskId,
      source_image_url: imageUrl,
      source_image_urls: [imageUrl],
      provider,
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

    return privateJson({
      ok: true,
      reused: false,
      sourceChanged: Boolean(existing && !sameSourceImage),
      recoveryMode: !saved?.task_id,
      ...publicState(saved || { item_id: itemId, task_id: taskId, status: 'PENDING' }),
    });
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof Error ? error.message : 'Property 3D generation failed.' }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });
  const url = new URL(request.url);
  const atlasIdRaw = url.searchParams.get('atlasId') || '';
  const draftIdRaw = url.searchParams.get('draftId') || '';
  const phaseRaw = url.searchParams.get('phase') || '';
  const taskId = clean(url.searchParams.get('taskId'), 420);
  const resumeCached = url.searchParams.get('resume') === '1';

  try {
    if ((atlasIdRaw || draftIdRaw) && !taskId) {
      let itemId = '';
      if (draftIdRaw) {
        const draftId = normalizePropertyDraftId(draftIdRaw);
        const phase = normalizePropertyGenerationPhase(phaseRaw);
        itemId = propertyDraftItemId(auth.user.id, draftId, phase);
      } else {
        itemId = propertyLegacyItemId(auth.user.id, cleanAtlasId(atlasIdRaw));
      }
      if (!resumeCached) {
        return privateJson({ ok: true, exists: false, cachedResumeAvailable: true, status: 'NOT_STARTED', progress: 0, modelUrl: null });
      }
      const saved = await readCatalog3D(itemId);
      if (!saved) return privateJson({ ok: true, exists: false, cachedResumeAvailable: false, status: 'NOT_STARTED', progress: 0, modelUrl: null });
      return privateJson({ ok: true, exists: true, cachedResumeAvailable: true, ...publicState(saved, await displayUrlFor(saved)) });
    }

    if (!taskId) return privateJson({ ok: false, error: 'draftId, atlasId, or taskId is required.' }, { status: 400 });
    const apiKey = process.env.MESHY_API_KEY?.trim();
    if (!apiKey) return privateJson({ ok: false, error: 'Property 3D generation is not configured on this deployment.' }, { status: 503 });

    const stored = await readCatalog3DByTask(taskId);
    let saved = stored;
    let providerTaskId = '';
    let recoveryMode = false;

    if (saved?.item_id && propertyGenerationItemBelongsToUser(auth.user.id, saved.item_id)) {
      providerTaskId = propertyGenerationProviderTaskId(saved.task_id || taskId);
    } else {
      const recoveredProviderTaskId = verifyPropertyGenerationRecoveryTaskId(apiKey, auth.user.id, taskId);
      if (!recoveredProviderTaskId) {
        return privateJson({ ok: false, error: 'That 3D job does not belong to this signed-in account.' }, { status: 404 });
      }
      providerTaskId = recoveredProviderTaskId;
      recoveryMode = true;
      saved = null;
    }

    if (!providerTaskId) {
      return privateJson({ ok: false, error: 'That 3D job has an invalid provider task reference.' }, { status: 400 });
    }

    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(providerTaskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return privateJson({ ok: false, error: data?.task_error?.message || data?.message || data?.error || 'Could not read property 3D status.' }, { status: response.status });

    const status = clean(data?.status || 'PENDING', 80);
    const progress = Number(data?.progress || 0);
    const providerModelUrl = clean(data?.model_urls?.glb, 2200) || null;
    const thumbnailUrl = clean(data?.alpha_thumbnail_url || data?.thumbnail_url, 2200) || null;

    if (recoveryMode || !saved?.item_id) {
      const finalRow = {
        item_id: null,
        task_id: taskId,
        status,
        progress: providerModelUrl ? 100 : progress,
        model_storage_path: null,
        model_url: providerModelUrl,
        thumbnail_url: thumbnailUrl,
        error: data?.task_error?.message || null,
      };
      return privateJson({ ok: true, exists: true, recoveryMode: true, ...publicState(finalRow, providerModelUrl) });
    }

    let modelStoragePath = saved?.model_storage_path || null;
    if (providerModelUrl && saved?.item_id && !modelStoragePath) modelStoragePath = await persistModelBinary(saved.item_id, providerModelUrl);

    const updated = await saveCatalog3D(saved.item_id, {
      task_id: saved.task_id || taskId,
      provider: saved.provider || 'meshy-property-generation',
      status,
      progress: providerModelUrl ? 100 : progress,
      model_url: providerModelUrl || saved.model_url || null,
      model_storage_path: modelStoragePath || null,
      thumbnail_url: thumbnailUrl || saved.thumbnail_url || null,
      completed_at: providerModelUrl ? new Date().toISOString() : saved.completed_at || null,
      error: data?.task_error?.message || null,
    }) || saved;

    const finalRow = {
      ...updated,
      task_id: taskId,
      status,
      progress: providerModelUrl ? 100 : progress,
      model_storage_path: modelStoragePath,
      model_url: providerModelUrl || updated?.model_url || null,
      thumbnail_url: thumbnailUrl || updated?.thumbnail_url || null,
      error: data?.task_error?.message || null,
    };
    return privateJson({ ok: true, exists: true, ...publicState(finalRow, await displayUrlFor(finalRow)) });
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof Error ? error.message : 'Property 3D status failed.' }, { status: 500 });
  }
}
