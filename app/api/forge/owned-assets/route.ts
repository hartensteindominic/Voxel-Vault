import { NextResponse } from 'next/server';
import { Contract, JsonRpcProvider, getAddress, id, zeroPadValue } from 'ethers';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const OPENSEA = 'https://api.opensea.io/api/v2';
const BLOCKSCOUT = 'https://base.blockscout.com/api/v2';
const TIMEOUT_MS = 8_000;
const LOG_CHUNK = 8_000;
const MAX_TOKENS = 100;
const FALLBACK_SCAN_BLOCKS = 500_000;
const TRANSFER_TOPIC = id('Transfer(address,address,uint256)');
const VOXELFLIP_MINT_TOPIC = id('VoxelFlipMinted(uint256,address,bytes32,string)');

const ERC721_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];

function normalizeAddress(value: unknown) {
  try { return getAddress(String(value || '')); } catch { return ''; }
}

function tokenIdOf(value: any) {
  const raw = value?.identifier ?? value?.token_id ?? value?.tokenId ?? value?.id ?? '';
  const tokenId = String(raw || '').trim();
  return /^\d+$/.test(tokenId) ? tokenId : '';
}

function contractAddressOf(value: any) {
  return normalizeAddress(
    value?.contract
    || value?.contract_address
    || value?.contractAddress
    || value?.nft_contract
    || value?.token?.address_hash
    || value?.token?.address
    || value?.token_contract_address_hash
    || ''
  );
}

function metadataFields(value: any) {
  const metadata = value?.metadata && typeof value.metadata === 'object' ? value.metadata : {};
  return {
    name: String(value?.name || value?.title || metadata?.name || '').trim(),
    description: String(value?.description || metadata?.description || '').trim(),
    imageUrl: String(value?.display_image_url || value?.image_url || value?.image || metadata?.image_url || metadata?.image || '').trim(),
    animationUrl: String(value?.display_animation_url || value?.animation_url || value?.animation || metadata?.animation_url || '').trim(),
    metadataUrl: String(value?.metadata_url || value?.metadataUrl || metadata?.external_url || '').trim(),
    openSeaUrl: String(value?.opensea_url || value?.openseaUrl || '').trim(),
  };
}

function rpcCandidates() {
  const configured = String(process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || '').trim();
  return Array.from(new Set([
    configured,
    'https://base.blockscout.com/api/eth-rpc',
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base-rpc.publicnode.com',
  ].filter(Boolean)));
}

async function workingProvider() {
  let lastError: unknown = null;
  for (const rpc of rpcCandidates()) {
    const provider = new JsonRpcProvider(rpc, 8453, { staticNetwork: true });
    try {
      await Promise.race([
        provider.getBlockNumber(),
        new Promise((_resolve, reject) => setTimeout(() => reject(new Error('RPC health check timed out')), 5_000)),
      ]);
      return provider;
    } catch (error) {
      lastError = error;
      provider.destroy();
    }
  }
  throw lastError instanceof Error ? lastError : new Error('No Base RPC is available.');
}

async function timedJson(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, cache: 'no-store', signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data, error: response.ok ? '' : String(data?.detail || data?.error || `HTTP ${response.status}`) };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: error instanceof Error ? error.message : 'request failed' };
  } finally {
    clearTimeout(timer);
  }
}

async function openSeaOwned(wallet: string, contractAddress: string, apiKey: string) {
  if (!apiKey) return { available: false, items: [] as any[], error: 'OpenSea API key not configured.' };
  const items: any[] = [];
  let cursor = '';
  for (let page = 0; page < 8 && items.length < MAX_TOKENS; page += 1) {
    const query = new URLSearchParams({ limit: '50' });
    if (cursor) query.set('next', cursor);
    const response = await timedJson(`${OPENSEA}/chain/base/account/${wallet}/nfts?${query.toString()}`, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
    });
    if (!response.ok) return { available: false, items: [] as any[], error: response.error || 'OpenSea wallet lookup failed.' };
    const pageItems = Array.isArray(response.data?.nfts) ? response.data.nfts : [];
    for (const item of pageItems) {
      if (contractAddressOf(item).toLowerCase() !== contractAddress.toLowerCase()) continue;
      const tokenId = tokenIdOf(item);
      if (!tokenId) continue;
      items.push({ tokenId, ...metadataFields(item) });
      if (items.length >= MAX_TOKENS) break;
    }
    cursor = String(response.data?.next || '').trim();
    if (!cursor) break;
  }
  return { available: true, items, error: '' };
}

async function blockscoutOwned(wallet: string, contractAddress: string) {
  const items: any[] = [];
  let query = new URLSearchParams({ type: 'ERC-721' });
  for (let page = 0; page < 8 && items.length < MAX_TOKENS; page += 1) {
    const response = await timedJson(`${BLOCKSCOUT}/addresses/${wallet}/nft?${query.toString()}`, { headers: { accept: 'application/json' } });
    if (!response.ok) return { available: false, items: [] as any[], error: response.error || 'Blockscout wallet lookup failed.' };
    const pageItems = Array.isArray(response.data?.items) ? response.data.items : [];
    for (const item of pageItems) {
      if (contractAddressOf(item).toLowerCase() !== contractAddress.toLowerCase()) continue;
      const tokenId = tokenIdOf(item);
      if (!tokenId) continue;
      items.push({ tokenId, ...metadataFields(item) });
      if (items.length >= MAX_TOKENS) break;
    }
    const next = response.data?.next_page_params;
    if (!next || typeof next !== 'object' || !Object.keys(next).length) break;
    query = new URLSearchParams({ type: 'ERC-721' });
    for (const [key, value] of Object.entries(next)) {
      if (value !== null && value !== undefined) query.set(key, String(value));
    }
  }
  return { available: true, items, error: '' };
}

