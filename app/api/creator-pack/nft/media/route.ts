import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MESH_ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;

function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  if (PRIVATE_KEY_RE.test(trimmed)) return `0x${trimmed}`;
  if (/^0X[a-fA-F0-9]{64}$/.test(trimmed)) return `0x${trimmed.slice(2)}`;
  return trimmed;
}
function secret() {
  const raw = process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY?.trim() || '';
  return raw ? normalizePrivateKey(raw) : '';
}
function hmacHex(value: string) {
  const key = secret();
  return key ? createHmac('sha256', key).update(value).digest('hex') : '';
}
function validSignature(actual: string, expected: string) {
  if (!/^[a-f0-9]{64}$/i.test(actual) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const taskId = (url.searchParams.get('taskId') || '').trim();
  const kind = url.searchParams.get('kind') === 'image' ? 'image' : 'model';
  const sig = (url.searchParams.get('sig') || '').trim();
  if (!taskId || !validSignature(sig, hmacHex(`media:${taskId}`))) {
    return NextResponse.json({ error: 'Invalid VoxelFlip media link.' }, { status: 403 });
  }

  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: '3D media is not configured.' }, { status: 503 });

  const taskResponse = await fetch(`${MESH_ENDPOINT}/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });
  const data = await taskResponse.json().catch(() => ({}));
  if (!taskResponse.ok || String(data?.status || '').toUpperCase() !== 'SUCCEEDED') {
    return NextResponse.json({ error: 'VoxelFlip media is not ready.' }, { status: 409 });
  }

  const remoteUrl = kind === 'model'
    ? (typeof data?.model_urls?.glb === 'string' ? data.model_urls.glb : '')
    : (typeof data?.alpha_thumbnail_url === 'string' ? data.alpha_thumbnail_url : (typeof data?.thumbnail_url === 'string' ? data.thumbnail_url : ''));
  if (!remoteUrl) return NextResponse.json({ error: 'VoxelFlip media is unavailable.' }, { status: 404 });

  const mediaResponse = await fetch(remoteUrl, { cache: 'no-store' });
  if (!mediaResponse.ok || !mediaResponse.body) return NextResponse.json({ error: 'VoxelFlip media could not be loaded.' }, { status: 502 });

  const contentType = kind === 'model' ? 'model/gltf-binary' : (mediaResponse.headers.get('content-type') || 'image/png');
  return new NextResponse(mediaResponse.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      'Content-Disposition': `inline; filename="voxelflip.${kind === 'model' ? 'glb' : 'png'}"`,
    },
  });
}
