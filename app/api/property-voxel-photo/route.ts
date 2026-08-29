import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../lib/user-auth';
import { normalizePropertyDraftId } from '../../../lib/property-generation-ids';
import { readPropertyCollectibleReservation } from '../../../lib/property-collectible-commerce';
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

const ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-image';
const MAX_REFERENCE_BYTES = 4 * 1024 * 1024;
const MAX_RESULT_BYTES = 7 * 1024 * 1024;

function clean(value: unknown, max = 1200) {
  return String(value || '').trim().slice(0, max);
}

function privateJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) },
  });
}

function taskToken(apiKey: string, userId: string, draftId: string, taskId: string) {
  return createHmac('sha256', apiKey)
    .update(`voxelpop-property-photo-v1:${userId}:${draftId}:${taskId}`)
    .digest('hex');
}

function final3dTaskToken(apiKey: string, userId: string, taskId: string) {
  return createHmac('sha256', apiKey)
    .update(`property-voxel-image-v1:${userId}:${taskId}`)
    .digest('hex');
}

function parseReferenceDataUrl(input: unknown) {
  const reference = String(input || '').trim();
  const match = reference.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error('A prepared JPG, PNG, or WebP house photo is required.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_REFERENCE_BYTES) {
    throw new Error('The prepared house photo is too large. Try a smaller photo or screenshot.');
  }
  return reference;
}

async function verifyConfirmedDraft(userId: string, draftId: string, identityKeyRaw: unknown) {
  const identityKey = clean(identityKeyRaw, 96);
  if (!identityKey) throw new Error('Confirm the property address before generating the voxel.');
  const reservation = await readPropertyCollectibleReservation(identityKey);
  if (!reservation || reservation.buyerUserId !== userId || reservation.draftId !== draftId) {
    throw new Error('That confirmed property does not belong to this signed-in creation.');
  }
  if (!['reserved', 'paid', 'minted'].includes(reservation.state)) {
    throw new Error('Confirm the property address before generating the voxel.');
  }
  return reservation;
}

function generationPrompt(address: string) {
  const place = clean(address, 220);
  return [
    'Transform the reference house photo into a premium VoxelPop voxel image.',
    'The house must remain immediately recognizable as the same visible building in the reference.',
    'Preserve visible roof shape and pitch, story count, facade proportions, window and door count and placement, porch or steps, attached structures, exterior materials, trim, and color relationships.',
    'Render the house with crisp dimensional voxel blocks, colorful but faithful materials, clean edges, soft studio daylight, grounded contact shadows, and a polished collectible presentation.',
    'Do not add or remove floors, doors, windows, garages, porches, or other permanent architectural features that contradict the reference.',
    'Do not invent hidden rear geometry. Use a simple warm neutral background with no text, labels, logos, people, watermark, frame, or UI.',
    place ? `The confirmed property label is ${place}; use it only as context and do not render the address as text.` : '',
  ].filter(Boolean).join(' ');
}

