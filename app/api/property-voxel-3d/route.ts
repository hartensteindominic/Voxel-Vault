import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../lib/user-auth';
import {
  createModelSignedUrl,
  persistModelBinary,
  readCatalog3D,
  readCatalog3DByTask,
  saveCatalog3D,
} from '../../../lib/catalog3dStore';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';

function clean(value: unknown, max = 1200) {
  return String(value || '').trim().slice(0, max);
}

function cleanAtlasId(input: unknown) {
  const value = clean(input, 180);
  if (!value || !/^[a-zA-Z0-9:._-]+$/.test(value)) throw new Error('A valid mapped property is required.');
  return value;
}

function isHttpUrl(value: unknown) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function userScope(userId: string) {
  return createHash('sha256').update(`voxel-vault-property-draft:${userId}`).digest('hex').slice(0, 24);
}

function itemIdFor(userId: string, atlasId: string) {
  return `property-voxel:${userScope(userId)}:${atlasId}`;
}

function userItemPrefix(userId: string) {
  return `property-voxel:${userScope(userId)}:`;
}

function taskKey(raw: string) {
  return raw.startsWith('property-voxel:task:') ? raw : `property-voxel:task:${raw}`;
}

function rawTaskId(value: string) {
  return value.replace(/^property-voxel:task:/, '');
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

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });
  const apiKey = process.env.MESHY_API_KEY?.trim();
  if (!apiKey) return privateJson({ ok: false, error: 'Property 3D generation is not configured on this deployment.' }, { status: 503 });

  try {
    const body = await request.json().catch(() => ({}));
    const atlasId = cleanAtlasId(body?.atlasId);
    const imageUrl = clean(body?.imageUrl, 2200);
    if (!isHttpUrl(imageUrl)) return privateJson({ ok: false, error: 'Make the voxel image first.' }, { status: 400 });

    const itemId = itemIdFor(auth.user.id, atlasId);
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
        target_polycount: 18000,
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
    const taskId = taskKey(providerTaskId);
    const saved = await saveCatalog3D(itemId, {
      task_id: taskId,
      source_image_url: imageUrl,
      source_image_urls: [imageUrl],
      provider: 'meshy-property-voxel-image-to-3d',
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

    return privateJson({ ok: true, reused: false, sourceChanged: Boolean(existing && !sameSourceImage), ...publicState(saved || { item_id: itemId, task_id: taskId, status: 'PENDING' }) });
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof Error ? error.message : 'Property 3D generation failed.' }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });
  const url = new URL(request.url);
  const atlasIdRaw = url.searchParams.get('atlasId') || '';
  const taskId = clean(url.searchParams.get('taskId'), 260);
  const resumeCached = url.searchParams.get('resume') === '1';

  try {
    if (atlasIdRaw && !taskId) {
      const atlasId = cleanAtlasId(atlasIdRaw);
      if (!resumeCached) {
        return privateJson({ ok: true, exists: false, cachedResumeAvailable: true, status: 'NOT_STARTED', progress: 0, modelUrl: null });
      }
      const saved = await readCatalog3D(itemIdFor(auth.user.id, atlasId));
      if (!saved) return privateJson({ ok: true, exists: false, cachedResumeAvailable: false, status: 'NOT_STARTED', progress: 0, modelUrl: null });
      return privateJson({ ok: true, exists: true, cachedResumeAvailable: true, ...publicState(saved, await displayUrlFor(saved)) });
    }

    if (!taskId) return privateJson({ ok: false, error: 'atlasId or taskId is required.' }, { status: 400 });
    const apiKey = process.env.MESHY_API_KEY?.trim();
    if (!apiKey) return privateJson({ ok: false, error: 'Property 3D generation is not configured on this deployment.' }, { status: 503 });

    const saved = await readCatalog3DByTask(taskId);
    if (!saved?.item_id || !String(saved.item_id).startsWith(userItemPrefix(auth.user.id))) {
      return privateJson({ ok: false, error: 'That 3D job does not belong to this signed-in account.' }, { status: 404 });
    }

    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(rawTaskId(taskId))}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return privateJson({ ok: false, error: data?.task_error?.message || data?.message || data?.error || 'Could not read property 3D status.' }, { status: response.status });

    const status = clean(data?.status || 'PENDING', 80);
    const progress = Number(data?.progress || 0);
    const providerModelUrl = clean(data?.model_urls?.glb, 2200) || null;
    const thumbnailUrl = clean(data?.alpha_thumbnail_url || data?.thumbnail_url, 2200) || null;
    let modelStoragePath = saved?.model_storage_path || null;
    if (providerModelUrl && saved?.item_id && !modelStoragePath) modelStoragePath = await persistModelBinary(saved.item_id, providerModelUrl);

    const updated = await saveCatalog3D(saved.item_id, {
      task_id: taskId,
      provider: 'meshy-property-voxel-image-to-3d',
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
