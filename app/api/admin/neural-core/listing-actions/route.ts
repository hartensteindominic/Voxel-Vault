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

export async function POST(request: Request) {
  const auth = await requireNeuralCoreAdmin(request);
  if ('error' in auth) return json({ error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  const body = await request.json().catch(() => ({}));
  const wallet = String(body?.wallet || '').trim().toLowerCase();
  const tokenId = String(body?.tokenId || '').trim();
  const priceEth = String(body?.priceEth || '').trim();
  const durationDays = Math.floor(Number(body?.durationDays ?? 30));
  const useCreatorFee = body?.useCreatorFee !== false;

  if (!ADDRESS_RE.test(wallet)) return json({ error: 'Connect the Base wallet that owns this VoxelFlip.' }, 400);
  if (!TOKEN_RE.test(tokenId)) return json({ error: 'A valid VoxelFlip token ID is required.' }, 400);
  if (!PRICE_RE.test(priceEth) || Number(priceEth) <= 0 || Number(priceEth) > 1000) {
    return json({ error: 'Enter a listing price greater than 0 and no more than 1000 ETH.' }, 400);
  }
  if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 180) {
    return json({ error: 'Listing duration must be between 1 and 180 days.' }, 400);
  }

  const deployment = await getVoxelFlipDeployment();
  const contract = String(deployment?.address || '').trim();
  if (!ADDRESS_RE.test(contract)) return json({ error: 'The production VoxelFlip collection is not configured.' }, 503);

  const owner = await verifiedOwner(contract, tokenId);
  if (!owner) return json({ error: 'Base ownership could not be verified. No listing action was prepared.' }, 503);
  if (owner !== wallet) return json({ error: 'That wallet does not currently own this VoxelFlip on Base.' }, 403);

  const apiKey = String(process.env.OPENSEA_API_KEY || '').trim();
  if (!apiKey) return json({ error: 'OpenSea listing automation is waiting for the server-side OpenSea API key.' }, 503);

  const start = new Date();
  const end = new Date(start.getTime() + durationDays * 86_400_000);
  const requestBody = {
    address: wallet,
    items: [{
      chain: 'base',
      contract,
      token_id: tokenId,
      quantity: 1,
      price: { amount: priceEth, currency: ZERO_ADDRESS },
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    }],
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

    return json({
      prepared: true,
      previewOnly: true,
      walletSignatureRequired: true,
      automaticSigningActive: false,
      wallet,
      owner,
      contract,
      tokenId,
      priceEth,
      durationDays,
      useCreatorFee,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      actionTypes,
      steps,
      openSeaUrl: `https://opensea.io/item/base/${contract}/${tokenId}`,
      notice: 'These are OpenSea preparation steps only. Nothing is listed until the connected wallet explicitly approves/signs the required actions.',
    });
  } catch (error) {
    return json({
      error: error instanceof Error && error.name === 'AbortError'
        ? 'OpenSea listing preparation timed out. Nothing was signed or listed.'
        : error instanceof Error ? error.message : 'OpenSea listing preparation failed.',
    }, 503);
  }
}
