import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Contract, JsonRpcProvider, getAddress, verifyMessage } from 'ethers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const BASE_CHAIN_ID = 8453;
const IMAGE_ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-image';
const MESH_ENDPOINT = 'https://api.meshy.ai/openapi/v1/multi-image-to-3d';
const MAX_SIGNATURE_AGE_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
const ERC721_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];

type ParentInput = { contract?: string; tokenId?: string | number };
type VerifiedParent = { contract: string; tokenId: string; name: string; image: string; tokenURI: string };

function clean(value: unknown, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function ipfsToHttp(value: string) {
  if (value.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${value.slice(7)}`;
  if (value.startsWith('ar://')) return `https://arweave.net/${value.slice(5)}`;
  return value;
}

async function timedFetch(url: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseDataJson(uri: string) {
  try {
    if (uri.startsWith('data:application/json;base64,')) {
      return JSON.parse(Buffer.from(uri.slice('data:application/json;base64,'.length), 'base64').toString('utf8'));
    }
    if (uri.startsWith('data:application/json,')) {
      return JSON.parse(decodeURIComponent(uri.slice('data:application/json,'.length)));
    }
  } catch {}
  return null;
}

async function metadataFromTokenURI(tokenURI: string) {
  const inline = parseDataJson(tokenURI);
  if (inline) return inline;
  const resolved = ipfsToHttp(tokenURI);
  if (!/^https?:\/\//i.test(resolved)) throw new Error('Parent NFT metadata is not readable by the fusion service.');
  const response = await timedFetch(resolved, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Could not read parent metadata (${response.status}).`);
  return response.json().catch(() => ({}));
}

function providers() {
  const configured = clean(process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL, 2000);
  const urls = Array.from(new Set([
    configured,
    'https://base.blockscout.com/api/eth-rpc',
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
  ].filter(Boolean)));
  return urls.map(url => new JsonRpcProvider(url, BASE_CHAIN_ID, { staticNetwork: true }));
}

async function verifyParentAcrossProviders(wallet: string, parent: ParentInput): Promise<VerifiedParent> {
  const contractAddress = getAddress(clean(parent.contract, 80));
  const tokenId = clean(parent.tokenId, 90);
  if (!/^\d+$/.test(tokenId)) throw new Error('Every fusion parent needs a valid token ID.');

  const pool = providers();
  let lastError = '';
  try {
    for (const provider of pool) {
      try {
        const nft = new Contract(contractAddress, ERC721_ABI, provider);
        const owner = getAddress(await nft.ownerOf(tokenId));
        if (owner !== wallet) throw new Error(`Connected wallet does not own ${contractAddress} #${tokenId}.`);
        const tokenURI = clean(await nft.tokenURI(tokenId), 200_000);
        if (!tokenURI) throw new Error(`Parent #${tokenId} has no tokenURI.`);
        const metadata: any = await metadataFromTokenURI(tokenURI);
        const image = ipfsToHttp(clean(metadata?.image || metadata?.image_url || metadata?.thumbnail || '', 4_000_000));
        if (!image || (!image.startsWith('data:image/') && !/^https?:\/\//i.test(image))) {
          throw new Error(`Parent #${tokenId} has no usable visual image for fusion.`);
        }
        return {
          contract: contractAddress,
          tokenId,
          tokenURI,
          name: clean(metadata?.name || `Voxel NFT #${tokenId}`, 120),
          image,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error || 'Base verification failed');
      }
    }
  } finally {
    for (const provider of pool) provider.destroy();
  }
  throw new Error(lastError || `Could not verify parent NFT #${tokenId} on Base.`);
}

function canonicalParents(parents: ParentInput[]) {
  if (!Array.isArray(parents) || parents.length !== 3) throw new Error('Visual fusion requires exactly 3 parent NFTs.');
  return parents.map(parent => `${getAddress(clean(parent.contract, 80))}:${clean(parent.tokenId, 90)}`);
}

function fusionMessage(wallet: string, parents: ParentInput[], nonce: string, issuedAt: number) {
  const ids = canonicalParents(parents);
  return [
    'VoxelForge Visual Fusion v1',
    `Wallet: ${wallet}`,
    `Parent 1: ${ids[0]}`,
    `Parent 2: ${ids[1]}`,
    `Parent 3: ${ids[2]}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    'Purpose: authorize one off-chain 3D fusion generation. No NFT transfer or ETH spend.',
  ].join('\n');
}

function ticketSecret() {
  const key = clean(process.env.MESHY_API_KEY, 2000);
  if (!key) throw new Error('Visual fusion is not configured on this deployment.');
  return key;
}

function makeTicket(wallet: string, conceptTaskId: string, parentIds: string[]) {
  return createHmac('sha256', ticketSecret()).update(`${wallet}|${conceptTaskId}|${parentIds.join('|')}`).digest('hex');
}

function validTicket(wallet: string, conceptTaskId: string, parentIds: string[], ticket: string) {
  const expected = Buffer.from(makeTicket(wallet, conceptTaskId, parentIds), 'utf8');
  const actual = Buffer.from(clean(ticket, 200), 'utf8');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function meshyJson(url: string, init: RequestInit = {}) {
  const key = ticketSecret();
  const response = await timedFetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(clean(data?.message || data?.error || data?.task_error?.message || `Meshy returned ${response.status}`, 1000));
  return data;
}

function fusionPrompt(parents: VerifiedParent[]) {
  const names = parents.map(parent => parent.name).join(' + ');
  return `Create ONE brand-new coherent voxel descendant derived from all three reference designs (${names}). This is genetic-style fusion, not a collage and not three objects standing together. The descendant must visibly inherit meaningful design traits from EACH parent: silhouette/form language from one, distinctive material/color language from another, and recognizable structural/accessory details from the third. Blend those traits into one believable new identity. Preserve crisp block/voxel geometry, strong depth, readable separated forms, premium game-asset materials, and a clean centered full-body/full-object composition. Keep the SAME fused descendant consistent across every generated view. Plain neutral/white background only. No floor, scene, text, logo, watermark, border, labels, extra characters, duplicate objects, or side-by-side comparison.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = clean(body?.action || 'concept', 30).toLowerCase();
    const wallet = getAddress(clean(body?.wallet, 80));
    const parents = Array.isArray(body?.parents) ? body.parents.slice(0, 3) as ParentInput[] : [];
    const parentIds = canonicalParents(parents);
    if (new Set(parentIds.map(value => value.toLowerCase())).size !== 3) {
      return NextResponse.json({ error: 'Choose three different parent NFTs.' }, { status: 400 });
    }

    if (action === 'concept') {
      const nonce = clean(body?.nonce, 200);
      const signature = clean(body?.signature, 5000);
      const issuedAt = Number(body?.issuedAt || 0);
      if (!nonce || !signature || !Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > MAX_SIGNATURE_AGE_MS) {
        return NextResponse.json({ error: 'The visual-fusion authorization expired. Sign the fresh request and retry.' }, { status: 401 });
      }
      const message = fusionMessage(wallet, parents, nonce, issuedAt);
      const recovered = getAddress(verifyMessage(message, signature));
      if (recovered !== wallet) return NextResponse.json({ error: 'The visual-fusion signature does not match the connected wallet.' }, { status: 401 });

      const verified: VerifiedParent[] = [];
      for (const parent of parents) verified.push(await verifyParentAcrossProviders(wallet, parent));

      const created = await meshyJson(IMAGE_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({
          ai_model: 'nano-banana-2',
          prompt: fusionPrompt(verified),
          reference_image_urls: verified.map(parent => parent.image),
          generate_multi_view: true,
          remove_background: false,
        }),
      });
      const conceptTaskId = clean(created?.result || created?.id, 200);
      if (!conceptTaskId) throw new Error('Meshy did not return a visual-fusion concept task ID.');
      return NextResponse.json({
        stage: 'concept',
        conceptTaskId,
        ticket: makeTicket(wallet, conceptTaskId, parentIds),
        parents: verified.map(({ contract, tokenId, name, image }) => ({ contract, tokenId, name, image })),
        safety: 'Off-chain generation only. This signature cannot transfer NFTs or spend ETH.',
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'mesh') {
      const conceptTaskId = clean(body?.conceptTaskId, 200);
      const ticket = clean(body?.ticket, 200);
      if (!conceptTaskId || !validTicket(wallet, conceptTaskId, parentIds, ticket)) {
        return NextResponse.json({ error: 'The fusion generation ticket is invalid or no longer matches these parents.' }, { status: 403 });
      }
      const concept = await meshyJson(`${IMAGE_ENDPOINT}/${encodeURIComponent(conceptTaskId)}`);
      if (String(concept?.status || '').toUpperCase() !== 'SUCCEEDED') {
        return NextResponse.json({ error: 'The fused multi-view concept must finish before the 3D model can start.' }, { status: 409 });
      }
      const created = await meshyJson(MESH_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({
          input_task_id: conceptTaskId,
          ai_model: 'latest',
          should_texture: true,
          enable_pbr: true,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: 16000,
          image_enhancement: false,
          remove_lighting: true,
          target_formats: ['glb'],
          alpha_thumbnail: true,
          multi_view_thumbnails: true,
        }),
      });
      const meshTaskId = clean(created?.result || created?.id, 200);
      if (!meshTaskId) throw new Error('Meshy did not return a fused 3D task ID.');
      return NextResponse.json({ stage: 'mesh', meshTaskId }, { headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({ error: 'Unknown visual-fusion action.' }, { status: 400 });
  } catch (error) {
    console.error('visual fusion prototype failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Visual fusion could not start.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const kind = clean(url.searchParams.get('kind') || 'concept', 20).toLowerCase();
    const taskId = clean(url.searchParams.get('taskId'), 200);
    if (!taskId) return NextResponse.json({ error: 'Missing fusion task ID.' }, { status: 400 });
    const endpoint = kind === 'mesh' ? MESH_ENDPOINT : IMAGE_ENDPOINT;
    const data = await meshyJson(`${endpoint}/${encodeURIComponent(taskId)}`);
    const status = String(data?.status || 'PENDING');
    const upper = status.toUpperCase();

    if (kind === 'mesh' && url.searchParams.get('preview') === '1') {
      const modelUrl = clean(data?.model_urls?.glb, 4000);
      if (upper !== 'SUCCEEDED' || !modelUrl) return NextResponse.json({ error: 'The fused GLB is not ready yet.' }, { status: 409 });
      const model = await timedFetch(modelUrl, {}, 30_000);
      if (!model.ok) return NextResponse.json({ error: 'The fused GLB could not be loaded.' }, { status: 502 });
      return new NextResponse(model.body, {
        status: 200,
        headers: {
          'Content-Type': 'model/gltf-binary',
          'Cache-Control': 'private, max-age=3600',
          'Content-Disposition': 'inline; filename="voxel-forge-fusion.glb"',
        },
      });
    }

    return NextResponse.json({
      kind,
      taskId,
      status,
      progress: Number(data?.progress || (upper === 'SUCCEEDED' ? 100 : 0)),
      imageUrls: Array.isArray(data?.image_urls) ? data.image_urls : [],
      modelUrl: kind === 'mesh' ? clean(data?.model_urls?.glb, 4000) || null : null,
      thumbnailUrl: clean(data?.alpha_thumbnail_url || data?.thumbnail_url, 4000) || null,
      thumbnailUrls: data?.thumbnail_urls || null,
      error: clean(data?.task_error?.message, 1000) || null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not read the visual-fusion task.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
