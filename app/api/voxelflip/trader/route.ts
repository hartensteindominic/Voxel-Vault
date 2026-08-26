import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRIVATE_KEY_RE = /^(0x)?[a-fA-F0-9]{64}$/;
const OPENSEA = 'https://api.opensea.io/api/v2';
const OPENSEA_TIMEOUT_MS = 8_000;

async function openSeaGet(path: string, apiKey: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENSEA_TIMEOUT_MS);
  try {
    const response = await fetch(`${OPENSEA}${path}`, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data: response.ok ? data : null, error: response.ok ? null : String(data?.detail || data?.error || `OpenSea ${response.status}`) };
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? 'OpenSea request timed out' : error instanceof Error ? error.message : 'OpenSea request failed';
    return { ok: false, status: 0, data: null, error: message };
  } finally {
    clearTimeout(timer);
  }
}

function listCount(value: any) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object') return 0;
  for (const key of ['listings','offers','orders','nfts','items','results','asset_events','assetEvents','events']) if (Array.isArray(value[key])) return value[key].length;
  return 0;
}

function collectionSlug(value: any) {
  if (!value || typeof value !== 'object') return '';
  const candidate = value.collection;
  if (typeof candidate === 'string') return candidate;
  if (candidate && typeof candidate === 'object') return String(candidate.collection || candidate.slug || '');
  return String(value.slug || value.collection_slug || '');
}