async function imageDataUrl(imageUrl: string) {
  const response = await fetch(imageUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error('The completed VoxelPop image could not be opened.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_RESULT_BYTES) {
    throw new Error('The completed VoxelPop image is too large to prepare for the 3D voxel.');
  }
  const rawType = clean(response.headers.get('content-type'), 80).toLowerCase().split(';')[0];
  const mime = ['image/jpeg', 'image/png', 'image/webp'].includes(rawType) ? rawType : 'image/png';
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });

  const apiKey = process.env.MESHY_API_KEY?.trim();
  if (!apiKey) return privateJson({ ok: false, error: 'VoxelPop image generation is not configured on this deployment.' }, { status: 503 });

  try {
    const body = await request.json().catch(() => ({}));
    const draftId = normalizePropertyDraftId(body?.draftId);
    const reference = parseReferenceDataUrl(body?.reference);
    const reservation = await verifyConfirmedDraft(auth.user.id, draftId, body?.identityKey);

    // The user asked for one uninterrupted flow. Do not spend the image credits
    // unless there are enough provider credits left to also create the final GLB.
    const balance = await readMeshyCreditBalance(apiKey);
    if (!meshyCreditsSufficient(balance, MESHY_PROPERTY_CREDITS.afterSource)) {
      return privateJson(
        meshyCreditError('starting the VoxelPop image and final 3D build', MESHY_PROPERTY_CREDITS.afterSource),
        { status: 503 },
      );
    }

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ai_model: 'nano-banana',
        prompt: generationPrompt(reservation.address),
        reference_image_urls: [reference],
        aspect_ratio: '1:1',
        remove_background: false,
      }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return privateJson(
        meshyProviderFailure(
          response.status,
          data,
          `VoxelPop image provider returned ${response.status}.`,
          'starting the VoxelPop house image',
          MESHY_PROPERTY_CREDITS.voxelImage,
        ),
        { status: meshyClientStatus(response.status) },
      );
    }

    const taskId = clean(data?.result || data?.id || data?.task_id, 240);
    if (!taskId) throw new Error('The VoxelPop image provider did not return a task ID.');

    return privateJson({
      ok: true,
      taskId,
      taskToken: taskToken(apiKey, auth.user.id, draftId, taskId),
      voxelImageTaskToken: final3dTaskToken(apiKey, auth.user.id, taskId),
      draftId,
      atlasId: reservation.atlasId,
      identityKey: reservation.identityKey,
      propertyAddress: reservation.address,
      provider: 'meshy-nano-banana-voxelpop',
      onePropertyOnePurchase: true,
      onePropertyOneMint: true,
    });
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof Error ? error.message : 'VoxelPop image generation could not start.' }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });

  const apiKey = process.env.MESHY_API_KEY?.trim();
  if (!apiKey) return privateJson({ ok: false, error: 'VoxelPop image generation is not configured on this deployment.' }, { status: 503 });

  try {
    const url = new URL(request.url);
    const draftId = normalizePropertyDraftId(url.searchParams.get('draftId'));
    const taskId = clean(url.searchParams.get('taskId'), 240);
    const suppliedToken = clean(url.searchParams.get('taskToken'), 128);
    if (!taskId || suppliedToken !== taskToken(apiKey, auth.user.id, draftId, taskId)) {
      return privateJson({ ok: false, error: 'That VoxelPop image job does not belong to this signed-in creation.' }, { status: 404 });
    }

    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return privateJson(
        meshyProviderFailure(response.status, data, 'Could not read the VoxelPop image job.', 'reading the VoxelPop house image'),
        { status: meshyClientStatus(response.status) },
      );
    }

    const status = clean(data?.status || 'PENDING', 60).toUpperCase();
    const progress = Math.max(0, Math.min(100, Number(data?.progress || 0)));
    if (status === 'FAILED' || status === 'CANCELED' || status === 'CANCELLED') {
      return privateJson({ ok: false, status, progress, error: clean(data?.task_error?.message || data?.error || data?.message, 600) || 'VoxelPop image generation failed.' }, { status: 502 });
    }
    if (status !== 'SUCCEEDED' && status !== 'COMPLETED') {
      return privateJson({ ok: true, status, progress, ready: false });
    }

    const providerImageUrl = Array.isArray(data?.image_urls)
      ? clean(data.image_urls[0], 2200)
      : clean(data?.image_url || data?.output?.image_url || data?.result?.image_url, 2200);
    if (!/^https?:\/\//i.test(providerImageUrl)) throw new Error('The completed VoxelPop image is unavailable.');

    return privateJson({
      ok: true,
      status: 'SUCCEEDED',
      progress: 100,
      ready: true,
      imageUrl: providerImageUrl,
      imageDataUrl: await imageDataUrl(providerImageUrl),
      voxelImageTaskToken: final3dTaskToken(apiKey, auth.user.id, taskId),
    });
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof Error ? error.message : 'VoxelPop image generation status could not be read.' }, { status: 400 });
  }
}
