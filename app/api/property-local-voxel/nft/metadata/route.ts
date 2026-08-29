import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { readCatalog3DByTask } from '../../../../../lib/catalog3dStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOCAL_PROVIDER = 'voxelpop-local-webgl-v1';
const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;

function clean(value: unknown, max = 180) {
  return String(value || '').trim().slice(0, max);
}

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

function hmac(value: string) {
  const key = secret();
  return key ? createHmac('sha256', key).update(value).digest('hex') : '';
}

function validSignature(expected: string, provided: string) {
  if (!expected || !/^[a-f0-9]{64}$/i.test(provided)) return false;
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const draftId = clean(url.searchParams.get('draftId'), 80);
    const taskId = clean(url.searchParams.get('taskId'), 160);
    const label = clean(url.searchParams.get('label') || 'VoxelPop Property', 90).replace(/[<>]/g, '') || 'VoxelPop Property';
    const sig = clean(url.searchParams.get('sig'), 80);
    const expected = hmac(`local-property-metadata:${draftId}:${taskId}:${label}`);
    if (!draftId || !taskId.startsWith('local-v1:') || !validSignature(expected, sig)) {
      return NextResponse.json({ error: 'This VoxelPop metadata link is invalid.' }, { status: 403 });
    }

    const model = await readCatalog3DByTask(taskId);
    if (!model || model.provider !== LOCAL_PROVIDER || model.status !== 'SUCCEEDED' || !model.model_url) {
      return NextResponse.json({ error: 'This VoxelPop model is unavailable.' }, { status: 404 });
    }

    const imageSig = hmac(`local-property-image:${draftId}:${taskId}`);
    const origin = url.origin;
    const image = `${origin}/api/property-local-voxel/nft/image?${new URLSearchParams({ draftId, taskId, sig: imageSig }).toString()}`;

    return NextResponse.json({
      name: `${label} · VoxelPop`,
      description: 'A user-reviewed VoxelPop digital property voxel created from an authorized reference photo and saved as a digital asset. This NFT is not a deed, title record, property equity, occupancy right, rent right, or real-estate investment.',
      image,
      animation_url: model.model_url,
      // Immediate minting is allowed before a map-backed property draft exists,
      // so the stable Vault collection is the canonical safe external page.
      external_url: `${origin}/vault/property-drafts`,
      attributes: [
        { trait_type: 'Asset type', value: 'Digital VoxelPop property' },
        { trait_type: '3D engine', value: 'VoxelPop local reviewed voxel' },
        { trait_type: 'Physical property rights', value: 'None' },
        { trait_type: 'Deed / title', value: 'Not represented by this NFT' },
      ],
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'This VoxelPop metadata could not be loaded.' }, { status: 500 });
  }
}
