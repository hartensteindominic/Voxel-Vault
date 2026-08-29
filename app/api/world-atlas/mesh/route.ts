import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../lib/admin-auth';
import {
  createModelSignedUrl,
  persistModelBinary,
  readCatalog3D,
  readCatalog3DByTask,
  saveCatalog3D,
} from '../../../../lib/catalog3dStore';
import { WORLD_ATLAS_MESH_POLICY } from '../../../../lib/world-atlas.js';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ENDPOINT = 'https://api.meshy.ai/openapi/v1/multi-image-to-3d';
const BLOCKED_REFERENCE_HOSTS = /(^|\.)(google\.com|googleusercontent\.com|gstatic\.com|googleapis\.com|maps\.googleapis\.com|streetviewpixels-pa\.googleapis\.com|zillow\.com|zillowstatic\.com|redfin\.com|cdn-redfin\.com|apartments\.com)$/i;
const ALLOWED_RIGHTS_BASES = new Set(['user-owned', 'open-licensed', 'licensed-derivative']);

function isHttpUrl(value: unknown) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function cleanAtlasId(value: unknown) {
  const id = String(value || '').trim();
  if (!id || id.length > 180 || !/^[a-zA-Z0-9:._-]+$/.test(id)) throw new Error('A valid atlasId is required.');
  return id;
}

function validateReferences(input: unknown) {
  const items = Array.isArray(input) ? input : [];
  const accepted: { url: string; rightsBasis: string; rightsReference: string }[] = [];
  for (const item of items) {
    const url = String(item?.url || '').trim();
    const rightsBasis = String(item?.rightsBasis || '').trim().toLowerCase();
    const rightsReference = String(item?.rightsReference || '').trim().slice(0, 500);
    if (!isHttpUrl(url) || !ALLOWED_RIGHTS_BASES.has(rightsBasis) || !rightsReference) continue;
    const host = new URL(url).hostname.toLowerCase();
    if (BLOCKED_REFERENCE_HOSTS.test(host)) {
      throw new Error('Google Maps/Earth/Street View, Zillow, Redfin and Apartments.com imagery cannot be copied into Meshy by this route. Open those services as live visual references, or use user-owned/open/licensed images with derivative rights.');
    }
    accepted.push({ url, rightsBasis, rightsReference });
  }
  const unique = [...new Map(accepted.map((item) => [item.url, item])).values()]
    .slice(0, WORLD_ATLAS_MESH_POLICY.maxLicensedReferenceImages);
  if (unique.length < WORLD_ATLAS_MESH_POLICY.minLicensedReferenceImages) {
    throw new Error(`Meshy 7 needs ${WORLD_ATLAS_MESH_POLICY.minLicensedReferenceImages}–${WORLD_ATLAS_MESH_POLICY.maxLicensedReferenceImages} rights-cleared views for the high-fidelity property workflow.`);
  }
  return unique;
}

function taskKey(rawId: string) {
  return rawId.startsWith('world-multi:') ? rawId : `world-multi:${rawId}`;
}

function rawTaskId(taskId: string) {
  return String(taskId || '').replace(/^world-multi:/, '');
}

async function displayUrlFor(saved: any) {
  if (saved?.model_storage_path) {
    const signed = await createModelSignedUrl(saved.model_storage_path, 60 * 60);
    if (signed) return signed;
  }
  return saved?.model_url || null;
}

function safeMeshState(saved: any, displayModelUrl: string | null = null) {
  return {
    itemId: saved?.item_id || null,
    taskId: saved?.task_id || null,
    status: saved?.status || 'NOT_STARTED',
    progress: Number(saved?.progress || 0),
    displayModelUrl,
    modelStored: Boolean(saved?.model_storage_path),
    thumbnailUrl: saved?.thumbnail_url || null,
    error: saved?.error || null,
    meshPolicy: WORLD_ATLAS_MESH_POLICY,
  };
}

