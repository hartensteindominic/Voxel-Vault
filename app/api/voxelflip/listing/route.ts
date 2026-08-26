import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TOKEN_RE = /^\d+$/;
const PRICE_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;
const SIGNATURE_RE = /^0x(?:[a-fA-F0-9]{128}|[a-fA-F0-9]{130})$/;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const SEAPORT_ADDRESS = '0x0000000000000068F116a894984e2DB1123eB395';
const OPENSEA_CONDUIT_ADDRESS = '0x1e0049783f008a0085193e00003d00cd54003c71';
const OPENSEA_CONDUIT_KEY = '0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000';
const OPENSEA_SIGNED_ZONE = '0x000056f7000000ece9003ca63978907a00ffd100';
const OPENSEA_ACTIONS_URL = 'https://api.opensea.io/api/v2/listings/actions';
const OPENSEA_POST_URL = 'https://api.opensea.io/api/v2/orders/base/seaport/listings';
const REQUEST_TIMEOUT_MS = 12_000;

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

function normalizeAddress(value: unknown) {
  return String(value || '').trim().toLowerCase();
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

function ethToWei(value: string) {
  if (!PRICE_RE.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const wei = BigInt(whole) * 10n ** 18n + BigInt((fraction + '0'.repeat(18)).slice(0, 18));
  return wei;
}

function cleanOrderComponents(value: any) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const required = ['offerer', 'zone', 'offer', 'consideration', 'orderType', 'startTime', 'endTime', 'zoneHash', 'salt', 'conduitKey', 'counter'];
  if (!required.every(key => Object.prototype.hasOwnProperty.call(value, key))) return null;
  if (!Array.isArray(value.offer) || !Array.isArray(value.consideration)) return null;

  const cleanItem = (item: any, consideration = false) => {
    if (!item || typeof item !== 'object') return null;
    const base: any = {
      itemType: Number(item.itemType),
      token: String(item.token || ''),
      identifierOrCriteria: String(item.identifierOrCriteria ?? ''),
      startAmount: String(item.startAmount ?? ''),
      endAmount: String(item.endAmount ?? ''),
    };
    if (consideration) base.recipient = String(item.recipient || '');
    return base;
  };

  const offer = value.offer.map((item: any) => cleanItem(item, false));
  const consideration = value.consideration.map((item: any) => cleanItem(item, true));
  if (offer.some((item: any) => !item) || consideration.some((item: any) => !item)) return null;

  return {
    offerer: String(value.offerer || ''),
    zone: String(value.zone || ''),
    offer,
    consideration,
    orderType: Number(value.orderType),
    startTime: String(value.startTime ?? ''),
    endTime: String(value.endTime ?? ''),
    zoneHash: String(value.zoneHash || ''),
    salt: String(value.salt ?? ''),
    conduitKey: String(value.conduitKey || ''),
    counter: String(value.counter ?? ''),
  };
}

function findOrderComponents(value: any, seen = new Set<any>()): any {
  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  const direct = cleanOrderComponents(value);
  if (direct) return direct;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findOrderComponents(item, seen);
      if (found) return found;
    }
    return null;
  }
  for (const child of Object.values(value)) {
    const found = findOrderComponents(child, seen);
    if (found) return found;
  }
  return null;
}

function validateOrderComponents(components: any, wallet: string, contract: string, tokenId: string, expectedPriceWei?: bigint | null) {
  if (!components) return 'OpenSea did not return a signable Seaport order.';
  if (normalizeAddress(components.offerer) !== wallet) return 'OpenSea returned an order for a different wallet.';
  if (![normalizeAddress(ZERO_ADDRESS), normalizeAddress(OPENSEA_SIGNED_ZONE)].includes(normalizeAddress(components.zone))) {
    return 'OpenSea returned an unexpected listing zone.';
  }
  if (String(components.conduitKey || '').toLowerCase() !== OPENSEA_CONDUIT_KEY.toLowerCase()) {
    return 'OpenSea returned an unexpected approval conduit.';
  }
  if (!Number.isInteger(Number(components.orderType)) || Number(components.orderType) < 0 || Number(components.orderType) > 3) {
    return 'OpenSea returned an invalid order type.';
  }
  if (!Array.isArray(components.offer) || components.offer.length !== 1) return 'The listing order must contain exactly one VoxelFlip.';
  const offered = components.offer[0];
  if (Number(offered.itemType) !== 2) return 'The listing order is not an ERC-721 listing.';
  if (normalizeAddress(offered.token) !== normalizeAddress(contract)) return 'The listing order targets a different NFT contract.';
  if (String(offered.identifierOrCriteria) !== tokenId) return 'The listing order targets a different VoxelFlip.';
  if (String(offered.startAmount) !== '1' || String(offered.endAmount) !== '1') return 'The listing order quantity must be one NFT.';
  if (!Array.isArray(components.consideration) || !components.consideration.length) return 'The listing order does not contain a sale price.';

  let startTotal = 0n;
  let endTotal = 0n;
  try {
    for (const item of components.consideration) {
      if (Number(item.itemType) !== 0 || normalizeAddress(item.token) !== normalizeAddress(ZERO_ADDRESS)) {
        return 'The listing must be priced in native ETH on Base.';
      }
      if (!ADDRESS_RE.test(String(item.recipient || ''))) return 'The listing contains an invalid payout recipient.';
      startTotal += BigInt(String(item.startAmount));
      endTotal += BigInt(String(item.endAmount));
    }
  } catch {
    return 'The listing price returned by OpenSea is invalid.';
  }
  if (startTotal <= 0n || endTotal <= 0n) return 'The listing price must be greater than zero.';
  if (startTotal > 1000n * 10n ** 18n || endTotal > 1000n * 10n ** 18n) return 'The listing price is outside the allowed range.';
  if (expectedPriceWei != null && (startTotal !== expectedPriceWei || endTotal !== expectedPriceWei)) {
    return 'OpenSea returned a listing price different from the price you entered.';
  }
  return '';
}

