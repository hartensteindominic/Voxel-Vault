import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = (url.searchParams.get('wallet') || '').trim();
  const tokenId = (url.searchParams.get('tokenId') || '').trim();
  if (!ADDRESS_RE.test(wallet)) return NextResponse.json({ error: 'Connect a valid wallet to run the market scanner.' }, { status: 400 });
  const deployment = await getVoxelFlipDeployment();
  const contract = deployment?.address || '';
  const apiKey = process.env.OPENSEA_API_KEY?.trim() || '';

  const base = {
    wallet,
    contract,
    chain: 'base',
    scanner: apiKey ? 'live' : 'configuration-needed',
    executionMode: 'approval-required',
    autoExecutionEnabled: false,
    protections: ['No automatic wallet signing', 'No silent purchases', 'No silent sales', 'Every transaction remains wallet-approved'],
  };
  if (!apiKey) return NextResponse.json({ ...base, marketDataConfigured: false, listings: 0, offersReceived: 0, portfolio: null, nft: null, nextStep: 'Configure OPENSEA_API_KEY on the production server to activate automatic market monitoring.' }, { headers: { 'Cache-Control': 'no-store' } });

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
  return NextResponse.json({
    ...base,
    marketDataConfigured: true,
    scanner: healthy ? 'live' : 'degraded',
    checkedAt: new Date().toISOString(),
    listings: listCount(listings?.data),
    offersReceived: listCount(offers?.data),
    portfolio: portfolio?.data || null,
    nft: nft?.data || null,
    analytics: analytics?.data || null,
    sourceHealth: {
      listings: listings?.ok ? 'ok' : listings?.error || 'unavailable',
      offers: offers?.ok ? 'ok' : offers?.error || 'unavailable',
      portfolio: portfolio?.ok ? 'ok' : portfolio?.error || 'unavailable',
      nft: nft ? (nft.ok ? 'ok' : nft.error || 'unavailable') : 'not-requested',
      analytics: analytics ? (analytics.ok ? 'ok' : analytics.error || 'unavailable') : 'not-requested',
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
