import { JsonRpcProvider, formatUnits } from 'ethers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabase-admin';
import { getVoxelFlipDeployment } from './voxelflip-deployment';
import { readVoxelFlipProfitSummary } from './voxelflip-profit-ledger';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const OPENSEA = 'https://api.opensea.io/api/v2';
const SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000;
const RECOMMENDATION_INTERVAL_MS = 6 * 60 * 60 * 1000;
const HTTP_TIMEOUT_MS = 7000;

function finite(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function address(value: any) {
  const candidate = typeof value === 'string' ? value : value?.address || value?.account_address || value?.wallet || '';
  return ADDRESS_RE.test(String(candidate)) ? String(candidate).toLowerCase() : '';
}

function eventList(value: any) {
  if (!value || typeof value !== 'object') return [];
  for (const key of ['asset_events', 'assetEvents', 'events', 'results']) if (Array.isArray(value[key])) return value[key];
  return [];
}

function nftList(value: any) {
  if (!value || typeof value !== 'object') return [];
  for (const key of ['nfts', 'assets', 'results']) if (Array.isArray(value[key])) return value[key];
  return [];
}

function listingList(value: any) {
  if (!value || typeof value !== 'object') return [];
  for (const key of ['listings', 'orders', 'results']) if (Array.isArray(value[key])) return value[key];
  return [];
}

function offerList(value: any) {
  if (!value || typeof value !== 'object') return [];
  for (const key of ['offers', 'orders', 'results']) if (Array.isArray(value[key])) return value[key];
  return [];
}

function tokenId(value: any) {
  const candidate = value?.identifier ?? value?.token_id ?? value?.tokenId ?? value?.nft?.identifier ?? value?.nft?.token_id;
  const id = String(candidate ?? '').trim();
  return /^\d+$/.test(id) ? id : '';
}

function eventTime(event: any) {
  const raw = event?.event_timestamp ?? event?.eventTimestamp ?? event?.timestamp ?? event?.created_date;
  if (typeof raw === 'number' || /^\d+$/.test(String(raw || ''))) {
    const numeric = Number(raw);
    const millis = numeric > 10_000_000_000 ? numeric : numeric * 1000;
    const date = new Date(millis);
    if (Number.isFinite(date.getTime())) return date;
  }
  const date = new Date(String(raw || ''));
  return Number.isFinite(date.getTime()) ? date : null;
}

function paymentEth(event: any) {
  const payment = event?.payment || event?.payment_token || event?.price || null;
  if (!payment || typeof payment !== 'object') return null;
  const symbol = String(payment.symbol || payment.token_symbol || payment?.token?.symbol || payment?.currency || '').toUpperCase();
  if (symbol && symbol !== 'ETH' && symbol !== 'WETH') return null;
  const raw = payment.quantity ?? payment.amount ?? payment.value ?? payment.current?.value;
  const decimals = finite(payment.decimals ?? payment?.token?.decimals ?? payment.current?.decimals, 18);
  if (raw == null || decimals < 0 || decimals > 30) return null;
  try {
    const amount = Number(BigInt(String(raw))) / Math.pow(10, decimals);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  } catch {
    const amount = Number(raw);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  }
}

function orderPriceEth(order: any) {
  const candidates = [
    order?.price,
    order?.current_price,
    order?.protocol_data?.parameters?.consideration?.[0],
    order?.protocol_data?.parameters?.offer?.[0],
  ].filter(Boolean);
  for (const candidate of candidates) {
    const symbol = String(candidate?.currency || candidate?.symbol || candidate?.token?.symbol || '').toUpperCase();
    if (symbol && symbol !== 'ETH' && symbol !== 'WETH') continue;
    const raw = candidate?.current?.value ?? candidate?.value ?? candidate?.amount ?? candidate?.quantity ?? candidate?.startAmount;
    const decimals = finite(candidate?.current?.decimals ?? candidate?.decimals ?? candidate?.token?.decimals, 18);
    if (raw == null) continue;
    try {
      const amount = Number(BigInt(String(raw))) / Math.pow(10, decimals);
      if (Number.isFinite(amount) && amount >= 0) return amount;
    } catch {
      const amount = Number(raw);
      if (Number.isFinite(amount) && amount >= 0) return amount;
    }
  }
  return null;
}

async function timedJson(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, cache: 'no-store', signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data, error: response.ok ? '' : String(data?.detail || data?.error || `${response.status}`) };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: error instanceof Error ? error.message : 'request failed' };
  } finally {
    clearTimeout(timer);
  }
}