async function recoverCachedDisplay(saved: any) {
  if (!saved) return { saved, displayModelUrl: null, recovered: false };

  if (saved?.model_storage_path) {
    const signed = await createModelSignedUrl(saved.model_storage_path, 60 * 60);
    if (signed) return { saved, displayModelUrl: signed, recovered: false };
  }

  let updated = saved;
  let modelStoragePath: string | null = null;
  let providerModelUrl = saved?.model_url || null;

  if (saved?.item_id && providerModelUrl) {
    modelStoragePath = await persistModelBinary(saved.item_id, providerModelUrl);
    if (modelStoragePath) {
      updated = await saveCatalog3D(saved.item_id, {
        ...saved,
        model_storage_path: modelStoragePath,
        error: null,
      }) || { ...saved, model_storage_path: modelStoragePath, error: null };
      const signed = await createModelSignedUrl(modelStoragePath, 60 * 60);
      if (signed) return { saved: updated, displayModelUrl: signed, recovered: true };
    }
  }

  const apiKey = process.env.MESHY_API_KEY?.trim();
  if (!saved?.task_id || !apiKey) {
    return { saved: updated, displayModelUrl: await displayUrlFor(updated), recovered: false };
  }

  try {
    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(rawTaskId(saved.task_id))}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { saved: updated, displayModelUrl: await displayUrlFor(updated), recovered: false };

    const refreshedModelUrl = data?.model_urls?.glb || providerModelUrl || null;
    const refreshedThumbnailUrl = data?.thumbnail_url || saved?.thumbnail_url || null;
    const refreshedStatus = String(data?.status || saved?.status || 'PENDING');
    const refreshedProgress = Number(data?.progress ?? saved?.progress ?? 0);
    let refreshedStoragePath = modelStoragePath || null;

    if (saved?.item_id && refreshedModelUrl) {
      refreshedStoragePath = await persistModelBinary(saved.item_id, refreshedModelUrl) || refreshedStoragePath;
      updated = await saveCatalog3D(saved.item_id, {
        ...saved,
        task_id: saved.task_id,
        provider: saved.provider || `meshy-world-atlas:${WORLD_ATLAS_MESH_POLICY.aiModel}`,
        status: refreshedStatus,
        progress: refreshedModelUrl ? 100 : refreshedProgress,
        model_url: refreshedModelUrl,
        model_storage_path: refreshedStoragePath,
        thumbnail_url: refreshedThumbnailUrl,
        completed_at: refreshedModelUrl ? (saved.completed_at || new Date().toISOString()) : saved.completed_at || null,
        error: data?.task_error?.message || null,
      }) || {
        ...saved,
        status: refreshedStatus,
        progress: refreshedModelUrl ? 100 : refreshedProgress,
        model_url: refreshedModelUrl,
        model_storage_path: refreshedStoragePath,
        thumbnail_url: refreshedThumbnailUrl,
        error: data?.task_error?.message || null,
      };
    }

    return {
      saved: updated,
      displayModelUrl: await displayUrlFor({
        ...updated,
        model_url: refreshedModelUrl || updated?.model_url || null,
        model_storage_path: refreshedStoragePath || updated?.model_storage_path || null,
      }),
      recovered: Boolean(refreshedModelUrl || refreshedStoragePath),
    };
  } catch {
    return { saved: updated, displayModelUrl: await displayUrlFor(updated), recovered: false };
  }
}

