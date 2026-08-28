import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../lib/admin-auth';
import { persistModelBinary, readCatalog3D, readCatalog3DByTask, saveCatalog3D } from '../../../../lib/catalog3dStore';
import { WORLD_ATLAS_MESH_POLICY } from '../../../../lib/world-atlas.js';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ENDPOINT = 'https://api.meshy.ai/openapi/v1/multi-image-to-3d';
const BLOCKED_REFERENCE_HOSTS = /(^|\.)(google\.com|googleusercontent\.com|gstatic\.com|zillow\.com|zillowstatic\.com|redfin\.com|apartments\.com)$/i;
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
  const accepted = [];
  for (const item of items) {
    const url = String(item?.url || '').trim();
    const rightsBasis = String(item?.rightsBasis || '').trim().toLowerCase();
    const rightsReference = String(item?.rightsReference || '').trim();
    if (!isHttpUrl(url) || !ALLOWED_RIGHTS_BASES.has(rightsBasis) || !rightsReference) continue;
    const host = new URL(url).hostname.toLowerCase();
    if (BLOCKED_REFERENCE_HOSTS.test(host)) {
      throw new Error('Google Earth/Maps, Zillow, Redfin and Apartments.com imagery cannot be sent to Meshy by this route. Use user-owned or explicitly licensed derivative-generation references.');
    }
    accepted.push({ url, rightsBasis, rightsReference });
  }
  const unique = [...new Map(accepted.map((item) => [item.url, item])).values()]
    .slice(0, WORLD_ATLAS_MESH_POLICY.maxLicensedReferenceImages);
  if (unique.length < WORLD_ATLAS_MESH_POLICY.minLicensedReferenceImages) {
    throw new Error(`Meshy needs ${WORLD_ATLAS_MESH_POLICY.minLicensedReferenceImages}–${WORLD_ATLAS_MESH_POLICY.maxLicensedReferenceImages} approved reference views for a real-property hero model.`);
  }
  return unique;
}

function taskKey(rawId: string) {
  return rawId.startsWith('world-multi:') ? rawId : `world-multi:${rawId}`;
}

function rawTaskId(taskId: string) {
  return String(taskId || '').replace(/^world-multi:/, '');
}

export async function POST(request: Request) {
  const admin = await requireVoxelVaultAdmin(request);
  if (!admin.ok) return NextResponse.json({ configured: false, error: admin.error }, { status: admin.status });
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) return NextResponse.json({ configured: false, error: 'MESHY_API_KEY is not configured server-side.' }, { status: 503 });

  try {
    const body = await request.json().catch(() => ({}));
    const atlasId = cleanAtlasId(body?.atlasId);
    const itemId = `world-atlas:${atlasId}`;
    const forceRestart = body?.forceRestart === true;

    if (!forceRestart) {
      const saved = await readCatalog3D(itemId);
      if (saved?.model_url || saved?.model_storage_path) {
        return NextResponse.json({ configured: true, reused: true, itemId, modelUrl: saved.model_url || null, modelStored: Boolean(saved.model_storage_path), taskId: saved.task_id || null, progress: 100, meshPolicy: WORLD_ATLAS_MESH_POLICY });
      }
      if (saved?.task_id && ['PENDING', 'IN_PROGRESS'].includes(String(saved.status || '').toUpperCase())) {
        return NextResponse.json({ configured: true, reused: true, itemId, taskId: saved.task_id, progress: saved.progress || 0, meshPolicy: WORLD_ATLAS_MESH_POLICY });
      }
    }

    const references = validateReferences(body?.referenceImages);
    const imageUrls = references.map((item) => item.url);
    const payload = {
      image_urls: imageUrls,
      ai_model: 'latest',
      should_texture: true,
      enable_pbr: WORLD_ATLAS_MESH_POLICY.enablePbr,
      texture_resolution: WORLD_ATLAS_MESH_POLICY.textureResolution,
      texture_image_urls: imageUrls,
      image_enhancement: false,
      remove_lighting: true,
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
    if (!response.ok) return NextResponse.json({ error: data?.message || data?.error || data?.task_error?.message || 'Meshy rejected the world-atlas model request.' }, { status: response.status });

    const providerTaskId = String(data?.result || data?.id || '').trim();
    if (!providerTaskId) throw new Error('Meshy did not return a task ID.');
    const taskId = taskKey(providerTaskId);
    await saveCatalog3D(itemId, {
      task_id: taskId,
      source_image_url: imageUrls[0],
      source_image_urls: imageUrls,
      provider: 'meshy-world-atlas',
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

    return NextResponse.json({ configured: true, reused: false, itemId, taskId, referenceCount: references.length, meshPolicy: WORLD_ATLAS_MESH_POLICY });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'World-atlas Meshy request failed.' }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const admin = await requireVoxelVaultAdmin(request);
  if (!admin.ok) return NextResponse.json({ configured: false, error: admin.error }, { status: admin.status });
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) return NextResponse.json({ configured: false, error: 'MESHY_API_KEY is not configured server-side.' }, { status: 503 });

  const taskId = new URL(request.url).searchParams.get('taskId') || '';
  if (!taskId) return NextResponse.json({ error: 'taskId is required.' }, { status: 400 });

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

    if (providerModelUrl && saved?.item_id && !modelStoragePath) {
      modelStoragePath = await persistModelBinary(saved.item_id, providerModelUrl);
    }
    if (saved?.item_id) {
      await saveCatalog3D(saved.item_id, {
        task_id: taskId,
        provider: 'meshy-world-atlas',
        status,
        progress: providerModelUrl ? 100 : progress,
        model_url: providerModelUrl || saved.model_url || null,
        model_storage_path: modelStoragePath || null,
        thumbnail_url: thumbnailUrl || saved.thumbnail_url || null,
        completed_at: providerModelUrl ? new Date().toISOString() : saved.completed_at || null,
        error: data?.task_error?.message || null,
      });
    }

    return NextResponse.json({
      configured: true,
      status,
      progress: providerModelUrl ? 100 : progress,
      modelUrl: providerModelUrl,
      modelStored: Boolean(modelStoragePath),
      thumbnailUrl,
      error: data?.task_error?.message || null,
      meshPolicy: WORLD_ATLAS_MESH_POLICY,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'World-atlas Meshy status request failed.' }, { status: 500 });
  }
}