function metricNumber(...values: any[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function bool(value: string | undefined) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function csv(value: string | undefined) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = (url.searchParams.get('wallet') || '').trim();
  const tokenId = (url.searchParams.get('tokenId') || '').trim();
  if (!ADDRESS_RE.test(wallet)) return NextResponse.json({ error: 'Connect a valid wallet to run the market scanner.' }, { status: 400 });

  const deployment = await getVoxelFlipDeployment();
  const contract = deployment?.address || '';
  const apiKey = process.env.OPENSEA_API_KEY?.trim() || '';
  const dedicatedRpcConfigured = Boolean((process.env.VOXELFLIP_RPC_URL || '').trim());
  const traderKeyConfigured = PRIVATE_KEY_RE.test((process.env.VOXELFLIP_TRADER_PRIVATE_KEY || '').trim());
  const autopilotRequested = bool(process.env.VOXELFLIP_AUTOPILOT_ENABLED);
  const killSwitch = bool(process.env.VOXELFLIP_AUTOPILOT_KILL_SWITCH);
  const executionFoundationReady = Boolean(apiKey && dedicatedRpcConfigured && traderKeyConfigured && ADDRESS_RE.test(contract));
  const allowlist = csv(process.env.VOXELFLIP_AUTO_ALLOWLIST);

  const riskPolicy = {
    maxTradeEth: positiveNumber(process.env.VOXELFLIP_AUTO_MAX_TRADE_ETH, 0.01),
    maxDailySpendEth: positiveNumber(process.env.VOXELFLIP_AUTO_MAX_DAILY_SPEND_ETH, 0.03),
    maxDailyLossEth: positiveNumber(process.env.VOXELFLIP_AUTO_MAX_DAILY_LOSS_ETH, 0.01),
    maxInventory: Math.max(1, Math.floor(positiveNumber(process.env.VOXELFLIP_AUTO_MAX_INVENTORY, 3))),
    minimumEdgeBps: Math.max(100, Math.floor(positiveNumber(process.env.VOXELFLIP_AUTO_MIN_EDGE_BPS, 800))),
    maxGasPercent: Math.min(25, positiveNumber(process.env.VOXELFLIP_AUTO_MAX_GAS_PERCENT, 8)),
    maxBotWalletEth: positiveNumber(process.env.VOXELFLIP_AUTO_MAX_BOT_WALLET_ETH, 0.1),
    lossWindowMinutes: Math.max(5, Math.floor(positiveNumber(process.env.VOXELFLIP_AUTO_LOSS_WINDOW_MINUTES, 60))),
    lossesBeforePause: Math.max(1, Math.floor(positiveNumber(process.env.VOXELFLIP_AUTO_LOSSES_BEFORE_PAUSE, 2))),
    pauseMinutes: Math.max(15, Math.floor(positiveNumber(process.env.VOXELFLIP_AUTO_PAUSE_MINUTES, 240))),
  };

  const gatewayPolicy = {
    auto: { enabledWhenExecutorExists: true, description: 'Allowlisted, verified, non-grail trading inventory only.', maxTradeEth: riskPolicy.maxTradeEth, dailySpendCapEth: riskPolicy.maxDailySpendEth, maxGasPercent: riskPolicy.maxGasPercent, whitelistOnly: true },
    oneTap: { description: 'Medium-risk opportunities wait for a phone approval.', minTradeEth: riskPolicy.maxTradeEth, maxTradeEth: positiveNumber(process.env.VOXELFLIP_ONE_TAP_MAX_TRADE_ETH, 0.05), timeoutSeconds: Math.max(30, Math.floor(positiveNumber(process.env.VOXELFLIP_ONE_TAP_TIMEOUT_SECONDS, 60))) },
    manual: { description: 'Swaps, grails, unverified collections, or trades above the 1-tap cap require manual review.', swapsAlwaysManual: true, grailsAlwaysManual: true, unverifiedAlwaysManual: true },
    circuitBreaker: { lossesBeforePause: riskPolicy.lossesBeforePause, windowMinutes: riskPolicy.lossWindowMinutes, pauseMinutes: riskPolicy.pauseMinutes, killSwitch },
    inventoryModel: 'Trading inventory belongs in the dedicated bot wallet/sub-account. Owner-wallet grails are watch-only unless explicitly delegated.',
  };

  const automaticSigningActive = false;
  const openSeaUrl = ADDRESS_RE.test(contract) && /^\d+$/.test(tokenId) ? `https://opensea.io/assets/base/${contract}/${tokenId}` : 'https://opensea.io';
  const base = {
    wallet,
    tokenId,
    contract,
    chain: 'base',
    openSeaUrl,
    scanner: apiKey ? 'live' : 'configuration-needed',
    executionMode: executionFoundationReady ? 'autopilot-foundation-ready' : 'autopilot-setup-needed',
    executionFoundationReady,
    autopilotRequested,
    automaticSigningActive,
    dedicatedTraderSignerConfigured: traderKeyConfigured,
    dedicatedRpcConfigured,
    allowlistConfigured: allowlist.length > 0,
    allowlistCount: allowlist.length,
    killSwitch,
    riskPolicy,
    gatewayPolicy,
    setup: { openSea: Boolean(apiKey), productionRpc: dedicatedRpcConfigured, traderSigner: traderKeyConfigured, collection: ADDRESS_RE.test(contract), allowlist: allowlist.length > 0, executor: false },
    executionNotice: 'Monitoring only. Autopilot cannot buy, sell, list, or sign transactions yet.',
  };

  if (!apiKey) return NextResponse.json({ ...base, marketDataConfigured: false, listings: 0, offersReceived: 0, collectionFloorEth: null, collectionListings: null, sales24h: null, tokenListed: null, activity: [], nextStep: 'Connect OpenSea market data to show live floor, listings, and sales.' }, { headers: { 'Cache-Control': 'no-store' } });

  const accountCalls: Promise<any>[] = [
    openSeaGet(`/account/${wallet}/listings?limit=50&chains=base`, apiKey),
    openSeaGet(`/account/${wallet}/offers_received?limit=50`, apiKey),
  ];
  const hasToken = ADDRESS_RE.test(contract) && /^\d+$/.test(tokenId);
  if (hasToken) accountCalls.push(openSeaGet(`/chain/base/contract/${contract}/nfts/${tokenId}`, apiKey));
  const [walletListings, offers, nft] = await Promise.all(accountCalls);

  let slug = '';
  let stats: any = null;
  let collectionListings: any = null;
  let sales: any = null;
  let bestListing: any = null;
  if (hasToken) {
    const collectionLookup = await openSeaGet(`/chain/base/contract/${contract}/nfts/${tokenId}/collection`, apiKey);
    slug = collectionLookup.ok ? collectionSlug(collectionLookup.data) : '';
    if (slug) {
      const after = Math.floor(Date.now() / 1000) - 86_400;
      [stats, collectionListings, sales, bestListing] = await Promise.all([
        openSeaGet(`/collections/${encodeURIComponent(slug)}/stats`, apiKey),
        openSeaGet(`/listings/collection/${encodeURIComponent(slug)}/all?limit=200`, apiKey),
        openSeaGet(`/events/collection/${encodeURIComponent(slug)}?event_type=sale&after=${after}&limit=200`, apiKey),
        openSeaGet(`/listings/collection/${encodeURIComponent(slug)}/nfts/${tokenId}/best`, apiKey),
      ]);
    }
  }

  const walletListingCount = listCount(walletListings?.data);
  const offerCount = listCount(offers?.data);
  const collectionListingCount = collectionListings?.ok ? listCount(collectionListings.data) : null;
  const collectionListingsMore = Boolean(collectionListings?.data?.next || collectionListings?.data?.next?.value);
  const sales24h = sales?.ok ? listCount(sales.data) : null;
  const sales24hMore = Boolean(sales?.data?.next || sales?.data?.next?.value);
  const totalStats = stats?.data?.total || stats?.data?.stats || stats?.data || {};
  const collectionFloorEth = stats?.ok ? metricNumber(totalStats.floor_price, totalStats.floorPrice, stats?.data?.floor_price, stats?.data?.floorPrice) : null;
  const tokenListed = bestListing ? Boolean(bestListing.ok && listCount(bestListing.data) > 0 || bestListing.ok && bestListing.data && Object.keys(bestListing.data).length > 0) : null;
  const checkedAt = new Date().toISOString();
  const activity = [
    { type: 'SCAN', at: checkedAt, text: slug ? `OpenSea collection scan complete for ${slug}.` : 'OpenSea wallet scan complete.' },
    ...(tokenId ? [{ type: 'WATCH', at: checkedAt, text: `Watching VoxelFlip #${tokenId} on Base.` }] : []),
    { type: 'SAFE', at: checkedAt, text: 'No transaction was signed. Autopilot remains monitoring-only.' },
  ];

  return NextResponse.json({
    ...base,
    marketDataConfigured: true,
    scanner: walletListings?.ok || offers?.ok || nft?.ok ? 'live' : 'degraded',
    checkedAt,
    collectionSlug: slug || null,
    collectionFloorEth,
    collectionListings: collectionListingCount,
    collectionListingsMore,
    sales24h,
    sales24hMore,
    tokenListed,
    listings: walletListingCount,
    offersReceived: offerCount,
    nft: nft?.data || null,
    activity,
    sourceHealth: {
      walletListings: walletListings?.ok ? 'ok' : walletListings?.error || 'unavailable',
      offers: offers?.ok ? 'ok' : offers?.error || 'unavailable',
      nft: nft ? (nft.ok ? 'ok' : nft.error || 'unavailable') : 'not-requested',
      stats: stats ? (stats.ok ? 'ok' : stats.error || 'unavailable') : 'not-requested',
      collectionListings: collectionListings ? (collectionListings.ok ? 'ok' : collectionListings.error || 'unavailable') : 'not-requested',
      sales24h: sales ? (sales.ok ? 'ok' : sales.error || 'unavailable') : 'not-requested',
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
