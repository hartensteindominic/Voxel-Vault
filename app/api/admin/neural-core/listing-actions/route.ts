import { NextResponse } from 'next/server';
import { requireNeuralCoreAdmin } from '../../../../../lib/neural-core-auth';
import { getVoxelFlipDeployment } from '../../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TOKEN_RE = /^\d+$/;
const PRICE_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const OPENSEA_ACTIONS_URL = 'https://api.opensea.io/api/v2/listings/actions';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ITEMS = 10;

type ListingInput = { tokenId: string; priceEth: string };

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

function rpcCandidates() {
  return Array.from(new Set([
    String(process.env.VOXELFLIP_RPC_URL || '').trim(),
    String(process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || '').trim(),
    'https://base.blockscout.com/api/eth-rpc',
    'https://mainnet.base.org',
  ].filter(Boolean)));
}

async function rpcOwnerOf(rpcUrl: string, contract: string, tokenId: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7_000);
  try {
    const tokenHex = BigInt(tokenId).toString(16).padStart(64, '0');
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: contract, data: `0x6352211e${tokenHex}` }, 'latest'],
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    const result = String(payload?.result || '');
    if (!response.ok || !/^0x[a-fA-F0-9]{64}$/.test(result)) return '';
    const owner = `0x${result.slice(-40)}`;
    return ADDRESS_RE.test(owner) ? owner.toLowerCase() : '';
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

async function verifiedOwner(contract: string, tokenId: string) {
  for (const rpc of rpcCandidates()) {
    const owner = await rpcOwnerOf(rpc, contract, tokenId);
    if (owner) return owner;
  }
  return '';
}

async function openSeaListingActions(body: any, apiKey: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(OPENSEA_ACTIONS_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } finally {
    clearTimeout(timer);
  }
}

function parseItems(body: any): { items: ListingInput[]; error?: string } {
  const fallbackPrice = String(body?.priceEth || '').trim();
  const raw = Array.isArray(body?.items) && body.items.length
    ? body.items
    : [{ tokenId: body?.tokenId, priceEth: fallbackPrice }];

  if (!raw.length) return { items: [], error: 'Choose at least one VoxelFlip to list.' };
  if (raw.length > MAX_ITEMS) return { items: [], error: `List up to ${MAX_ITEMS} VoxelFlips at a time. Larger selections can be listed in another batch.` };

  const seen = new Set<string>();
  const items: ListingInput[] = [];
  for (const entry of raw) {
    const tokenId = String(entry?.tokenId ?? '').trim();
    const priceEth = String(entry?.priceEth ?? fallbackPrice).trim();
    if (!TOKEN_RE.test(tokenId)) return { items: [], error: 'Every selected VoxelFlip must have a valid token ID.' };
    if (seen.has(tokenId)) return { items: [], error: `VoxelFlip #${tokenId} was selected more than once.` };
    if (!PRICE_RE.test(priceEth) || Number(priceEth) <= 0 || Number(priceEth) > 1000) {
      return { items: [], error: `VoxelFlip #${tokenId} needs a price greater than 0 and no more than 1000 ETH.` };
    }
    seen.add(tokenId);
    items.push({ tokenId, priceEth });
  }
  return { items };
}

export async function POST(request: Request) {
  const auth = await requireNeuralCoreAdmin(request);
  if ('error' in auth) return json({ error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  const body = await request.json().catch(() => ({}));
  const wallet = String(body?.wallet || '').trim().toLowerCase();
  const durationDays = Math.floor(Number(body?.durationDays ?? 30));
  const useCreatorFee = body?.useCreatorFee !== false;
  const parsed = parseItems(body);

  if (!ADDRESS_RE.test(wallet)) return json({ error: 'Connect the Base wallet that owns these VoxelFlips.' }, 400);
  if (parsed.error) return json({ error: parsed.error }, 400);
  if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 180) {
    return json({ error: 'Listing duration must be between 1 and 180 days.' }, 400);
  }

  const deployment = await getVoxelFlipDeployment();
  const contract = String(deployment?.address || '').trim();
  if (!ADDRESS_RE.test(contract)) return json({ error: 'The production VoxelFlip collection is not configured.' }, 503);

  const ownership = await Promise.all(parsed.items.map(async item => ({
    tokenId: item.tokenId,
    owner: await verifiedOwner(contract, item.tokenId),
  })));
  const unavailable = ownership.find(item => !item.owner);
  if (unavailable) return json({ error: `Base ownership for VoxelFlip #${unavailable.tokenId} could not be verified. No listing plan was prepared.` }, 503);
  const wrongOwner = ownership.find(item => item.owner !== wallet);
  if (wrongOwner) return json({ error: `The connected wallet does not currently own VoxelFlip #${wrongOwner.tokenId} on Base.` }, 403);

  const apiKey = String(process.env.OPENSEA_API_KEY || '').trim();
  if (!apiKey) return json({ error: 'OpenSea listing preparation is waiting for the server-side OpenSea API key.' }, 503);

  const start = new Date();
  const end = new Date(start.getTime() + durationDays * 86_400_000);
  const requestBody = {
    address: wallet,
    items: parsed.items.map(item => ({
      chain: 'base',
      contract,
      token_id: item.tokenId,
      quantity: 1,
      price: { amount: item.priceEth, currency: ZERO_ADDRESS },
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    })),
    use_creator_fee: useCreatorFee,
  };

  try {
    const { response, payload } = await openSeaListingActions(requestBody, apiKey);
    if (!response.ok) {
      return json({
        error: String(payload?.detail || payload?.error || `OpenSea could not prepare the listing (${response.status}).`),
        openSeaStatus: response.status,
      }, response.status >= 500 ? 503 : 400);
    }

    const steps = Array.isArray(payload?.steps) ? payload.steps : [];
    const actionTypes = steps.map((step: any) => {
      if (!step || typeof step !== 'object') return 'unknown';
      return Object.keys(step)[0] || 'unknown';
    });
    const listedItems = parsed.items.map(item => ({
      ...item,
      owner: wallet,
      openSeaUrl: `https://opensea.io/item/base/${contract}/${item.tokenId}`,
    }));

    return json({
      prepared: true,
      handoffMode: 'opensea-ui',
      walletSignatureRequired: true,
      automaticSigningActive: false,
      directWalletExecutionActive: false,
      wallet,
      owner: wallet,
      contract,
      chainId: 8453,
      chain: 'base',
      itemCount: listedItems.length,
      items: listedItems,
      durationDays,
      useCreatorFee,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      actionTypes,
      openSeaProfileUrl: `https://opensea.io/${wallet}`,
      openSeaUrl: listedItems[0]?.openSeaUrl || `https://opensea.io/${wallet}`,
      notice: 'Ownership and OpenSea listing inputs are verified. Complete the listing on OpenSea and approve the marketplace prompts in your wallet. VoxelPop never receives your private key or signs for you.',
    });
  } catch (error) {
    return json({
      error: error instanceof Error && error.name === 'AbortError'
        ? 'OpenSea listing preparation timed out. Nothing was signed or listed.'
        : error instanceof Error ? error.message : 'OpenSea listing preparation failed.',
    }, 503);
  }
}
