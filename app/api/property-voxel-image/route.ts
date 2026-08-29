import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../lib/user-auth';
import { readCatalog3DByTask } from '../../../lib/catalog3dStore';
import { normalizePropertyDraftId, propertyDraftItemId } from '../../../lib/property-generation-ids';
import {
  propertyGenerationProviderTaskId,
  verifyPropertyGenerationRecoveryTaskId,
} from '../../../lib/property-generation-task';
import {
  MESHY_PROPERTY_CREDITS,
  meshyClientStatus,
  meshyCreditError,
  meshyCreditsSufficient,
  meshyProviderFailure,
  readMeshyCreditBalance,
} from '../../../lib/meshy-credits';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-image';
const THREE_D_ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const MAX_REFERENCE_BYTES = 6 * 1024 * 1024;
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

async function freshGenerated3DThumbnail(apiKey: string, providerTaskId: string) {
  const response = await fetch(`${THREE_D_ENDPOINT}/${encodeURIComponent(providerTaskId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });
  const task = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(task?.task_error?.message || task?.message || task?.error || 'The first 3D build could not be verified.');

  const status = clean(task?.status || '', 80).toUpperCase();
  const modelUrl = clean(task?.model_urls?.glb, 2200);
  if (status !== 'SUCCEEDED' || !isHttpUrl(modelUrl)) {
    throw new Error('Finish the first 3D build before making the voxel.');
  }

  const thumbnailUrl = clean(task?.alpha_thumbnail_url || task?.thumbnail_url, 2200);
  if (!isHttpUrl(thumbnailUrl)) {
    throw new Error('The first 3D build finished without a usable preview render. Retry the 3D build before voxelizing it.');
  }
  return thumbnailUrl;
}

async function stableReferenceDataUri(referenceUrl: string) {
  const response = await fetch(referenceUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('The generated 3D preview expired before VoxelPop could read it. Retry the build so the preview can be refreshed automatically.');
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_REFERENCE_BYTES) {
    throw new Error('The generated 3D preview image is unavailable or too large to voxelize safely.');
  }

  const rawType = clean(response.headers.get('content-type'), 100).split(';')[0].toLowerCase();
  let contentType = rawType === 'image/jpeg' || rawType === 'image/png' ? rawType : '';
  if (!contentType) {
    const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    contentType = isPng ? 'image/png' : isJpeg ? 'image/jpeg' : '';
  }
  if (!contentType) throw new Error('The generated 3D preview was not a supported PNG or JPEG image.');
  return `data:${contentType};base64,${bytes.toString('base64')}`;
}

async function recoveredGenerated3DReference(apiKey: string, userId: string, sourceTaskId: string) {
  const providerTaskId = verifyPropertyGenerationRecoveryTaskId(apiKey, userId, sourceTaskId);
  if (!providerTaskId) return null;
  return freshGenerated3DThumbnail(apiKey, providerTaskId);
}

async function generated3DReference(apiKey: string, userId: string, draftIdRaw: unknown, sourceTaskIdRaw: unknown) {
  const draftId = normalizePropertyDraftId(draftIdRaw);
  const sourceTaskId = clean(sourceTaskIdRaw, 420);
  if (!sourceTaskId) throw new Error('Finish the first 3D build before the voxel style pass.');
  const saved = await readCatalog3DByTask(sourceTaskId);
  const expectedItemId = propertyDraftItemId(userId, draftId, 'source');

  let thumbnailUrl = '';
  if (saved) {
    if (saved.item_id !== expectedItemId) throw new Error('That first 3D build does not belong to this signed-in creation.');
    const sourceReady = Boolean(saved.model_storage_path || saved.model_url);
    if (!sourceReady) throw new Error('Finish the first 3D build before making the voxel.');

    const providerTaskId = propertyGenerationProviderTaskId(saved.task_id || sourceTaskId);
    if (providerTaskId) {
      try {
        thumbnailUrl = await freshGenerated3DThumbnail(apiKey, providerTaskId);
      } catch {
        thumbnailUrl = clean(saved.thumbnail_url, 2200);
      }
    } else {
      thumbnailUrl = clean(saved.thumbnail_url, 2200);
    }
  } else {
    thumbnailUrl = await recoveredGenerated3DReference(apiKey, userId, sourceTaskId) || '';
    if (!thumbnailUrl) throw new Error('That first 3D build does not belong to this signed-in creation.');
  }

  if (!isHttpUrl(thumbnailUrl)) throw new Error('The first 3D build finished without a usable preview render. Retry the 3D build before voxelizing it.');
  const stableReference = await stableReferenceDataUri(thumbnailUrl);
  return [{
    url: stableReference,
    rightsBasis: 'licensed-derivative',
    rightsReference: 'Voxel Vault generated this 3D preview from the signed-in user-authorized source photo for this creation.',
    label: 'Generated 3D preview',
  }];
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });

  const apiKey = process.env.MESHY_API_KEY?.trim();
  if (!apiKey) return privateJson({ ok: false, error: 'Voxel image generation is not configured on this deployment.' }, { status: 503 });

  try {
    const body = await request.json().catch(() => ({}));
    const draftId = clean(body?.draftId, 100);
    const address = clean(body?.address, 220);
    const atlasId = clean(body?.atlasId, 180);
    const requiredCredits = draftId ? MESHY_PROPERTY_CREDITS.afterSource : MESHY_PROPERTY_CREDITS.voxelImage;
    const balance = await readMeshyCreditBalance(apiKey);
    if (!meshyCreditsSufficient(balance, requiredCredits)) {
      return privateJson(
        meshyCreditError(
          draftId ? 'starting the VoxelPop style pass and final 3D' : 'starting the VoxelPop image pass',
          requiredCredits,
        ),
        { status: 503 },
      );
    }

    const references = draftId
      ? await generated3DReference(apiKey, auth.user.id, draftId, body?.source3dTaskId)
      : validateReferences(body?.references);
    if (!draftId && (!address || !atlasId)) return privateJson({ ok: false, error: 'A resolved property is required.' }, { status: 400 });
    if (!references.length) return privateJson({ ok: false, error: 'A rights-cleared visual reference is required before making the voxel.' }, { status: 400 });

    const subject = draftId ? 'the exact building shown in the generated 3D reference render' : `the exact property shown in the supplied reference photo${references.length > 1 ? 's' : ''}: ${address}`;
    const prompt = [
      `Create a faithful VoxelPop-style voxel architectural rendering of ${subject}.`,
      'Preserve the visible building identity, overall massing, roof shape and roofline, facade proportions, window and door placement, major openings, material colors, trim, steps and other obvious permanent architectural details visible in the reference.',
      'Do not redesign, beautify, modernize, add floors, remove floors, invent windows, move doors, change the roof type, or substitute a generic house.',
      'Translate the reference into crisp premium block geometry, small readable voxel details and believable voxel materials while keeping the same building immediately recognizable.',
      'Keep ground and surrounding context simple and secondary so the building remains the subject.',
      'No text, labels, logos, watermarks, UI, borders or fantasy additions.',
      'This is a visual voxel interpretation from a generated 3D preview and/or source imagery, not a survey, deed, appraisal, or claim of perfect physical accuracy.',
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
    if (!create.ok) {
      return privateJson(
        meshyProviderFailure(
          create.status,
          created,
          `Voxel image provider returned ${create.status}.`,
          'starting the VoxelPop image pass',
          MESHY_PROPERTY_CREDITS.voxelImage,
        ),
        { status: meshyClientStatus(create.status) },
      );
    }

    const taskId = clean(created?.result || created?.id, 240);
    if (!taskId) throw new Error('The voxel image provider did not return a task ID.');

    return privateJson({
      ok: true,
      status: 'PENDING',
      taskId,
      taskToken: taskToken(apiKey, auth.user.id, taskId),
      referenceCount: references.length,
      sourceLabels: references.map((item) => item.label),
      note: draftId ? 'Voxel styling started from a fresh, account-verified 3D preview snapshot.' : 'Voxel creation started from rights-cleared property imagery.',
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
    if (!statusResponse.ok) {
      return privateJson(
        meshyProviderFailure(statusResponse.status, task, `Could not read voxel image task (${statusResponse.status}).`, 'reading the VoxelPop image task'),
        { status: meshyClientStatus(statusResponse.status) },
      );
    }

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
        note: 'Voxel style pass complete. It is a visual interpretation, not a deed, survey, appraisal, or physical-property right.',
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
