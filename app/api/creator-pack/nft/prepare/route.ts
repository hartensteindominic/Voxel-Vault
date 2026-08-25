import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { getBytes, keccak256, solidityPackedKeccak256, toUtf8Bytes, Wallet } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelPopEntitlement, updateVoxelPopEntitlementMetadata } from '../../../../../lib/voxelpop-entitlement';
import { attributionFromMetadata, recordVoxelPopEvent } from '../../../../../lib/voxelpop-analytics';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MESH_ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const TASK_KEY = 'mesh_task_0';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;

function safeName(value: unknown) {
  const cleaned = String(value || 'your-voxel').trim().slice(0, 72).replace(/[^a-z0-9 _-]+/gi, '').replace(/\s+/g, ' ');
  return cleaned || 'your-voxel';
}
function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  if (PRIVATE_KEY_RE.test(trimmed)) return `0x${trimmed}`;
  if (/^0X[a-fA-F0-9]{64}$/.test(trimmed)) return `0x${trimmed.slice(2)}`;
  return trimmed;
}
function signingSecret() {
  const raw = process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY?.trim() || '';
  return raw ? normalizePrivateKey(raw) : '';
}
function hmacHex(value: string) {
  const secret = signingSecret();
  if (!secret) return '';
  return createHmac('sha256', secret).update(value).digest('hex');
}
function voucherIdFor(sessionId: string, taskId: string) {
  return `0x${createHash('sha256').update(`voxelflip:${sessionId}:${taskId}`).digest('hex')}`;
}
async function mintVoucher(wallet: string, metadataUrl: string, voucherId: string) {
  const rawPrivateKey = process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY;
  if (!rawPrivateKey) return null;
  const signer = new Wallet(normalizePrivateKey(rawPrivateKey));
  const uriHash = keccak256(toUtf8Bytes(metadataUrl));
  const digest = solidityPackedKeccak256(['address', 'bytes32', 'bytes32'], [wallet, uriHash, voucherId]);
  const signature = await signer.signMessage(getBytes(digest));
  return { signature, signer: signer.address };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.MESHY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: '3D mesh generation is not configured.' }, { status: 503 });
    const body = await request.json();
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
    const taskId = typeof body?.taskId === 'string' ? body.taskId : '';
    const imageDataUrl = typeof body?.image === 'string' ? body.image : '';
    const idea = typeof body?.idea === 'string' ? body.idea.trim().slice(0, 120) : '';
    const wallet = typeof body?.wallet === 'string' ? body.wallet.trim() : '';
    const name = safeName(body?.name);
    if (!sessionId || !taskId || !/^data:image\/(png|jpeg);base64,/.test(imageDataUrl) || !ADDRESS_RE.test(wallet)) {
      return NextResponse.json({ error: 'A connected wallet, completed VoxelPop image, and finished 3D mesh are required.' }, { status: 400 });
    }
    if (imageDataUrl.length > 5_500_000) return NextResponse.json({ error: 'The source image is too large to prepare for minting.' }, { status: 400 });

    const entitlement = await getVoxelPopEntitlement(sessionId);
    if (!entitlement) return NextResponse.json({ error: 'A completed VoxelPop purchase is required.' }, { status: 403 });
    if (entitlement.metadata?.[TASK_KEY] !== taskId) return NextResponse.json({ error: 'This 3D mesh does not belong to the current purchase.' }, { status: 403 });

    const meshResponse = await fetch(`${MESH_ENDPOINT}/${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' });
    const meshData = await meshResponse.json().catch(() => ({}));
    const status = String(meshData?.status || '').toUpperCase();
    const remoteModelUrl = typeof meshData?.model_urls?.glb === 'string' ? meshData.model_urls.glb : '';
    const remoteImageUrl = typeof meshData?.alpha_thumbnail_url === 'string' ? meshData.alpha_thumbnail_url : (typeof meshData?.thumbnail_url === 'string' ? meshData.thumbnail_url : '');
    if (!meshResponse.ok || status !== 'SUCCEEDED' || !remoteModelUrl) {
      return NextResponse.json({ error: 'Finish the 3D mesh before preparing the NFT.' }, { status: 409 });
    }

    const payment = entitlement.paymentMethod === 'crypto' ? 'ETH' : 'Card';
    const assetId = createHash('sha256').update(`${sessionId}:${taskId}`).digest('hex').slice(0, 32);
    const origin = new URL(request.url).origin;
    const mediaSig = hmacHex(`media:${taskId}`);
    const metadataSig = hmacHex(`metadata:${taskId}|${name}|${idea}|${payment}`);
    if (!mediaSig || !metadataSig) return NextResponse.json({ error: 'VoxelFlip mint signer is not configured.' }, { status: 503 });

    const imageUrl = `${origin}/api/creator-pack/nft/media?${new URLSearchParams({ taskId, kind: 'image', sig: mediaSig }).toString()}`;
    const modelUrl = `${origin}/api/creator-pack/nft/media?${new URLSearchParams({ taskId, kind: 'model', sig: mediaSig }).toString()}`;
    const metadataUrl = `${origin}/api/creator-pack/nft/metadata?${new URLSearchParams({ taskId, name, idea, payment, sig: metadataSig }).toString()}`;
    const voucherId = voucherIdFor(sessionId, taskId);
    const voucher = await mintVoucher(wallet, metadataUrl, voucherId);

    try {
      await updateVoxelPopEntitlementMetadata(entitlement, {
        voxelflip_asset_id: assetId,
        voxelflip_wallet: wallet.toLowerCase(),
        voxelflip_metadata_url: metadataUrl.slice(0, 500),
      });
    } catch (error) {
      console.warn('VoxelFlip entitlement metadata persistence is unavailable; mint can continue.', error);
    }

    const attribution = attributionFromMetadata(entitlement.metadata);
    await recordVoxelPopEvent({
      eventName: 'nft_prepared', eventKey: `nft_prepared:${sessionId}:${taskId}`, flowId: entitlement.metadata?.flow_id || null,
      stripeSessionId: entitlement.paymentMethod === 'stripe' ? entitlement.id : null, attribution,
      details: { assetId, format: 'glb', wallet: wallet.toLowerCase(), voucherReady: Boolean(voucher), payment_method: entitlement.paymentMethod },
    });

    return NextResponse.json({
      ready: true,
      assetId,
      metadataUrl,
      imageUrl,
      modelUrl,
      sourcePreviewUrl: remoteImageUrl || null,
      name: `${name} · VoxelFlip`,
      wallet,
      voucherId,
      mintConfigured: Boolean(voucher),
      signature: voucher?.signature || null,
      signer: voucher?.signer || null,
    });
  } catch (error) {
    console.error('VoxelFlip NFT preparation failed', error);
    return NextResponse.json({ error: 'Unable to prepare this 3D voxel for NFT minting right now.' }, { status: 500 });
  }
}
