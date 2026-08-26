import { createHash } from 'crypto';
import { Contract, JsonRpcProvider } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TOKEN_RE = /^\d{1,78}$/;
const NFT_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];
const RPC_TIMEOUT_MS = 7_000;
const METADATA_TIMEOUT_MS = 7_000;
const MAX_METADATA_BYTES = 750_000;

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

function normalizeAddress(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeTokenId(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!TOKEN_RE.test(raw)) return '';
  try { return BigInt(raw).toString(); } catch { return ''; }
}

function sortTokenIds(values: string[]) {
  return [...values].sort((a, b) => a.length - b.length || a.localeCompare(b));
}

function rpcCandidates() {
  return Array.from(new Set([
    String(process.env.VOXELFLIP_RPC_URL || '').trim(),
    String(process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || '').trim(),
    'https://base.blockscout.com/api/eth-rpc',
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
  ].filter(Boolean)));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readParentsFromBase(contractAddress: string, tokenIds: string[]) {
  let lastError: unknown = null;
  for (const rpcUrl of rpcCandidates()) {
    const provider = new JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
    try {
      const contract = new Contract(contractAddress, NFT_ABI, provider);
      const parents = await withTimeout(Promise.all(tokenIds.map(async tokenId => {
        const [owner, tokenUri] = await Promise.all([
          contract.ownerOf(tokenId),
          contract.tokenURI(tokenId),
        ]);
        return { tokenId, owner: String(owner), tokenUri: String(tokenUri || '') };
      })), RPC_TIMEOUT_MS, 'Base ownership verification');
      return parents;
    } catch (error) {
      lastError = error;
    } finally {
      provider.destroy();
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Base ownership verification is unavailable.');
}

function publicMetadataUrl(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${raw.slice('ipfs://'.length).replace(/^ipfs\//, '')}`;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return '';
    const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local') || host === '::1') return '';
    if (/^127\.|^10\.|^0\.|^169\.254\.|^192\.168\./.test(host)) return '';
    const match172 = host.match(/^172\.(\d{1,3})\./);
    if (match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31) return '';
    if (/^(fc|fd|fe80):/i.test(host)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function scalar(value: unknown) {
  if (typeof value === 'string') return value.trim().slice(0, 100);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).slice(0, 100);
  return '';
}

function normalizeAttributes(value: any) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((item: any) => {
    const traitType = scalar(item?.trait_type || item?.type || item?.name).slice(0, 60);
    const traitValue = scalar(item?.value).slice(0, 100);
    return traitType && traitValue ? { traitType, value: traitValue } : null;
  }).filter(Boolean) as Array<{ traitType: string; value: string }>;
}

async function fetchMetadata(tokenUri: string, tokenId: string) {
  const url = publicMetadataUrl(tokenUri);
  if (!url) {
    return {
      name: `VoxelFlip #${tokenId}`,
      description: '',
      image: '',
      animationUrl: '',
      attributes: [] as Array<{ traitType: string; value: string }>,
      metadataStatus: 'unavailable',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`metadata returned ${response.status}`);
    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > MAX_METADATA_BYTES) throw new Error('metadata is too large');
    const text = await response.text();
    if (text.length > MAX_METADATA_BYTES) throw new Error('metadata is too large');
    const data = JSON.parse(text);
    return {
      name: scalar(data?.name) || `VoxelFlip #${tokenId}`,
      description: scalar(data?.description).slice(0, 240),
      image: publicMetadataUrl(scalar(data?.image)),
      animationUrl: publicMetadataUrl(scalar(data?.animation_url || data?.animationUrl)),
      attributes: normalizeAttributes(data?.attributes),
      metadataStatus: 'ready',
    };
  } catch {
    return {
      name: `VoxelFlip #${tokenId}`,
      description: '',
      image: '',
      animationUrl: '',
      attributes: [] as Array<{ traitType: string; value: string }>,
      metadataStatus: 'unavailable',
    };
  } finally {
    clearTimeout(timer);
  }
}

function metadataFingerprint(parent: any) {
  return createHash('sha256').update(JSON.stringify({
    tokenId: parent.tokenId,
    name: parent.name,
    attributes: parent.attributes,
  })).digest('hex');
}

function chooseInheritedTrait(parent: any, seed: string, parentIndex: number) {
  const attributes = Array.isArray(parent.attributes) ? parent.attributes : [];
  if (!attributes.length) return { traitType: `Parent ${parentIndex + 1}`, value: parent.name || `VoxelFlip #${parent.tokenId}` };
  const slice = seed.slice(parentIndex * 4, parentIndex * 4 + 4) || '0000';
  const index = Number.parseInt(slice, 16) % attributes.length;
  return attributes[index];
}

function descendantRecipe(contractAddress: string, wallet: string, parents: any[]) {
  const seedMaterial = [
    contractAddress.toLowerCase(),
    wallet.toLowerCase(),
    ...parents.map(parent => `${parent.tokenId}:${metadataFingerprint(parent)}`),
  ].join('|');
  const hash = createHash('sha256').update(seedMaterial).digest('hex');
  const inherited = parents.map((parent, index) => chooseInheritedTrait(parent, hash, index));
  const classes = ['PRISM', 'ECHO', 'NOVA', 'AETHER'];
  const forgeClass = classes[Number.parseInt(hash.slice(12, 14), 16) % classes.length];
  const signature = hash.slice(0, 10).toUpperCase();
  const concepts = inherited.map(trait => trait.value).filter(Boolean).slice(0, 3);

  return {
    forgeId: `forge_${hash.slice(0, 24)}`,
    name: `${forgeClass} Descendant · ${signature.slice(0, 5)}`,
    forgeClass,
    signature,
    palette: [`#${hash.slice(0, 6)}`, `#${hash.slice(6, 12)}`, `#${hash.slice(12, 18)}`],
    inheritedTraits: inherited.map((trait, index) => ({
      fromTokenId: parents[index].tokenId,
      traitType: trait.traitType,
      value: trait.value,
    })),
    attributes: [
      { traitType: 'Generation', value: 'Forge Descendant' },
      { traitType: 'Forge Class', value: forgeClass },
      { traitType: 'Fusion Signature', value: signature },
      ...parents.map((parent, index) => ({ traitType: `Parent ${index + 1}`, value: `VoxelFlip #${parent.tokenId}` })),
    ],
    conceptPrompt: `Create one coherent 3D voxel descendant that visibly inherits recognizable elements from all three parents: ${concepts.join(', ') || parents.map(parent => parent.name).join(', ')}. Preserve a premium collectible silhouette while making the fusion visibly distinct from every parent.`,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const wallet = normalizeAddress(body?.wallet);
    const rawTokenIds = Array.isArray(body?.tokenIds) ? body.tokenIds : [];
    const normalized = rawTokenIds.map(normalizeTokenId);

    if (!ADDRESS_RE.test(wallet)) return json({ error: 'Connect the Base wallet that owns the three VoxelFlips.' }, 400);
    if (normalized.length !== 3 || normalized.some(tokenId => !tokenId)) return json({ error: 'Choose exactly three valid VoxelFlip token IDs.' }, 400);
    if (new Set(normalized).size !== 3) return json({ error: 'Choose three different VoxelFlips.' }, 400);

    const tokenIds = sortTokenIds(normalized);
    const deployment = await getVoxelFlipDeployment();
    const contractAddress = String(deployment?.address || '').trim();
    if (!ADDRESS_RE.test(contractAddress)) return json({ error: 'The production VoxelFlip collection is not configured.' }, 503);

    let chainParents;
    try {
      chainParents = await readParentsFromBase(contractAddress, tokenIds);
    } catch {
      return json({ error: 'Base could not verify all three VoxelFlips right now. Nothing was burned, minted, or charged.' }, 503);
    }

    const notOwned = chainParents.find(parent => normalizeAddress(parent.owner) !== wallet);
    if (notOwned) {
      return json({
        error: `The connected wallet does not currently own VoxelFlip #${notOwned.tokenId}. Nothing was burned, minted, or charged.`,
        tokenId: notOwned.tokenId,
      }, 403);
    }

    const metadata = await Promise.all(chainParents.map(parent => fetchMetadata(parent.tokenUri, parent.tokenId)));
    const parents = chainParents.map((parent, index) => ({
      tokenId: parent.tokenId,
      owner: normalizeAddress(parent.owner),
      tokenUri: parent.tokenUri,
      ...metadata[index],
    }));
    const descendant = descendantRecipe(contractAddress, wallet, parents);

    return json({
      ready: true,
      previewOnly: true,
      atomicForgeReady: false,
      chain: 'base',
      chainId: 8453,
      contractAddress,
      wallet,
      feeUsd: '4.99',
      verifiedAt: new Date().toISOString(),
      parents,
      descendant,
      notice: 'Ownership is verified and this descendant recipe is deterministic for these three parents. This preview does not burn, mint, approve, sign, or charge anything.',
    });
  } catch (error) {
    console.error('VoxelFlip Forge preview failed', error);
    return json({ error: 'Forge preview failed safely. Nothing was burned, minted, or charged.' }, 500);
  }
}
