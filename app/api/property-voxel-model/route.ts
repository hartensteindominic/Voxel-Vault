import { NextResponse } from 'next/server';
import { createModelSignedUrl, persistModelBinary, readCatalog3DByTask } from '../../../lib/catalog3dStore';
import { propertyGenerationProviderTaskId } from '../../../lib/property-generation-task';
import { verifyPropertyGenerationModelToken } from '../../../lib/property-generation-model';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';

function clean(value: unknown, max = 520) {
  return String(value || '').trim().slice(0, max);
}

async function fetchBytes(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok || !response.body) return null;
  return response;
}

function binaryResponse(response: Response, fallbackType: string, repaired = false) {
  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': response.headers.get('content-type') || fallbackType,
      'Cache-Control': repaired ? 'private, no-store, max-age=0' : 'private, max-age=300',
      ...(repaired ? { 'X-Voxel-Vault-Model-Repaired': '1' } : {}),
    },
  });
}

async function providerTask(apiKey: string, taskId: string) {
  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });
  const task = await response.json().catch(() => ({}));
  return { response, task };
}

export async function GET(request: Request) {
  const apiKey = process.env.MESHY_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ ok: false, error: '3D model delivery is not configured.' }, { status: 503 });

  try {
    const url = new URL(request.url);
    const taskId = clean(url.searchParams.get('taskId'));
    const token = clean(url.searchParams.get('token'), 128);
    const wantsPreview = url.searchParams.get('preview') === '1';
    const forceProviderRepair = url.searchParams.has('previewRetry') || url.searchParams.get('repair') === '1';
    if (!verifyPropertyGenerationModelToken(apiKey, taskId, token)) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired 3D model link.' }, { status: 403 });
    }

    const saved = await readCatalog3DByTask(taskId);
    const providerTaskId = propertyGenerationProviderTaskId(saved?.task_id || taskId);
    if (!providerTaskId) {
      return NextResponse.json({ ok: false, error: 'The 3D provider task reference is invalid.' }, { status: 404 });
    }

    if (wantsPreview) {
      // Prefer the saved Meshy render, but provider thumbnail URLs can expire.
      // If it no longer loads, refresh the already-completed task for the current
      // render URL. This never starts a new generation.
      const savedThumbnailUrl = clean(saved?.thumbnail_url, 2400);
      let preview = savedThumbnailUrl ? await fetchBytes(savedThumbnailUrl) : null;
      if (!preview) {
        const refreshed = await providerTask(apiKey, providerTaskId);
        if (!refreshed.response.ok) {
          return NextResponse.json({
            ok: false,
            error: refreshed.task?.task_error?.message || refreshed.task?.message || refreshed.task?.error || 'The 3D provider could not refresh this preview.',
          }, { status: refreshed.response.status });
        }
        const freshThumbnailUrl = clean(refreshed.task?.alpha_thumbnail_url || refreshed.task?.thumbnail_url, 2400);
        if (!freshThumbnailUrl) return NextResponse.json({ ok: false, error: 'The rendered 3D image is not ready yet.' }, { status: 409 });
        preview = await fetchBytes(freshThumbnailUrl);
      }
      if (!preview) return NextResponse.json({ ok: false, error: 'The rendered 3D image could not be loaded.' }, { status: 502 });
      return binaryResponse(preview, 'image/webp');
    }

    // A GLB can return HTTP 200 and still contain stale/corrupt bytes that
    // GLTFLoader cannot parse. The viewer adds previewRetry only after an actual
    // parse/load failure, so treat that retry as a trusted signal to bypass the
    // private object once and rebuild it from the already-completed Meshy task.
    if (!forceProviderRepair && saved?.model_storage_path) {
      const signed = await createModelSignedUrl(saved.model_storage_path, 10 * 60);
      if (signed) {
        const cached = await fetchBytes(signed);
        if (cached) return binaryResponse(cached, 'model/gltf-binary');
      }
    }

    const refreshed = await providerTask(apiKey, providerTaskId);
    if (!refreshed.response.ok) {
      return NextResponse.json({
        ok: false,
        error: refreshed.task?.task_error?.message || refreshed.task?.message || refreshed.task?.error || 'The 3D provider could not refresh this model.',
      }, { status: refreshed.response.status });
    }

    const providerModelUrl = clean(refreshed.task?.model_urls?.glb, 2400);
    if (!providerModelUrl) {
      return NextResponse.json({ ok: false, error: 'The 3D model is not ready yet.' }, { status: 409 });
    }

    // The provider task already exists and is complete. If the private cached GLB
    // was missing, unreadable, or explicitly failed in GLTFLoader, overwrite that
    // cache from the existing Meshy GLB. This never starts or charges for another
    // generation.
    if (saved?.item_id) {
      const repairedPath = await persistModelBinary(saved.item_id, providerModelUrl);
      if (repairedPath) {
        const signed = await createModelSignedUrl(repairedPath, 10 * 60);
        if (signed) {
          const repaired = await fetchBytes(signed);
          if (repaired) return binaryResponse(repaired, 'model/gltf-binary', forceProviderRepair);
        }
      }
    }

    const providerModel = await fetchBytes(providerModelUrl);
    if (!providerModel) {
      return NextResponse.json({ ok: false, error: 'The refreshed 3D model could not be downloaded.' }, { status: 502 });
    }
    return binaryResponse(providerModel, 'model/gltf-binary', forceProviderRepair);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '3D model delivery failed.' }, { status: 500 });
  }
}
