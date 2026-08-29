import { NextResponse } from 'next/server';
import { createModelSignedUrl, readCatalog3DByTask } from '../../../lib/catalog3dStore';
import { propertyGenerationProviderTaskId } from '../../../lib/property-generation-task';
import { verifyPropertyGenerationModelToken } from '../../../lib/property-generation-model';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';

function clean(value: unknown, max = 520) {
  return String(value || '').trim().slice(0, max);
}

async function fetchModelBytes(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok || !response.body) return null;
  return response;
}

export async function GET(request: Request) {
  const apiKey = process.env.MESHY_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ ok: false, error: '3D model delivery is not configured.' }, { status: 503 });

  try {
    const url = new URL(request.url);
    const taskId = clean(url.searchParams.get('taskId'));
    const token = clean(url.searchParams.get('token'), 128);
    if (!verifyPropertyGenerationModelToken(apiKey, taskId, token)) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired 3D model link.' }, { status: 403 });
    }

    const saved = await readCatalog3DByTask(taskId);
    if (saved?.model_storage_path) {
      const signed = await createModelSignedUrl(saved.model_storage_path, 10 * 60);
      if (signed) {
        const cached = await fetchModelBytes(signed);
        if (cached) {
          return new Response(cached.body, {
            status: 200,
            headers: {
              'Content-Type': cached.headers.get('content-type') || 'model/gltf-binary',
              'Cache-Control': 'private, max-age=300',
            },
          });
        }
      }
    }

    const providerTaskId = propertyGenerationProviderTaskId(saved?.task_id || taskId);
    if (!providerTaskId) {
      return NextResponse.json({ ok: false, error: 'The 3D provider task reference is invalid.' }, { status: 404 });
    }

    const statusResponse = await fetch(`${ENDPOINT}/${encodeURIComponent(providerTaskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    const task = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) {
      return NextResponse.json({ ok: false, error: task?.task_error?.message || task?.message || task?.error || 'The 3D provider could not refresh this model.' }, { status: statusResponse.status });
    }

    const providerModelUrl = clean(task?.model_urls?.glb, 2400);
    if (!providerModelUrl) {
      return NextResponse.json({ ok: false, error: 'The 3D model is not ready yet.' }, { status: 409 });
    }

    const providerModel = await fetchModelBytes(providerModelUrl);
    if (!providerModel) {
      return NextResponse.json({ ok: false, error: 'The refreshed 3D model could not be downloaded.' }, { status: 502 });
    }

    return new Response(providerModel.body, {
      status: 200,
      headers: {
        'Content-Type': providerModel.headers.get('content-type') || 'model/gltf-binary',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '3D model delivery failed.' }, { status: 500 });
  }
}