async function openSeaGet(path: string, apiKey: string) {
  if (!apiKey) return { ok: false, status: 0, data: null, error: 'OpenSea API key is not configured.' };
  return timedJson(`${OPENSEA}${path}`, { headers: { 'x-api-key': apiKey, accept: 'application/json' } });
}

async function ethMarket() {
  const proKey = String(process.env.COINGECKO_PRO_API_KEY || '').trim();
  const demoKey = String(process.env.COINGECKO_DEMO_API_KEY || '').trim();
  const base = proKey ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (proKey) headers['x-cg-pro-api-key'] = proKey;
  if (!proKey && demoKey) headers['x-cg-demo-api-key'] = demoKey;
  const response = await timedJson(`${base}/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`, { headers });
  if (!response.ok) return { available: false, usd: null, change24hPercent: null, source: 'coingecko', error: response.error };
  const eth = response.data?.ethereum || {};
  const usd = Number(eth.usd);
  const change = Number(eth.usd_24h_change);
  return {
    available: Number.isFinite(usd) && usd > 0,
    usd: Number.isFinite(usd) ? usd : null,
    change24hPercent: Number.isFinite(change) ? change : null,
    lastUpdatedAt: eth.last_updated_at ? new Date(Number(eth.last_updated_at) * 1000).toISOString() : null,
    source: 'coingecko',
    error: '',
  };
}

async function baseGas() {
  const rpc = String(process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || 'https://mainnet.base.org').trim();
  const provider = new JsonRpcProvider(rpc, 8453, { staticNetwork: true });
  try {
    const fee = await provider.getFeeData();
    const wei = fee.maxFeePerGas ?? fee.gasPrice ?? BigInt(0);
    const gwei = Number(formatUnits(wei, 'gwei'));
    return { available: Number.isFinite(gwei), gwei: Number.isFinite(gwei) ? gwei : null, source: 'base-rpc', error: '' };
  } catch (error) {
    return { available: false, gwei: null, source: 'base-rpc', error: error instanceof Error ? error.message : 'Base RPC unavailable' };
  } finally {
    provider.destroy();
  }
}

function collectionSlug(data: any) {
  const candidate = data?.collection?.slug || data?.collection || data?.collection_slug || data?.collectionSlug || data?.slug || '';
  return typeof candidate === 'string' ? candidate.trim() : '';
}

function intervalStat(stats: any, labels: string[], field: string) {
  const intervals = Array.isArray(stats?.intervals) ? stats.intervals : [];
  const item = intervals.find((entry: any) => labels.includes(String(entry?.interval || entry?.period || entry?.name || '').toLowerCase()));
  return finite(item?.[field] ?? item?.stats?.[field], 0);
}

function statsSummary(stats: any) {
  const total = stats?.total || stats?.stats || {};
  const floor = finite(total?.floor_price ?? total?.floorPrice, 0);
  const volume24h = intervalStat(stats, ['one_day', '1d', '24h', 'day'], 'volume');
  const sales24h = intervalStat(stats, ['one_day', '1d', '24h', 'day'], 'sales');
  return {
    floorPriceEth: floor > 0 ? floor : null,
    totalVolumeEth: finite(total?.volume, 0),
    totalSales: finite(total?.sales, 0),
    owners: finite(total?.num_owners ?? total?.numOwners ?? total?.owners, 0),
    marketCapEth: finite(total?.market_cap ?? total?.marketCap, 0),
    volume24hEth: volume24h,
    sales24h: sales24h,
  };
}

