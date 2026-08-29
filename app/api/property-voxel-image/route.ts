import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../lib/user-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-image';
const ALLOWED_RIGHTS_BASES = new Set(['user-owned', 'open-licensed', 'licensed-derivative']);
const BLOCKED_REFERENCE_HOSTS = /(^|\.)(google\.com|googleusercontent\.com|gstatic\.com|googleapis\.com|maps\.googleapis\.com|streetviewpixels-pa\.googleapis\.com|zillow\.com|zillowstatic\.com|redfin\.com|cdn-redfin\.com|apartments\.com)$/i;

function clean(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function isHttpUrl(value: unknown) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function validateReferences(input: unknown) {
  const raw = Array.isArray(input) ? input : [];
  const accepted: { url: string; rightsBasis: string; rightsReference: string; label: string }[] = [];
  for (const item of raw) {
    const url = clean(item?.url, 1800);
    const rightsBasis = clean(item?.rightsBasis, 80).toLowerCase();
    const rightsReference = clean(item?.rightsReference, 600);
    const label = clean(item?.label, 120) || 'Property reference';
    if (!isHttpUrl(url) || !ALLOWED_RIGHTS_BASES.has(rightsBasis) || !rightsReference) continue;
    const host = new URL(url).hostname.toLowerCase();
    if (BLOCKED_REFERENCE_HOSTS.test(host)) {
      throw new Error('This image source cannot be sent to the voxel generator. Use an open-licensed, user-owned, or explicitly derivative-licensed property photo instead.');
    }
    accepted.push({ url, rightsBasis, rightsReference, label });
  }
  return [...new Map(accepted.map((item) => [item.url, item])).values()].slice(0, 3);
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
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });

  const apiKey = process.env.MESHY_API_KEY?.trim();
  if (!apiKey) return privateJson({ ok: false, error: 'Voxel image generation is not configured on this deployment.' }, { status: 503 });

  try {
    const body = await request.json().catch(() => ({}));
    const address = clean(body?.address, 220);
    const atlasId = clean(body?.atlasId, 180);
    const references = validateReferences(body?.references);
    if (!address || !atlasId) return privateJson({ ok: false, error: 'A resolved property is required.' }, { status: 400 });
    if (!references.length) return privateJson({ ok: false, error: 'A rights-cleared property photo is required before making the voxel.' }, { status: 400 });

    const prompt = [
      `Create a faithful voxel architectural rendering of the exact property shown in the supplied reference photo${references.length > 1 ? 's' : ''}: ${address}.`,
      'Preserve the visible building identity: exact floor count, overall massing, roof shape and roofline, facade proportions, window count and placement, door count and placement, porch/garage openings, exterior material colors, trim, steps and other obvious permanent architectural details.',
      'Do not redesign, beautify, modernize, add floors, remove floors, invent windows, move doors, change the roof type, or substitute a generic house.',
      'Use crisp premium VoxelPop-style block geometry and believable voxel materials while keeping the building immediately recognizable as the same property.',
      'Keep the front yard, sidewalk, road and neighboring context simple and secondary so the selected building remains the clear subject.',
      'No text, labels, logos, watermarks, UI, borders or fantasy additions.',
      'This is a visual voxel interpretation from photographs, not a survey, deed, or claim of perfect physical accuracy.',
    ].join(' ');

    const create = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ai_model: 'nano-banana',
        prompt,
        reference_image_urls: references.map((item) => item.url),
        aspect_ratio: '1:1',
        remove_background: false,
      }),
      cache: 'no-store',
    });
    const created = await create.json().catch(() => ({}));
    if (!create.ok) return privateJson({ ok: false, error: created?.message || created?.error || `Voxel image provider returned ${create.status}.` }, { status: create.status });

    const taskId = clean(created?.result || created?.id, 240);
    if (!taskId) throw new Error('The voxel image provider did not return a task ID.');

    return privateJson({
      ok: true,
      status: 'PENDING',
      taskId,
      taskToken: taskToken(apiKey, auth.user.id, taskId),
      referenceCount: references.length,
      sourceLabels: references.map((item) => item.label),
      note: 'Voxel creation started from rights-cleared property imagery.',
    });
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof Error ? error.message : 'Property voxel image generation failed.' }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });

  const apiKey = process.env.MESHY_API_KEY?.trim();
  if (!apiKey) return privateJson({ ok: false, error: 'Voxel image generation is not configured on this deployment.' }, { status: 503 });

  try {
    const url = new URL(request.url);
    const taskId = clean(url.searchParams.get('taskId'), 240);
    const suppliedToken = clean(url.searchParams.get('taskToken'), 128);
    if (!taskId || suppliedToken !== taskToken(apiKey, auth.user.id, taskId)) {
      return privateJson({ ok: false, error: 'That voxel image job does not belong to this signed-in account.' }, { status: 403 });
    }

    const statusResponse = await fetch(`${ENDPOINT}/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    const task = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) return privateJson({ ok: false, error: task?.message || task?.error || `Could not read voxel image task (${statusResponse.status}).` }, { status: statusResponse.status });

    const status = clean(task?.status || 'PENDING', 80).toUpperCase();
    const progress = Math.max(0, Math.min(100, Number(task?.progress || 0)));
    if (status === 'SUCCEEDED') {
      const imageUrl = Array.isArray(task?.image_urls) ? clean(task.image_urls[0], 2200) : '';
      if (!isHttpUrl(imageUrl)) throw new Error('The voxel image completed without a usable image URL.');
      return privateJson({
        ok: true,
        status,
        progress: 100,
        taskId,
        imageUrl,
        note: 'Voxel image created from rights-cleared property imagery. It is a visual interpretation, not a deed or survey.',
      });
    }
    if (['FAILED', 'EXPIRED', 'CANCELED', 'CANCELLED'].includes(status)) {
      return privateJson({ ok: false, status, error: task?.task_error?.message || task?.message || 'The property voxel image could not be created.' }, { status: 502 });
    }

    return privateJson({ ok: true, status, progress, taskId });
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof Error ? error.message : 'Property voxel image status failed.' }, { status: 400 });
  }
}