async function openSeaPost(url: string, body: any, apiKey: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
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
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || 'prepare').trim().toLowerCase();
  const wallet = String(body?.wallet || '').trim().toLowerCase();
  const tokenId = String(body?.tokenId ?? '').trim();

  if (!ADDRESS_RE.test(wallet)) return json({ error: 'Connect the Base wallet that owns this VoxelFlip.' }, 400);
  if (!TOKEN_RE.test(tokenId)) return json({ error: 'Choose a valid VoxelFlip token.' }, 400);

  const deployment = await getVoxelFlipDeployment();
  const contract = String(deployment?.address || '').trim();
  if (!ADDRESS_RE.test(contract)) return json({ error: 'The production VoxelFlip collection is not configured.' }, 503);

  const owner = await verifiedOwner(contract, tokenId);
  if (!owner) return json({ error: `Base ownership for VoxelFlip #${tokenId} could not be verified. Nothing was signed or listed.` }, 503);
  if (owner !== wallet) return json({ error: `The connected wallet does not currently own VoxelFlip #${tokenId} on Base.` }, 403);

  const apiKey = String(process.env.OPENSEA_API_KEY || '').trim();
  if (!apiKey) return json({ error: 'OpenSea listing preparation is waiting for the server-side OpenSea API key.' }, 503);

  if (action === 'prepare') {
    const priceEth = String(body?.priceEth || '').trim();
    const priceWei = ethToWei(priceEth);
    const durationDays = Math.floor(Number(body?.durationDays ?? 30));
    const useCreatorFee = body?.useCreatorFee !== false;
    if (priceWei == null || priceWei <= 0n || priceWei > 1000n * 10n ** 18n) return json({ error: 'Enter a valid listing price greater than 0 and no more than 1000 ETH.' }, 400);
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 180) return json({ error: 'Listing duration must be between 1 and 180 days.' }, 400);

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
      const { response, payload } = await openSeaPost(OPENSEA_ACTIONS_URL, requestBody, apiKey);
      if (!response.ok) {
        return json({
          error: String(payload?.detail || payload?.error || `OpenSea could not prepare the listing (${response.status}).`),
          openSeaStatus: response.status,
        }, response.status >= 500 ? 503 : 400);
      }
      const orderComponents = findOrderComponents(payload?.steps || payload);
      const orderError = validateOrderComponents(orderComponents, wallet, contract, tokenId, priceWei);
      if (orderError) return json({ error: `${orderError} Nothing was signed or listed.` }, 502);

      return json({
        prepared: true,
        walletSignatureRequired: true,
        automaticSigningActive: false,
        wallet,
        owner: wallet,
        contract,
        tokenId,
        chain: 'base',
        chainId: 8453,
        priceEth,
        durationDays,
        useCreatorFee,
        protocolAddress: SEAPORT_ADDRESS,
        conduitAddress: OPENSEA_CONDUIT_ADDRESS,
        conduitKey: OPENSEA_CONDUIT_KEY,
        orderComponents,
        openSeaUrl: `https://opensea.io/item/base/${contract}/${tokenId}`,
        notice: 'OpenSea prepared the order and Base ownership is verified. Your wallet must approve OpenSea if needed and sign the listing before it can be submitted.',
      });
    } catch (error) {
      return json({
        error: error instanceof Error && error.name === 'AbortError'
          ? 'OpenSea listing preparation timed out. Nothing was signed or listed.'
          : error instanceof Error ? error.message : 'OpenSea listing preparation failed.',
      }, 503);
    }
  }

  if (action === 'submit') {
    const signature = String(body?.signature || '').trim();
    const components = cleanOrderComponents(body?.orderComponents);
    if (!SIGNATURE_RE.test(signature)) return json({ error: 'The wallet listing signature is missing or invalid.' }, 400);
    const orderError = validateOrderComponents(components, wallet, contract, tokenId, null);
    if (orderError) return json({ error: orderError }, 400);

    try {
      const { response, payload } = await openSeaPost(OPENSEA_POST_URL, {
        parameters: components,
        signature,
        protocol_address: SEAPORT_ADDRESS,
      }, apiKey);
      if (!response.ok) {
        return json({
          error: String(payload?.detail || payload?.error || `OpenSea rejected the signed listing (${response.status}).`),
          openSeaStatus: response.status,
        }, response.status >= 500 ? 503 : 400);
      }
      const orderHash = String(payload?.order_hash || payload?.orderHash || '').trim();
      return json({
        listed: true,
        wallet,
        contract,
        tokenId,
        orderHash,
        openSeaUrl: `https://opensea.io/item/base/${contract}/${tokenId}`,
        automaticSigningActive: false,
        notice: 'OpenSea accepted the wallet-signed listing.',
      });
    } catch (error) {
      return json({
        error: error instanceof Error && error.name === 'AbortError'
          ? 'OpenSea listing submission timed out. Check the NFT on OpenSea before signing another listing.'
          : error instanceof Error ? error.message : 'OpenSea listing submission failed.',
      }, 503);
    }
  }

  return json({ error: 'Unknown listing action.' }, 400);
}
