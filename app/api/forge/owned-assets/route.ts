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
const RPC_CALL_TIMEOUT_MS = 5_000;
const LOG_CHUNK = 8_000;
const MAX_WALLET_NFTS = 250;
const MAX_CANDIDATES = 100;
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
  const collection = value?.collection && typeof value.collection === 'object' ? value.collection : {};
  return {
    name: String(value?.name || value?.title || metadata?.name || '').trim(),
    description: String(value?.description || metadata?.description || '').trim(),
    imageUrl: String(value?.display_image_url || value?.image_url || value?.image || metadata?.image_url || metadata?.image || '').trim(),
    animationUrl: String(value?.display_animation_url || value?.animation_url || value?.animation || metadata?.animation_url || '').trim(),
    metadataUrl: String(value?.metadata_url || value?.metadataUrl || metadata?.external_url || '').trim(),
    externalUrl: String(value?.external_app_url || metadata?.external_url || metadata?.home_url || '').trim(),
    openSeaUrl: String(value?.opensea_url || value?.openseaUrl || '').trim(),
    collectionName: String(value?.token?.name || collection?.name || value?.collection || '').trim(),
    collectionSymbol: String(value?.token?.symbol || collection?.symbol || '').trim(),
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs = RPC_CALL_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Base RPC call timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function healthyProviders() {
  const providers: JsonRpcProvider[] = [];
  for (const rpc of rpcCandidates()) {
    const provider = new JsonRpcProvider(rpc, 8453, { staticNetwork: true });
    try {
      await withTimeout(provider.getBlockNumber(), 4_000);
      providers.push(provider);
      if (providers.length >= 3) break;
    } catch {
      provider.destroy();
    }
  }
  if (!providers.length) throw new Error('No Base RPC is available for ownership verification.');
  return providers;
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

function looksLikeVoxel(item: any, productionContract: string) {
  const contract = contractAddressOf(item);
  if (contract && contract.toLowerCase() === productionContract.toLowerCase()) return true;
  const fields = metadataFields(item);
  const haystack = [
    fields.name,
    fields.description,
    fields.collectionName,
    fields.collectionSymbol,
    fields.externalUrl,
    fields.metadataUrl,
  ].join(' ').toLowerCase();
  return haystack.includes('voxelflip')
    || haystack.includes('voxelpop')
    || haystack.includes('voxel vault')
    || haystack.includes('voxelvault.io');
}

async function openSeaOwned(wallet: string, productionContract: string, apiKey: string) {
  if (!apiKey) return { available: false, items: [] as any[], walletItems: 0, error: 'OpenSea API key not configured.' };
  const items: any[] = [];
  let walletItems = 0;
  let cursor = '';
  for (let page = 0; page < 8 && walletItems < MAX_WALLET_NFTS; page += 1) {
    const query = new URLSearchParams({ limit: '50' });
    if (cursor) query.set('next', cursor);
    const response = await timedJson(`${OPENSEA}/chain/base/account/${wallet}/nfts?${query.toString()}`, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
    });
    if (!response.ok) return { available: false, items: [] as any[], walletItems, error: response.error || 'OpenSea wallet lookup failed.' };
    const pageItems = Array.isArray(response.data?.nfts) ? response.data.nfts : [];
    walletItems += pageItems.length;
    for (const raw of pageItems) {
      const contract = contractAddressOf(raw);
      const tokenId = tokenIdOf(raw);
      if (!contract || !tokenId || !looksLikeVoxel(raw, productionContract)) continue;
      items.push({ contract, tokenId, ...metadataFields(raw), discovery: 'opensea' });
      if (items.length >= MAX_CANDIDATES) break;
    }
    if (items.length >= MAX_CANDIDATES) break;
    cursor = String(response.data?.next || '').trim();
    if (!cursor) break;
  }
  return { available: true, items, walletItems, error: '' };
}

async function blockscoutOwned(wallet: string, productionContract: string) {
  const items: any[] = [];
  let walletItems = 0;
  let query = new URLSearchParams({ type: 'ERC-721' });
  for (let page = 0; page < 12 && walletItems < MAX_WALLET_NFTS; page += 1) {
    const response = await timedJson(`${BLOCKSCOUT}/addresses/${wallet}/nft?${query.toString()}`, { headers: { accept: 'application/json' } });
    if (!response.ok) return { available: false, items: [] as any[], walletItems, error: response.error || 'Blockscout wallet lookup failed.' };
    const pageItems = Array.isArray(response.data?.items) ? response.data.items : [];
    walletItems += pageItems.length;
    for (const raw of pageItems) {
      const contract = contractAddressOf(raw);
      const tokenId = tokenIdOf(raw);
      if (!contract || !tokenId || !looksLikeVoxel(raw, productionContract)) continue;
      items.push({ contract, tokenId, ...metadataFields(raw), discovery: 'blockscout' });
      if (items.length >= MAX_CANDIDATES) break;
    }
    if (items.length >= MAX_CANDIDATES) break;
    const next = response.data?.next_page_params;
    if (!next || typeof next !== 'object' || !Object.keys(next).length) break;
    query = new URLSearchParams({ type: 'ERC-721' });
    for (const [key, value] of Object.entries(next)) {
      if (value !== null && value !== undefined) query.set(key, String(value));
    }
  }
  return { available: true, items, walletItems, error: '' };
}

async function deploymentStartBlock(provider: JsonRpcProvider, deploymentTxHash: string) {
  const latest = await withTimeout(provider.getBlockNumber());
  if (deploymentTxHash) {
    const receipt = await withTimeout(provider.getTransactionReceipt(deploymentTxHash)).catch(() => null);
    if (receipt?.blockNumber != null) return { first: Number(receipt.blockNumber), latest };
  }
  return { first: Math.max(0, latest - FALLBACK_SCAN_BLOCKS), latest };
}

async function onchainCandidateTokenIds(provider: JsonRpcProvider, wallet: string, contractAddress: string, deploymentTxHash: string) {
  const { first, latest } = await deploymentStartBlock(provider, deploymentTxHash);
  const ownerTopic = zeroPadValue(wallet, 32);
  const found = new Set<string>();

  for (let start = first; start <= latest && found.size < MAX_CANDIDATES; start += LOG_CHUNK) {
    const end = Math.min(latest, start + LOG_CHUNK - 1);
    const [transferLogs, mintLogs] = await withTimeout(Promise.all([
      provider.getLogs({ address: contractAddress, fromBlock: start, toBlock: end, topics: [TRANSFER_TOPIC, null, ownerTopic] }),
      provider.getLogs({ address: contractAddress, fromBlock: start, toBlock: end, topics: [VOXELFLIP_MINT_TOPIC, null, ownerTopic] }),
    ]), 7_000);
    for (const log of transferLogs) {
      const topic = log.topics?.[3];
      if (!topic) continue;
      try { found.add(BigInt(topic).toString()); } catch {}
    }
    for (const log of mintLogs) {
      const topic = log.topics?.[1];
      if (!topic) continue;
      try { found.add(BigInt(topic).toString()); } catch {}
    }
  }
  return Array.from(found);
}

async function verifyOwnedAcrossProviders(providers: JsonRpcProvider[], wallet: string, contractAddress: string, tokenId: string) {
  let lastError = '';
  for (const provider of providers) {
    try {
      const nft = new Contract(contractAddress, ERC721_ABI, provider);
      const owner = await withTimeout(nft.ownerOf(tokenId));
      if (getAddress(owner) !== wallet) return { owned: false, tokenURI: '', error: '' };
      let tokenURI = '';
      try { tokenURI = String(await withTimeout(nft.tokenURI(tokenId)) || ''); } catch {}
      return { owned: true, tokenURI, error: '' };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error || 'ownerOf failed');
    }
  }
  return { owned: false, tokenURI: '', error: lastError || 'No Base RPC could verify this NFT.' };
}

