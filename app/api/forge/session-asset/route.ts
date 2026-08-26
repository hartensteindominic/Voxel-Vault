import { NextResponse } from 'next/server';
import { getVoxelPopEntitlement } from '../../../../lib/voxelpop-entitlement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MESH_ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const PROVIDER_TIMEOUT_MS = 8_000;

function clean(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max);
}

async function timedFetch(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = clean(url.searchParams.get('sessionId'), 300);
    if (!sessionId) return NextResponse.json({ error: 'Missing paid VoxelPop session.' }, { status: 400 });

    const entitlement = await getVoxelPopEntitlement(sessionId);
    if (!entitlement) return NextResponse.json({ error: 'This paid VoxelPop session could not be verified.' }, { status: 403 });

    const taskId = clean(entitlement.metadata?.mesh_task_0, 200);
    if (!taskId) return NextResponse.json({ error: 'This paid voxel does not have a saved 3D task yet.' }, { status: 404 });

    const apiKey = clean(process.env.MESHY_API_KEY, 1000);
    if (!apiKey) return NextResponse.json({ error: '3D recovery is not configured on this deployment.' }, { status: 503 });

    const response = await timedFetch(`${MESH_ENDPOINT}/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: clean(data?.message || data?.error || 'Could not refresh this 3D voxel.') }, { status: 502 });
    }

    const providerStatus = clean(data?.status, 40).toUpperCase();
    const providerModelUrl = typeof data?.model_urls?.glb === 'string' ? data.model_urls.glb : '';
    const ready = providerStatus === 'SUCCEEDED' && Boolean(providerModelUrl);
    const thumbnailUrl = clean(data?.alpha_thumbnail_url || data?.thumbnail_url || '/voxelpop/voxelpop-logo.png', 2000);
    const name = clean(entitlement.metadata?.mesh_name_0 || 'Your voxel', 80);
    const idea = clean(entitlement.metadata?.mesh_idea_0 || '', 160);

    const tokenId = clean(entitlement.metadata?.voxelflip_token_id, 80);
    const owner = clean(entitlement.metadata?.voxelflip_wallet, 80);
    const txHash = clean(entitlement.metadata?.voxelflip_tx_hash, 100);
    const metadataUrl = clean(entitlement.metadata?.voxelflip_metadata_url, 1000);
    const contract = clean(entitlement.metadata?.voxelflip_contract, 80);

    const stableModelUrl = ready
      ? `/api/creator-pack/mesh?${new URLSearchParams({ sessionId, taskId, preview: '1' }).toString()}`
      : '';
    const updatedAt = new Date().toISOString();

    const record = {
      sessionId,
      updatedAt,
      payload: {
        asset: { name, dataUrl: thumbnailUrl },
        mesh: {
          status: ready ? 'ready' : providerStatus.toLowerCase() || 'unknown',
          progress: ready ? 100 : Number(data?.progress || 0),
          taskId,
          modelUrl: stableModelUrl,
          error: clean(data?.task_error?.message || '', 500),
        },
        ...(tokenId ? {
          mint: {
            tokenId,
            owner,
            hash: txHash,
            txHash,
            metadataUrl,
            ...(contract ? { contract, contractAddress: contract } : {}),
          },
        } : {}),
        generationsLeft: 0,
        idea,
        updatedAt,
      },
    };

    return NextResponse.json({
      recovered: true,
      ready,
      record,
      safety: 'Read-only paid-session recovery. No mint, approval, transfer, listing, burn, or wallet signature is requested.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Focused Forge session recovery failed', error);
    return NextResponse.json({ error: 'Could not recover this paid 3D voxel right now.' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
