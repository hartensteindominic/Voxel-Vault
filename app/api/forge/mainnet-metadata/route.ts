import { Contract, JsonRpcProvider, getAddress, isAddress } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BASE_CHAIN_ID = 8453;
const ERC721_ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
];

function ipfsToHttp(value: string) {
  if (value.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${value.slice(7)}`;
  if (value.startsWith('ar://')) return `https://arweave.net/${value.slice(5)}`;
  return value;
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

async function timedFetch(url: string, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } });
  } finally {
    clearTimeout(timer);
  }
}

async function metadataFromUri(tokenURI: string) {
  const inline = parseDataJson(tokenURI);
  if (inline) return inline;
  const url = ipfsToHttp(tokenURI);
  if (!/^https?:\/\//i.test(url)) return {};
  const response = await timedFetch(url);
  if (!response.ok) return {};
  return response.json().catch(() => ({}));
}

function rpcCandidates() {
  return Array.from(new Set([
    String(process.env.BASE_RPC_URL || '').trim(),
    String(process.env.VOXELFLIP_RPC_URL || '').trim(),
    'https://base.blockscout.com/api/eth-rpc',
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
  ].filter(Boolean)));
}

async function provider() {
  let lastError = '';
  for (const rpc of rpcCandidates()) {
    const candidate = new JsonRpcProvider(rpc, BASE_CHAIN_ID, { staticNetwork: true });
    try {
      await candidate.getBlockNumber();
      return candidate;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error || 'Base RPC unavailable');
      candidate.destroy();
    }
  }
  throw new Error(lastError || 'No Base RPC is available.');
}

export async function GET(request: Request) {
  let rpc: JsonRpcProvider | null = null;
  try {
    const url = new URL(request.url);
    const requestId = String(url.searchParams.get('r') || '').trim();
    const parents = [0, 1, 2].map(index => ({
      contract: String(url.searchParams.get(`c${index}`) || '').trim(),
      tokenId: String(url.searchParams.get(`t${index}`) || '').trim(),
    }));

    if (!/^0x[a-fA-F0-9]{64}$/.test(requestId)) return NextResponse.json({ error: 'Invalid Forge lineage request.' }, { status: 400 });
    if (parents.some(parent => !isAddress(parent.contract) || !/^\d+$/.test(parent.tokenId))) {
      return NextResponse.json({ error: 'Invalid Forge parent lineage.' }, { status: 400 });
    }

    const deployment = await getVoxelFlipDeployment();
    const production = getAddress(deployment.address);
    const normalized = parents.map(parent => ({ contract: getAddress(parent.contract), tokenId: parent.tokenId }));
    if (normalized.some(parent => parent.contract !== production)) {
      return NextResponse.json({ error: 'This metadata route only serves the reviewed VoxelFlip Base collection.' }, { status: 400 });
    }
    const keys = normalized.map(parent => `${parent.contract.toLowerCase()}:${parent.tokenId}`);
    if (new Set(keys).size !== 3) return NextResponse.json({ error: 'Forge lineage needs three different parents.' }, { status: 400 });

    rpc = await provider();
    const parentRecords: any[] = [];
    for (const parent of normalized) {
      const nft = new Contract(parent.contract, ERC721_ABI, rpc);
      const [tokenURI, currentOwner] = await Promise.all([
        nft.tokenURI(parent.tokenId),
        nft.ownerOf(parent.tokenId),
      ]);
      const source = await metadataFromUri(String(tokenURI || ''));
      parentRecords.push({
        contract: parent.contract,
        tokenId: parent.tokenId,
        currentOwner: getAddress(currentOwner),
        tokenURI: String(tokenURI || ''),
        name: String(source?.name || `VoxelFlip #${parent.tokenId}`).slice(0, 140),
        image: ipfsToHttp(String(source?.image || source?.image_url || '')),
        animation_url: ipfsToHttp(String(source?.animation_url || source?.animationUrl || '')),
      });
    }

    const first = parentRecords[0];
    const site = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, '');
    const metadata: Record<string, unknown> = {
      name: `Voxel Forge Descendant · ${requestId.slice(2, 10).toUpperCase()}`,
      description: 'A Voxel Forge descendant minted on Base from three recorded VoxelFlip parents. Parent NFTs remain separate and are not burned or transferred by the revenue Forge.',
      ...(first.image ? { image: first.image } : {}),
      ...(first.animation_url ? { animation_url: first.animation_url } : {}),
      external_url: `${site}/forge/mainnet`,
      attributes: [
        { trait_type: 'Forge Tier', value: 'Rare' },
        { trait_type: 'Network', value: 'Base' },
        { trait_type: 'Parent Count', value: 3 },
        { trait_type: 'Parent Token IDs', value: parentRecords.map(parent => parent.tokenId).join(', ') },
      ],
      properties: {
        lineage_request_id: requestId,
        parent_chain: 'base',
        parent_contracts: parentRecords.map(parent => parent.contract),
        parent_token_ids: parentRecords.map(parent => parent.tokenId),
        parents: parentRecords.map(parent => ({
          contract: parent.contract,
          tokenId: parent.tokenId,
          name: parent.name,
          tokenURI: parent.tokenURI,
        })),
        visual_note: 'Until visual fusion is activated, descendant display media inherits the first parent as a lineage reference.',
      },
    };

    return NextResponse.json(metadata, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('Base mainnet Forge metadata failed', error);
    return NextResponse.json({ error: 'Could not load this Forge lineage metadata.' }, { status: 500 });
  } finally {
    rpc?.destroy();
  }
}