async function deploymentStartBlock(provider: JsonRpcProvider, deploymentTxHash: string) {
  const latest = await provider.getBlockNumber();
  if (deploymentTxHash) {
    const receipt = await provider.getTransactionReceipt(deploymentTxHash).catch(() => null);
    if (receipt?.blockNumber != null) return { first: Number(receipt.blockNumber), latest };
  }
  return { first: Math.max(0, latest - FALLBACK_SCAN_BLOCKS), latest };
}

async function onchainCandidateTokenIds(provider: JsonRpcProvider, wallet: string, contractAddress: string, deploymentTxHash: string) {
  const { first, latest } = await deploymentStartBlock(provider, deploymentTxHash);
  const ownerTopic = zeroPadValue(wallet, 32);
  const found = new Set<string>();

  for (let start = first; start <= latest && found.size < MAX_TOKENS; start += LOG_CHUNK) {
    const end = Math.min(latest, start + LOG_CHUNK - 1);
    const [transferLogs, mintLogs] = await Promise.all([
      provider.getLogs({ address: contractAddress, fromBlock: start, toBlock: end, topics: [TRANSFER_TOPIC, null, ownerTopic] }),
      provider.getLogs({ address: contractAddress, fromBlock: start, toBlock: end, topics: [VOXELFLIP_MINT_TOPIC, null, ownerTopic] }),
    ]);
    for (const log of transferLogs) {
      const topic = log.topics?.[3];
      if (!topic) continue;
      try { found.add(BigInt(topic).toString()); } catch {}
      if (found.size >= MAX_TOKENS) break;
    }
    for (const log of mintLogs) {
      const topic = log.topics?.[1];
      if (!topic) continue;
      try { found.add(BigInt(topic).toString()); } catch {}
      if (found.size >= MAX_TOKENS) break;
    }
  }
  return Array.from(found);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const walletRaw = (url.searchParams.get('wallet') || '').trim();
  if (!ADDRESS_RE.test(walletRaw)) return NextResponse.json({ error: 'Connect a valid wallet first.' }, { status: 400 });

  const wallet = getAddress(walletRaw);
  const deployment = await getVoxelFlipDeployment();
  const contractAddress = normalizeAddress(deployment?.address);
  if (!contractAddress || Number(deployment?.chainId) !== 8453) {
    return NextResponse.json({ error: 'The reviewed production VoxelFlip deployment is unavailable.' }, { status: 503 });
  }

  const apiKey = String(process.env.OPENSEA_API_KEY || '').trim();
  let provider: JsonRpcProvider | null = null;
  try {
    provider = await workingProvider();
    const nft = new Contract(contractAddress, ERC721_ABI, provider);

    const [openSea, blockscout, eventResult] = await Promise.all([
      openSeaOwned(wallet, contractAddress, apiKey),
      blockscoutOwned(wallet, contractAddress),
      onchainCandidateTokenIds(provider, wallet, contractAddress, String(deployment?.deploymentTxHash || ''))
        .then(items => ({ items, error: '' }))
        .catch(error => ({ items: [] as string[], error: error instanceof Error ? error.message : 'Base event scan failed.' })),
    ]);

    const tokenIds = new Set<string>();
    for (const item of openSea.items) tokenIds.add(item.tokenId);
    for (const item of blockscout.items) tokenIds.add(item.tokenId);
    for (const tokenId of eventResult.items) tokenIds.add(tokenId);

    const metadataById = new Map<string, any>();
    for (const item of [...blockscout.items, ...openSea.items]) {
      metadataById.set(item.tokenId, { ...(metadataById.get(item.tokenId) || {}), ...item });
    }

    const verified: any[] = [];
    for (const tokenId of Array.from(tokenIds).slice(0, MAX_TOKENS)) {
      try {
        const [owner, tokenURI] = await Promise.all([nft.ownerOf(tokenId), nft.tokenURI(tokenId)]);
        if (getAddress(owner) !== wallet) continue;
        const market = metadataById.get(tokenId) || {};
        verified.push({
          tokenId,
          contract: contractAddress,
          owner: wallet,
          tokenURI: String(tokenURI || ''),
          name: market.name || `VoxelFlip #${tokenId}`,
          description: market.description || '',
          imageUrl: market.imageUrl || '',
          animationUrl: market.animationUrl || '',
          metadataUrl: market.metadataUrl || '',
          openSeaUrl: market.openSeaUrl || `https://opensea.io/assets/base/${contractAddress}/${tokenId}`,
        });
      } catch {}
    }

    verified.sort((a, b) => {
      try { return BigInt(a.tokenId) < BigInt(b.tokenId) ? -1 : BigInt(a.tokenId) > BigInt(b.tokenId) ? 1 : 0; } catch { return 0; }
    });

    const warnings = [
      openSea.available ? '' : openSea.error,
      blockscout.available ? '' : blockscout.error,
      eventResult.error,
    ].filter(Boolean);
    const sources = [
      openSea.available ? 'opensea' : '',
      blockscout.available ? 'blockscout' : '',
      eventResult.items.length ? 'base-events' : '',
      'ownerOf',
    ].filter(Boolean);

    return NextResponse.json({
      wallet,
      chainId: 8453,
      chain: 'base',
      contract: contractAddress,
      source: sources.join('+'),
      sourceWarning: warnings.length ? warnings.join(' ') : null,
      sourceCounts: {
        openSea: openSea.items.length,
        blockscout: blockscout.items.length,
        eventCandidates: eventResult.items.length,
        verified: verified.length,
      },
      count: verified.length,
      nfts: verified,
      safety: 'Read-only production scan. No approval, transfer, burn, listing, or signature is requested.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not read owned VoxelFlips.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  } finally {
    provider?.destroy();
  }
}