export async function POST(request: Request) {
  const admin = await requireVoxelVaultAdmin(request);
  if (admin.ok === false) return NextResponse.json({ configured: false, error: admin.error }, { status: admin.status });
  const apiKey = process.env.MESHY_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ configured: false, error: 'MESHY_API_KEY is not configured server-side.' }, { status: 503 });

  try {
    const body = await request.json().catch(() => ({}));
    const atlasId = cleanAtlasId(body?.atlasId);
    const itemId = `world-atlas:${atlasId}`;
    const forceRestart = body?.forceRestart === true;

    if (!forceRestart) {
      const saved = await readCatalog3D(itemId);
      if (saved?.model_url || saved?.model_storage_path) {
        const recovered = await recoverCachedDisplay(saved);
        return NextResponse.json({ configured: true, reused: true, recovered: recovered.recovered, ...safeMeshState(recovered.saved, recovered.displayModelUrl), progress: 100 });
      }
      if (saved?.task_id && ['PENDING', 'IN_PROGRESS'].includes(String(saved.status || '').toUpperCase())) {
        return NextResponse.json({ configured: true, reused: true, ...safeMeshState(saved) });
      }
    }

    const references = validateReferences(body?.referenceImages);
    const imageUrls = references.map((item) => item.url);
    const payload = {
      image_urls: imageUrls,
      ai_model: WORLD_ATLAS_MESH_POLICY.aiModel,
      should_texture: true,
      enable_pbr: WORLD_ATLAS_MESH_POLICY.enablePbr,
      texture_resolution: WORLD_ATLAS_MESH_POLICY.textureResolution,
      texture_image_urls: imageUrls,
      image_enhancement: false,
      remove_lighting: true,
      moderation: true,
      should_remesh: true,
      topology: 'triangle',
      target_polycount: WORLD_ATLAS_MESH_POLICY.targetPolycount,
      target_formats: ['glb'],
      auto_size: true,
      origin_at: 'bottom',
      multi_view_thumbnails: true,
    };

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerMessage = data?.message || data?.error || data?.task_error?.message || `Meshy rejected the request (${response.status}).`;
      return NextResponse.json({ configured: true, error: providerMessage, providerStatus: response.status }, { status: response.status });
    }

    const providerTaskId = String(data?.result || data?.id || '').trim();
    if (!providerTaskId) throw new Error('Meshy did not return a task ID.');
    const taskId = taskKey(providerTaskId);
    const saved = await saveCatalog3D(itemId, {
      task_id: taskId,
      source_image_url: imageUrls[0],
      source_image_urls: imageUrls,
      provider: `meshy-world-atlas:${WORLD_ATLAS_MESH_POLICY.aiModel}`,
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

    return NextResponse.json({
      configured: true,
      reused: false,
      referenceCount: references.length,
      aiModel: WORLD_ATLAS_MESH_POLICY.aiModel,
      ...safeMeshState(saved || { item_id: itemId, task_id: taskId, status: 'PENDING' }),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'World-atlas Meshy request failed.' }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const admin = await requireVoxelVaultAdmin(request);
  if (admin.ok === false) return NextResponse.json({ configured: false, error: admin.error }, { status: admin.status });

  const url = new URL(request.url);
  const atlasIdRaw = url.searchParams.get('atlasId') || '';
  const taskId = url.searchParams.get('taskId') || '';

  if (atlasIdRaw && !taskId) {
    try {
      const atlasId = cleanAtlasId(atlasIdRaw);
      const saved = await readCatalog3D(`world-atlas:${atlasId}`);
      if (!saved) return NextResponse.json({ configured: true, exists: false, status: 'NOT_STARTED', progress: 0, displayModelUrl: null, meshPolicy: WORLD_ATLAS_MESH_POLICY });
      const recovered = await recoverCachedDisplay(saved);
      return NextResponse.json({ configured: true, exists: true, recovered: recovered.recovered, ...safeMeshState(recovered.saved, recovered.displayModelUrl) });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to read cached world model.' }, { status: 400 });
    }
  }

  if (!taskId) return NextResponse.json({ error: 'atlasId or taskId is required.' }, { status: 400 });
  const apiKey = process.env.MESHY_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ configured: false, error: 'MESHY_API_KEY is not configured server-side.' }, { status: 503 });

  try {
    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(rawTaskId(taskId))}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.message || data?.error || data?.task_error?.message || 'Unable to read Meshy world-atlas status.' }, { status: response.status });

    const status = String(data?.status || 'PENDING');
    const progress = Number(data?.progress ?? 0);
    const providerModelUrl = data?.model_urls?.glb || null;
    const thumbnailUrl = data?.thumbnail_url || null;
    const saved = await readCatalog3DByTask(taskId);
    let modelStoragePath = saved?.model_storage_path || null;

    if (providerModelUrl && saved?.item_id && !modelStoragePath) modelStoragePath = await persistModelBinary(saved.item_id, providerModelUrl);
    let updated = saved;
    if (saved?.item_id) {
      updated = await saveCatalog3D(saved.item_id, {
        task_id: taskId,
        provider: `meshy-world-atlas:${WORLD_ATLAS_MESH_POLICY.aiModel}`,
        status,
        progress: providerModelUrl ? 100 : progress,
        model_url: providerModelUrl || saved.model_url || null,
        model_storage_path: modelStoragePath || null,
        thumbnail_url: thumbnailUrl || saved.thumbnail_url || null,
        completed_at: providerModelUrl ? new Date().toISOString() : saved.completed_at || null,
        error: data?.task_error?.message || null,
      }) || saved;
    }

    return NextResponse.json({
      configured: true,
      exists: true,
      aiModel: WORLD_ATLAS_MESH_POLICY.aiModel,
      ...safeMeshState({
        ...(updated || {}),
        task_id: taskId,
        status,
        progress: providerModelUrl ? 100 : progress,
        model_storage_path: modelStoragePath,
        model_url: providerModelUrl || updated?.model_url || null,
        thumbnail_url: thumbnailUrl || updated?.thumbnail_url || null,
        error: data?.task_error?.message || null,
      }, await displayUrlFor({
        ...(updated || {}),
        model_storage_path: modelStoragePath,
        model_url: providerModelUrl || updated?.model_url || null,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'World-atlas Meshy status request failed.' }, { status: 500 });
  }
}