function candidateKey(contract: string, tokenId: string) {
  return `${contract.toLowerCase()}:${tokenId}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const walletRaw = (url.searchParams.get('wallet') || '').trim();
  if (!ADDRESS_RE.test(walletRaw)) return NextResponse.json({ error: 'Connect a valid wallet first.' }, { status: 400 });

  const wallet = getAddress(walletRaw);
  const deployment = await getVoxelFlipDeployment();
  const productionContract = normalizeAddress(deployment?.address);
  if (!productionContract || Number(deployment?.chainId) !== 8453) {
    return NextResponse.json({ error: 'The reviewed production VoxelFlip deployment is unavailable.' }, { status: 503 });
  }

  const apiKey = String(process.env.OPENSEA_API_KEY || '').trim();
  let providers: JsonRpcProvider[] = [];
  try {
    providers = await healthyProviders();
    const [openSea, blockscout, eventResult] = await Promise.all([
      openSeaOwned(wallet, productionContract, apiKey),
      blockscoutOwned(wallet, productionContract),
      onchainCandidateTokenIds(providers[0], wallet, productionContract, String(deployment?.deploymentTxHash || ''))
        .then(items => ({ items, error: '' }))
        .catch(error => ({ items: [] as string[], error: error instanceof Error ? error.message : 'Base event scan failed.' })),
    ]);

    const candidates = new Map<string, any>();
    for (const item of [...blockscout.items, ...openSea.items]) {
      const key = candidateKey(item.contract, item.tokenId);
      candidates.set(key, { ...(candidates.get(key) || {}), ...item });
    }
    for (const tokenId of eventResult.items) {
      const key = candidateKey(productionContract, tokenId);
      candidates.set(key, {
        ...(candidates.get(key) || {}),
        contract: productionContract,
        tokenId,
        name: candidates.get(key)?.name || `VoxelFlip #${tokenId}`,
        discovery: candidates.get(key)?.discovery || 'base-events',
      });
    }

    const verified: any[] = [];
    const verificationErrors: string[] = [];
    for (const candidate of Array.from(candidates.values()).slice(0, MAX_CANDIDATES)) {
      const contract = normalizeAddress(candidate.contract);
      const tokenId = String(candidate.tokenId || '');
      if (!contract || !/^\d+$/.test(tokenId)) continue;
      const check = await verifyOwnedAcrossProviders(providers, wallet, contract, tokenId);
      if (!check.owned) {
        if (check.error) verificationErrors.push(`${contract}:${tokenId} ${check.error}`);
        continue;
      }
      const currentProduction = contract.toLowerCase() === productionContract.toLowerCase();
      verified.push({
        tokenId,
        contract,
        owner: wallet,
        tokenURI: check.tokenURI,
        selectable: Boolean(check.tokenURI),
        currentProduction,
        legacyVoxelFlip: !currentProduction,
        name: candidate.name || `${currentProduction ? 'VoxelFlip' : 'Voxel NFT'} #${tokenId}`,
        description: candidate.description || '',
        imageUrl: candidate.imageUrl || '',
        animationUrl: candidate.animationUrl || '',
        metadataUrl: candidate.metadataUrl || '',
        collectionName: candidate.collectionName || '',
        collectionSymbol: candidate.collectionSymbol || '',
        discovery: candidate.discovery || 'wallet',
        openSeaUrl: candidate.openSeaUrl || `https://opensea.io/assets/base/${contract}/${tokenId}`,
      });
    }

    verified.sort((a, b) => {
      if (a.currentProduction !== b.currentProduction) return a.currentProduction ? -1 : 1;
      if (a.contract.toLowerCase() !== b.contract.toLowerCase()) return a.contract.localeCompare(b.contract);
      try { return BigInt(a.tokenId) < BigInt(b.tokenId) ? -1 : BigInt(a.tokenId) > BigInt(b.tokenId) ? 1 : 0; } catch { return 0; }
    });

    const warnings = [
      openSea.available ? '' : openSea.error,
      blockscout.available ? '' : blockscout.error,
      eventResult.error,
      verificationErrors.length ? `${verificationErrors.length} discovered NFT${verificationErrors.length === 1 ? '' : 's'} could not be independently verified across the available Base RPCs.` : '',
    ].filter(Boolean);
    const sources = [
      openSea.available ? 'opensea-wallet' : '',
      blockscout.available ? 'blockscout-wallet' : '',
      eventResult.items.length ? 'production-events' : '',
      `ownerOf-across-${providers.length}-rpcs`,
    ].filter(Boolean);

    return NextResponse.json({
      wallet,
      chainId: 8453,
      chain: 'base',
      contract: productionContract,
      productionContract,
      source: sources.join('+'),
      sourceWarning: warnings.length ? warnings.join(' ') : null,
      sourceCounts: {
        openSeaWalletItems: openSea.walletItems,
        openSeaVoxelCandidates: openSea.items.length,
        blockscoutWalletItems: blockscout.walletItems,
        blockscoutVoxelCandidates: blockscout.items.length,
        productionEventCandidates: eventResult.items.length,
        discoveredVoxelCandidates: candidates.size,
        verified: verified.length,
        currentProduction: verified.filter(item => item.currentProduction).length,
        legacyVoxel: verified.filter(item => item.legacyVoxelFlip).length,
        rpcProviders: providers.length,
      },
      count: verified.length,
      nfts: verified,
      safety: 'Read-only Base wallet scan. No approval, transfer, burn, listing, or signature is requested. Legacy candidates are shown only after current ownerOf verification.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not read owned Voxel NFTs.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  } finally {
    for (const provider of providers) provider.destroy();
  }
}