function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function parseSales(data: any) {
  const sales = eventList(data).map((event: any) => {
    const seller = address(event?.seller || event?.from_account || event?.from_address || event?.maker);
    const buyer = address(event?.buyer || event?.to_account || event?.to_address || event?.taker);
    return {
      seller,
      buyer,
      tokenId: tokenId(event),
      priceEth: paymentEth(event),
      occurredAt: eventTime(event)?.toISOString() || null,
    };
  }).filter((sale: any) => sale.seller && sale.buyer && sale.seller !== sale.buyer);
  return sales;
}

function parseTopBuyer(sales: any[]) {
  const counts = new Map<string, number>();
  for (const sale of sales) if (sale.buyer) counts.set(sale.buyer, (counts.get(sale.buyer) || 0) + 1);
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  return top ? { address: top[0], purchasesObserved: top[1] } : null;
}

function activeHourPattern(sales: any[]) {
  if (sales.length < 20) return null;
  const counts = new Array(24).fill(0);
  for (const sale of sales) {
    if (!sale.occurredAt) continue;
    const date = new Date(sale.occurredAt);
    if (Number.isFinite(date.getTime())) counts[date.getUTCHours()] += 1;
  }
  const best = counts.reduce((index, count, current) => count > counts[index] ? current : index, 0);
  return { utcHour: best, observations: counts[best], sampleSize: sales.length };
}

function buildRecommendation(market: any, sales: any[], ledger: any) {
  const prices = sales.map(sale => sale.priceEth).filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  const medianSale = median(prices);
  const floor = market.floorPriceEth;
  const topOffer = market.topOfferEth;
  const sampleSize = prices.length;

  if (sampleSize < 3) {
    return {
      action: 'PRICE_DISCOVERY',
      confidence: 'low',
      suggestedPriceBandEth: null,
      reason: 'There are fewer than 3 independent priced sales in the observed window, so Neural Core will not pretend the collection has a reliable fair value yet.',
      evidence: { independentPricedSales: sampleSize, floorPriceEth: floor, topOfferEth: topOffer, realizedProfitEth: ledger?.realizedProfitEth ?? null },
    };
  }

  const anchors = [medianSale, floor, topOffer].filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  const anchor = median(anchors) || medianSale || 0;
  const low = Math.max(topOffer || 0, anchor * 0.92);
  const highCandidate = floor && floor > 0 ? Math.min(floor, anchor * 1.12) : anchor * 1.12;
  const high = Math.max(low, highCandidate);
  const confidence = sampleSize >= 20 ? 'high' : sampleSize >= 8 ? 'medium' : 'low';

  return {
    action: 'LIST_WITHIN_BAND',
    confidence,
    suggestedPriceBandEth: [Number(low.toFixed(6)), Number(high.toFixed(6))],
    reason: 'The band uses independent recent sales, current floor and current offers as observations. It is a pricing discipline tool, not a promise of sale or future value.',
    evidence: { independentPricedSales: sampleSize, medianSaleEth: medianSale, floorPriceEth: floor, topOfferEth: topOffer, realizedProfitEth: ledger?.realizedProfitEth ?? null },
  };
}

function buildLearning(market: any, sales: any[], history: any[]) {
  const patterns: any[] = [];
  const snapshots = history.filter(item => item.kind === 'market_snapshot' && item.payload?.market);
  if (snapshots.length >= 4 && market.floorPriceEth) {
    const oldestFloor = [...snapshots].reverse().map(item => finite(item.payload?.market?.floorPriceEth, 0)).find(value => value > 0);
    if (oldestFloor) {
      patterns.push({
        type: 'FLOOR_TREND',
        confidence: snapshots.length >= 24 ? 'medium' : 'low',
        value: Number((((market.floorPriceEth - oldestFloor) / oldestFloor) * 100).toFixed(2)),
        unit: 'percent',
        sampleSize: snapshots.length,
        note: 'Observed listing-floor movement only; asking prices are not realized value.',
      });
    }
  }

  const pricedSales = sales.filter(sale => typeof sale.priceEth === 'number' && sale.priceEth > 0);
  if (pricedSales.length >= 5) {
    patterns.push({
      type: 'MEDIAN_SALE',
      confidence: pricedSales.length >= 20 ? 'high' : pricedSales.length >= 8 ? 'medium' : 'low',
      value: Number((median(pricedSales.map(sale => sale.priceEth)) || 0).toFixed(6)),
      unit: 'ETH',
      sampleSize: pricedSales.length,
      note: 'Median of independent priced sale events observed by OpenSea.',
    });
  }

  const hour = activeHourPattern(pricedSales);
  if (hour) patterns.push({ type: 'ACTIVE_SALE_HOUR', confidence: hour.sampleSize >= 50 ? 'medium' : 'low', value: hour.utcHour, unit: 'UTC hour', sampleSize: hour.sampleSize, note: 'Most frequent observed sale hour; correlation is not causation.' });

  if (!patterns.length) patterns.push({ type: 'INSUFFICIENT_SAMPLE', confidence: 'high', value: null, unit: null, sampleSize: pricedSales.length, note: 'Neural Core needs more independent market observations before claiming a repeatable pattern.' });
  return patterns;
}

