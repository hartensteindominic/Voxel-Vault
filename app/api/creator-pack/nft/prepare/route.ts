import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { stripe } from '../../../../../lib/stripe-server';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';
import { attributionFromMetadata, recordVoxelPopEvent } from '../../../../../lib/voxelpop-analytics';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MESH_ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const BUCKET = 'voxelflip-nft';
const TASK_KEY = 'mesh_task_0';

function safeName(value: unknown) {
  const cleaned = String(value || 'your-voxel')
    .trim()
    .slice(0, 72)
    .replace(/[^a-z0-9 _-]+/gi, '')
    .replace(/\s+/g, ' ');
  return cleaned || 'your-voxel';
}

function decodeImage(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const type = match[1] === 'jpeg' ? 'jpeg' : 'png';
  return {
    bytes: Buffer.from(match[2], 'base64'),
    contentType: type === 'jpeg' ? 'image/jpeg' : 'image/png',
    extension: type === 'jpeg' ? 'jpg' : 'png',
  };
}

async function ensureBucket() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  const existing = data?.find((bucket) => bucket.name === BUCKET);
  if (!existing) {
    const created = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: '100MB',
      allowedMimeTypes: ['image/png', 'image/jpeg', 'model/gltf-binary', 'application/json'],
    });
    if (created.error) throw created.error;
  } else if (!existing.public) {
    const updated = await supabase.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: '100MB',
      allowedMimeTypes: ['image/png', 'image/jpeg', 'model/gltf-binary', 'application/json'],
    });
    if (updated.error) throw updated.error;
  }
  return supabase;
}

async function paidSession(sessionId: string) {
  if (!sessionId) return null;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid' || session.metadata?.product !== 'voxelpop-3d-asset') return null;
  return session;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.MESHY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: '3D mesh generation is not configured.' }, { status: 503 });

    const body = await request.json();
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
    const taskId = typeof body?.taskId === 'string' ? body.taskId : '';
    const imageDataUrl = typeof body?.image === 'string' ? body.image : '';
    const idea = typeof body?.idea === 'string' ? body.idea.trim().slice(0, 240) : '';
    const name = safeName(body?.name);
    const image = decodeImage(imageDataUrl);

    if (!sessionId || !taskId || !image) {
      return NextResponse.json({ error: 'A completed VoxelPop image and 3D mesh are required.' }, { status: 400 });
    }
    if (image.bytes.length > 4_000_000) {
      return NextResponse.json({ error: 'The source image is too large to prepare for minting.' }, { status: 400 });
    }

    const session = await paidSession(sessionId);
    if (!session) return NextResponse.json({ error: 'A completed VoxelPop purchase is required.' }, { status: 403 });
    if (session.metadata?.[TASK_KEY] !== taskId) {
      return NextResponse.json({ error: 'This 3D mesh does not belong to the current purchase.' }, { status: 403 });
    }

    const meshResponse = await fetch(`${MESH_ENDPOINT}/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    const meshData = await meshResponse.json().catch(() => ({}));
    const status = String(meshData?.status || '').toUpperCase();
    const remoteModelUrl = typeof meshData?.model_urls?.glb === 'string' ? meshData.model_urls.glb : '';
    if (!meshResponse.ok || status !== 'SUCCEEDED' || !remoteModelUrl) {
      return NextResponse.json({ error: 'Finish the 3D mesh before preparing the NFT.' }, { status: 409 });
    }

    const modelResponse = await fetch(remoteModelUrl, { cache: 'no-store' });
    if (!modelResponse.ok) {
      return NextResponse.json({ error: 'The finished GLB could not be preserved for the NFT.' }, { status: 502 });
    }
    const modelBytes = Buffer.from(await modelResponse.arrayBuffer());
    if (modelBytes.length > 100_000_000) {
      return NextResponse.json({ error: 'The finished GLB is too large for NFT preparation.' }, { status: 413 });
    }

    const assetId = createHash('sha256').update(`${sessionId}:${taskId}`).digest('hex').slice(0, 32);
    const supabase = await ensureBucket();
    const basePath = `assets/${assetId}`;
    const imagePath = `${basePath}/source.${image.extension}`;
    const modelPath = `${basePath}/model.glb`;
    const metadataPath = `${basePath}/metadata.json`;

    const imageUpload = await supabase.storage.from(BUCKET).upload(imagePath, image.bytes, {
      contentType: image.contentType,
      cacheControl: '31536000',
      upsert: true,
    });
    if (imageUpload.error) throw imageUpload.error;

    const modelUpload = await supabase.storage.from(BUCKET).upload(modelPath, modelBytes, {
      contentType: 'model/gltf-binary',
      cacheControl: '31536000',
      upsert: true,
    });
    if (modelUpload.error) throw modelUpload.error;

    const imageUrl = supabase.storage.from(BUCKET).getPublicUrl(imagePath).data.publicUrl;
    const modelUrl = supabase.storage.from(BUCKET).getPublicUrl(modelPath).data.publicUrl;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io';
    const metadata = {
      name: `${name} · VoxelFlip`,
      description: 'A 3D VoxelPop collectible prepared for VoxelFlip. The owner can hold, transfer, trade, or list the NFT. Resale value is never guaranteed.',
      image: imageUrl,
      animation_url: modelUrl,
      external_url: `${appUrl}/?utm_source=opensea&utm_medium=nft&utm_campaign=voxelflip`,
      attributes: [
        { trait_type: 'Origin', value: 'VoxelPop by Voxel Vault' },
        { trait_type: 'Format', value: '3D GLB' },
        { trait_type: 'Mode', value: 'VoxelFlip' },
        { trait_type: 'Starting asset', value: '$1.99 VoxelPop' },
        ...(idea ? [{ trait_type: 'Concept', value: idea.slice(0, 120) }] : []),
      ],
    };

    const metadataUpload = await supabase.storage.from(BUCKET).upload(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      { contentType: 'application/json', cacheControl: '31536000', upsert: true },
    );
    if (metadataUpload.error) throw metadataUpload.error;

    const metadataUrl = supabase.storage.from(BUCKET).getPublicUrl(metadataPath).data.publicUrl;
    await stripe.checkout.sessions.update(sessionId, {
      metadata: {
        ...(session.metadata || {}),
        voxelflip_asset_id: assetId,
        voxelflip_metadata_url: metadataUrl.slice(0, 500),
      },
    });

    const attribution = attributionFromMetadata(session.metadata);
    await recordVoxelPopEvent({
      eventName: 'nft_prepared',
      eventKey: `nft_prepared:${sessionId}:${taskId}`,
      flowId: session.metadata?.flow_id || null,
      stripeSessionId: sessionId,
      attribution,
      details: { assetId, format: 'glb' },
    });

    return NextResponse.json({
      ready: true,
      assetId,
      metadataUrl,
      imageUrl,
      modelUrl,
      name: metadata.name,
    });
  } catch (error) {
    console.error('VoxelFlip NFT preparation failed', error);
    return NextResponse.json({ error: 'Unable to prepare this 3D voxel for NFT minting right now.' }, { status: 500 });
  }
}
