import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRIVATE_KEY_RE = /^(0x)?[a-fA-F0-9]{64}$/;
const OPENSEA = 'https://api.opensea.io/api/v2';

async function openSeaGet(path: string, apiKey: string) {
  try {
    const response = await fetch(`${OPENSEA}${path}`, { headers: { 'x-api-key': apiKey, accept: 'application/json' }, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data: response.ok ? data : null, error: response.ok ? null : String(data?.detail || data?.error || `OpenSea ${response.status}`) };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: error instanceof Error ? error.message : 'OpenSea request failed' };
  }
}

function listCount(value: any) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object') return 0;
  for (const key of ['listings','offers','orders','nfts','items','results']) if (Array.isArray(value[key])) return value[key].length;
  return 0;
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
    auto: {
      enabledWhenExecutorExists: true,
      description: 'Allowlisted, verified, non-grail trading inventory only.',
      maxTradeEth: riskPolicy.maxTradeEth,
      dailySpendCapEth: riskPolicy.maxDailySpendEth,
      maxGasPercent: riskPolicy.maxGasPercent,
      whitelistOnly: true,
    },
    oneTap: {
      description: 'Medium-risk opportunities wait for a phone approval.',
      minTradeEth: riskPolicy.maxTradeEth,
      maxTradeEth: positiveNumber(process.env.VOXELFLIP_ONE_TAP_MAX_TRADE_ETH, 0.05),
      timeoutSeconds: Math.max(30, Math.floor(positiveNumber(process.env.VOXELFLIP_ONE_TAP_TIMEOUT_SECONDS, 60))),
    },
    manual: {
      description: 'Swaps, grails, unverified collections, or trades above the 1-tap cap require manual review.',
      swapsAlwaysManual: true,
      grailsAlwaysManual: true,
      unverifiedAlwaysManual: true,
    },
    circuitBreaker: {
      lossesBeforePause: riskPolicy.lossesBeforePause,
      windowMinutes: riskPolicy.lossWindowMinutes,
      pauseMinutes: riskPolicy.pauseMinutes,
      killSwitch,
    },
    inventoryModel: 'Trading inventory belongs in the dedicated bot wallet/sub-account. Owner-wallet grails are watch-only unless explicitly delegated.',
  };

  const automaticSigningActive = false;
  const base = {
    wallet,
    contract,
    chain: 'base',
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
    setup: {
      openSea: Boolean(apiKey),
      productionRpc: dedicatedRpcConfigured,
      traderSigner: traderKeyConfigured,
      collection: ADDRESS_RE.test(contract),
      allowlist: allowlist.length > 0,
      executor: false,
    },
    protections: [
      'Dedicated trading signer only; never reuse the collection-owner or mint-signer key',
      'Trading inventory wallet/sub-account separated from owner-wallet grails',
      'Whitelist-only automatic buys',
      `Per-trade cap ${riskPolicy.maxTradeEth} ETH`,
      `Daily spend cap ${riskPolicy.maxDailySpendEth} ETH`,
      `Daily loss circuit breaker ${riskPolicy.maxDailyLossEth} ETH`,
      `Gas guard ${riskPolicy.maxGasPercent}% of trade value`,
      `Inventory cap ${riskPolicy.maxInventory}`,
      `Minimum modeled edge ${riskPolicy.minimumEdgeBps} bps`,
      `${riskPolicy.lossesBeforePause} losses in ${riskPolicy.lossWindowMinutes} minutes pauses trading for ${riskPolicy.pauseMinutes} minutes`,
      'Kill switch remains available before automatic execution is activated',
    ],
    executionNotice: executionFoundationReady
      ? 'Scanner, RPC and dedicated signer foundation are ready. Automatic signing remains OFF until the constrained OpenSea/Base executor and spend/delegation permission are activated.'
      : 'Autopilot is monitoring-only until OpenSea, a production Base RPC, a separate trader signer, and a bounded permission/executor are configured.',
  };

  if (!apiKey) return NextResponse.json({ ...base, marketDataConfigured: false, listings: 0, offersReceived: 0, portfolio: null, nft: null, activity: [], nextStep: 'Configure OPENSEA_API_KEY on the production server to activate automatic market monitoring.' }, { headers: { 'Cache-Control': 'no-store' } });

  const calls: Promise<any>[] = [
    openSeaGet(`/account/${wallet}/listings?limit=50&chains=base`, apiKey),
    openSeaGet(`/account/${wallet}/offers_received?limit=50`, apiKey),
    openSeaGet(`/account/${wallet}/portfolio`, apiKey),
  ];
  if (ADDRESS_RE.test(contract) && /^\d+$/.test(tokenId)) {
    calls.push(openSeaGet(`/chain/base/contract/${contract}/nfts/${tokenId}`, apiKey));
    calls.push(openSeaGet(`/chain/base/contract/${contract}/nfts/${tokenId}/analytics`, apiKey));
  }
  const [listings, offers, portfolio, nft, analytics] = await Promise.all(calls);
  const healthy = [listings, offers, portfolio].filter(Boolean).filter(result => result.ok).length;
  const listingCount = listCount(listings?.data);
  const offerCount = listCount(offers?.data);
  const checkedAt = new Date().toISOString();
  const activity = [
    { type: 'SCAN', at: checkedAt, text: `OpenSea scan complete · ${listingCount} active listings · ${offerCount} offers received.` },
    ...(tokenId ? [{ type: 'WATCH', at: checkedAt, text: `Watching VoxelFlip #${tokenId} on Base.` }] : []),
    { type: automaticSigningActive ? 'AUTO' : 'SAFE', at: checkedAt, text: automaticSigningActive ? 'Bounded automatic executor is active.' : 'No automatic signature was sent. Monitoring and gateway checks only.' },
  ];

  return NextResponse.json({
    ...base,
    marketDataConfigured: true,
    scanner: healthy ? 'live' : 'degraded',
    checkedAt,
    listings: listingCount,
    offersReceived: offerCount,
    portfolio: portfolio?.data || null,
    nft: nft?.data || null,
    analytics: analytics?.data || null,
    activity,
    sourceHealth: {
      listings: listings?.ok ? 'ok' : listings?.error || 'unavailable',
      offers: offers?.ok ? 'ok' : offers?.error || 'unavailable',
      portfolio: portfolio?.ok ? 'ok' : portfolio?.error || 'unavailable',
      nft: nft ? (nft.ok ? 'ok' : nft.error || 'unavailable') : 'not-requested',
      analytics: analytics ? (analytics.ok ? 'ok' : analytics.error || 'unavailable') : 'not-requested',
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