async function memoryRows(admin: SupabaseClient, wallet: string, limit = 200) {
  const { data, error } = await admin
    .from('voxelflip_neural_memory')
    .select('id,kind,wallet,contract_address,token_id,confidence,payload,observed_at,created_at')
    .eq('wallet', wallet.toLowerCase())
    .order('observed_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('Neural Core memory is unavailable. Apply Supabase migration 012.');
  return Array.isArray(data) ? data : [];
}

async function persistIfDue(admin: SupabaseClient, wallet: string, contract: string, kind: string, payload: any, confidence: string | null, minimumAgeMs: number, history: any[]) {
  const latest = history.find(item => item.kind === kind);
  const latestTime = latest ? new Date(latest.observed_at).getTime() : 0;
  if (latestTime && Date.now() - latestTime < minimumAgeMs) return false;
  const { error } = await admin.from('voxelflip_neural_memory').insert({
    kind,
    wallet: wallet.toLowerCase(),
    contract_address: contract.toLowerCase(),
    confidence,
    payload,
    observed_at: new Date().toISOString(),
  });
  if (error) throw new Error('Neural Core memory is unavailable. Apply Supabase migration 012.');
  return true;
}

export async function saveNeuralCoreWallet(admin: SupabaseClient, wallet: string) {
  if (!ADDRESS_RE.test(wallet)) throw new Error('A valid Base wallet is required.');
  const normalized = wallet.toLowerCase();
  const { error } = await admin.from('voxelflip_neural_memory').insert({
    kind: 'admin_config',
    wallet: normalized,
    payload: { selectedWallet: normalized },
    observed_at: new Date().toISOString(),
  });
  if (error) throw new Error('Neural Core memory is unavailable. Apply Supabase migration 012.');
  return normalized;
}

export async function readNeuralCoreWallet(admin: SupabaseClient = getSupabaseAdmin()) {
  const configured = String(process.env.VOXELFLIP_NEURAL_WALLET || '').trim();
  if (ADDRESS_RE.test(configured)) return configured.toLowerCase();
  const { data, error } = await admin
    .from('voxelflip_neural_memory')
    .select('wallet,payload,observed_at')
    .eq('kind', 'admin_config')
    .order('observed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return '';
  const candidate = data?.payload?.selectedWallet || data?.wallet || '';
  return ADDRESS_RE.test(String(candidate)) ? String(candidate).toLowerCase() : '';
}

export async function readNeuralCoreMemory(admin: SupabaseClient, wallet: string, limit = 500) {
  if (!ADDRESS_RE.test(wallet)) throw new Error('A valid Base wallet is required.');
  return memoryRows(admin, wallet, Math.min(1000, Math.max(1, limit)));
}

async function inventoryForWallet(wallet: string, contract: string, slug: string, apiKey: string) {
  if (!wallet || !apiKey || !ADDRESS_RE.test(contract)) return { available: false, items: [], activeListings: 0, error: apiKey ? '' : 'OpenSea API key is not configured.' };
  const [owned, listings] = await Promise.all([
    openSeaGet(`/chain/base/account/${wallet}/nfts?limit=100`, apiKey),
    openSeaGet(`/account/${wallet}/listings?limit=100&chains=base`, apiKey),
  ]);
  const contractLower = contract.toLowerCase();
  const ownedItems = nftList(owned.data).filter((item: any) => address(item?.contract || item?.contract_address) === contractLower).slice(0, 20);
  const activeListings = listingList(listings.data).length;

  const items = await Promise.all(ownedItems.map(async (item: any) => {
    const id = tokenId(item);
    let bestListing: any = null;
    if (slug && id) {
      const result = await openSeaGet(`/listings/collection/${encodeURIComponent(slug)}/nfts/${encodeURIComponent(id)}/best`, apiKey);
      if (result.ok) bestListing = result.data;
    }
    const listingPrice = orderPriceEth(bestListing?.listing || bestListing?.order || bestListing);
    return {
      tokenId: id,
      name: String(item?.name || item?.metadata?.name || `VoxelFlip #${id || '?'}`),
      imageUrl: String(item?.image_url || item?.display_image_url || item?.image || ''),
      listed: listingPrice != null,
      listingPriceEth: listingPrice,
      openSeaUrl: id ? `https://opensea.io/item/base/${contract}/${id}` : '',
    };
  }));
  return { available: owned.ok || listings.ok, items, activeListings, error: owned.ok || listings.ok ? '' : owned.error || listings.error };
}

export async function refreshNeuralCore({ wallet = '', persist = true }: { wallet?: string; persist?: boolean } = {}) {
  const normalizedWallet = ADDRESS_RE.test(wallet) ? wallet.toLowerCase() : '';
  const deployment = await getVoxelFlipDeployment();
  const contract = String(deployment?.address || '').trim();
  const apiKey = String(process.env.OPENSEA_API_KEY || '').trim();
  const admin = getSupabaseAdmin();

  const [eth, gas, contractResponse] = await Promise.all([
    ethMarket(),
    baseGas(),
    ADDRESS_RE.test(contract) && apiKey ? openSeaGet(`/chain/base/contract/${contract}`, apiKey) : Promise.resolve({ ok: false, status: 0, data: null, error: apiKey ? 'VoxelFlip contract unavailable.' : 'OpenSea API key is not configured.' }),
  ]);

  const slug = collectionSlug(contractResponse.data);
  const after30d = Math.floor(Date.now() / 1000) - 30 * 86_400;
  const [statsResponse, salesResponse, offersResponse, inventory] = await Promise.all([
    slug ? openSeaGet(`/collections/${encodeURIComponent(slug)}/stats`, apiKey) : Promise.resolve({ ok: false, status: 0, data: null, error: 'OpenSea collection slug is not available yet.' }),
    slug ? openSeaGet(`/events/collection/${encodeURIComponent(slug)}?event_type=sale&after=${after30d}&limit=200`, apiKey) : Promise.resolve({ ok: false, status: 0, data: null, error: 'OpenSea collection slug is not available yet.' }),
    slug ? openSeaGet(`/offers/collection/${encodeURIComponent(slug)}?limit=50`, apiKey) : Promise.resolve({ ok: false, status: 0, data: null, error: 'OpenSea collection slug is not available yet.' }),
    normalizedWallet ? inventoryForWallet(normalizedWallet, contract, slug, apiKey) : Promise.resolve({ available: false, items: [], activeListings: 0, error: 'Connect a wallet to load inventory.' }),
  ]);

  const stats = statsSummary(statsResponse.data);
  const sales = parseSales(salesResponse.data);
  const last24h = Date.now() - 24 * 60 * 60 * 1000;
  const sales24h = sales.filter(sale => sale.occurredAt && new Date(sale.occurredAt).getTime() >= last24h);
  const pricedSales24h = sales24h.filter(sale => typeof sale.priceEth === 'number');
  const volume24hFromEvents = pricedSales24h.reduce((sum, sale) => sum + Number(sale.priceEth || 0), 0);
  const offerPrices = offerList(offersResponse.data).map(orderPriceEth).filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  const topOfferEth = offerPrices.length ? Math.max(...offerPrices) : null;

  let ledger: any = { available: false, realizedProfitEth: null, costCoverageComplete: false, knownNetEth: 0, latest: [] };
  if (normalizedWallet) {
    try { ledger = await readVoxelFlipProfitSummary(normalizedWallet); } catch {}
  }

  let history: any[] = [];
  let memoryAvailable = false;
  let memoryError = '';
  if (normalizedWallet) {
    try {
      history = await memoryRows(admin, normalizedWallet, 300);
      memoryAvailable = true;
    } catch (error) {
      memoryError = error instanceof Error ? error.message : 'Neural Core memory is unavailable.';
    }
  }

  const market = {
    ethUsd: eth.usd,
    ethChange24hPercent: eth.change24hPercent,
    baseGasGwei: gas.gwei,
    collectionSlug: slug || null,
    floorPriceEth: stats.floorPriceEth,
    topOfferEth,
    sales24h: stats.sales24h || sales24h.length,
    volume24hEth: stats.volume24hEth || Number(volume24hFromEvents.toFixed(8)),
    totalSales: stats.totalSales,
    totalVolumeEth: stats.totalVolumeEth,
    owners: stats.owners,
    activeListingsByWallet: inventory.activeListings,
    mostActiveObservedBuyer: parseTopBuyer(sales24h),
  };

  const learning = buildLearning(market, sales, history);
  const recommendation = buildRecommendation(market, sales, ledger);
  const snapshotPayload = {
    market,
    inventory: { count: inventory.items.length, activeListings: inventory.activeListings },
    ledger: { available: Boolean(ledger.available), realizedProfitEth: ledger.realizedProfitEth ?? null, costCoverageComplete: Boolean(ledger.costCoverageComplete) },
    sources: { openSea: Boolean(apiKey && contractResponse.ok), coingecko: Boolean(eth.available), baseRpc: Boolean(gas.available) },
  };

  let snapshotStored = false;
  let recommendationStored = false;
  if (persist && normalizedWallet && memoryAvailable) {
    try {
      snapshotStored = await persistIfDue(admin, normalizedWallet, contract, 'market_snapshot', snapshotPayload, null, SNAPSHOT_INTERVAL_MS, history);
      recommendationStored = await persistIfDue(admin, normalizedWallet, contract, 'recommendation', recommendation, recommendation.confidence, RECOMMENDATION_INTERVAL_MS, history);
      if (snapshotStored || recommendationStored) history = await memoryRows(admin, normalizedWallet, 300);
    } catch (error) {
      memoryAvailable = false;
      memoryError = error instanceof Error ? error.message : 'Neural Core memory could not be updated.';
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    wallet: normalizedWallet || null,
    contract: ADDRESS_RE.test(contract) ? contract : null,
    chain: 'base',
    market,
    inventory,
    ledger,
    recommendation,
    learning,
    memory: {
      available: memoryAvailable,
      entries: history.length,
      snapshots: history.filter(item => item.kind === 'market_snapshot').length,
      recommendations: history.filter(item => item.kind === 'recommendation').length,
      latest: history.slice(0, 20),
      snapshotStored,
      recommendationStored,
      error: memoryError,
    },
    sources: {
      openSea: { ready: Boolean(apiKey), healthy: Boolean(contractResponse.ok || statsResponse.ok || salesResponse.ok), collectionSlug: slug || null, error: apiKey ? (contractResponse.error || statsResponse.error || '') : 'OPENSEA_API_KEY is not configured.' },
      coingecko: eth,
      baseRpc: gas,
    },
    automation: {
      monitoring: true,
      learningStorage: memoryAvailable,
      automaticSigningActive: false,
      automaticListingActive: false,
      automaticBuyingActive: false,
      automaticMintingActive: false,
      reason: 'Neural Core can observe, remember and recommend. Money-moving actions remain approval-gated until a bounded executor is separately implemented and verified.',
    },
    valuePolicy: {
      guarantee: false,
      principle: 'Value cannot be guaranteed. Neural Core measures real demand, liquidity, costs and market evidence and refuses to treat asking prices, self-trades or unsold inventory as realized value.',
    },
  };
}
