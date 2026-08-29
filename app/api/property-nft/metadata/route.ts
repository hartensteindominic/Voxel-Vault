import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;

function clean(value: unknown, max = 500) {
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
  const taskId = clean(url.searchParams.get('taskId'), 180);
  const draftId = clean(url.searchParams.get('draftId'), 100);
  const name = clean(url.searchParams.get('name'), 72) || 'VoxelPop Property';
  const sig = clean(url.searchParams.get('sig'), 80);
  const expected = hmacHex(`property-metadata:${taskId}|${draftId}|${name}`);
  if (!taskId.startsWith('local-v1:') || !draftId || !validSignature(sig, expected)) {
    return NextResponse.json({ error: 'Invalid property voxel metadata link.' }, { status: 403 });
  }

  const imageSig = hmacHex(`property-media:${taskId}|${draftId}|image`);
  const modelSig = hmacHex(`property-media:${taskId}|${draftId}|model`);
  const image = `${url.origin}/api/property-nft/media?${new URLSearchParams({ taskId, draftId, kind: 'image', sig: imageSig }).toString()}`;
  const animationUrl = `${url.origin}/api/property-nft/media?${new URLSearchParams({ taskId, draftId, kind: 'model', sig: modelSig }).toString()}`;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || url.origin).replace(/\/$/, '');

  return NextResponse.json({
    name,
    description: 'A photo-reviewed VoxelPop digital property voxel minted through VoxelFlip on Base. This NFT is a digital creation only and does not represent a deed, title, fractional real-estate ownership, rent rights, occupancy, or an investment interest.',
    image,
    animation_url: animationUrl,
    external_url: `${appUrl}/world`,
    attributes: [
      { trait_type: 'Origin', value: 'VoxelPop by Voxel Vault' },
      { trait_type: 'Asset type', value: 'Digital property voxel' },
      { trait_type: 'Creation flow', value: 'Photo reviewed before voxel' },
      { trait_type: '3D engine', value: 'VoxelPop local' },
      { trait_type: 'Network', value: 'Base' },
      { trait_type: 'Real property rights', value: 'None' },
    ],
  }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } });
}
