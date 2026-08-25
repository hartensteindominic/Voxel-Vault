import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

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
  const name = (url.searchParams.get('name') || 'your-voxel').trim().slice(0, 72);
  const idea = (url.searchParams.get('idea') || '').trim().slice(0, 120);
  const sig = (url.searchParams.get('sig') || '').trim();
  const expected = hmacHex(`metadata:${taskId}|${name}|${idea}|Card`);
  if (!taskId || !validSignature(sig, expected)) return NextResponse.json({ error: 'Invalid VoxelFlip metadata link.' }, { status: 403 });

  const origin = url.origin;
  const mediaSig = hmacHex(`media:${taskId}`);
  const image = `${origin}/api/creator-pack/nft/media?${new URLSearchParams({ taskId, kind: 'image', sig: mediaSig }).toString()}`;
  const animationUrl = `${origin}/api/creator-pack/nft/media?${new URLSearchParams({ taskId, kind: 'model', sig: mediaSig }).toString()}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
  return NextResponse.json({
    name: `${name || 'your-voxel'} · VoxelFlip`,
    description: 'A 3D VoxelPop collectible prepared for VoxelFlip. The owner can hold, transfer, trade, or list the NFT. Resale value is never guaranteed.',
    image,
    animation_url: animationUrl,
    external_url: `${appUrl}/?utm_source=opensea&utm_medium=nft&utm_campaign=voxelflip`,
    attributes: [
      { trait_type: 'Origin', value: 'VoxelPop by Voxel Vault' },
      { trait_type: 'Format', value: '3D GLB' },
      { trait_type: 'Mode', value: 'VoxelFlip' },
      { trait_type: 'Starting asset', value: '$1.99 VoxelPop' },
      { trait_type: 'Payment', value: 'Card' },
      ...(idea ? [{ trait_type: 'Concept', value: idea }] : []),
    ],
  }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } });
}
