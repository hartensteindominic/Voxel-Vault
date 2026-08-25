import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRIVATE_KEY_RE = /^(0x)?[a-fA-F0-9]{64}$/;
const OPENSEA = 'https://api.opensea.io/api/v2';
const OPENSEA_TIMEOUT_MS = 8_000;

function bool(value: string | undefined) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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

function eventList(value: any) {
  if (!value || typeof value !== 'object') return [];
  for (const key of ['asset_events', 'assetEvents', 'events', 'results']) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
}

function address(value: any) {
  const candidate = typeof value === 'string' ? value : value?.address || value?.account_address || value?.wallet || '';
  return ADDRESS_RE.test(String(candidate)) ? String(candidate).toLowerCase() : '';
}

function nftContract(event: any) {
  return address(event?.nft?.contract || event?.nft?.contract_address || event?.asset?.contract || event?.asset?.contract_address || event?.contract);
}

function saleSeller(event: any) {
  return address(event?.seller || event?.from_account || event?.from_address || event?.maker);
}

function saleBuyer(event: any) {
  return address(event?.buyer || event?.to_account || event?.to_address || event?.taker);
}

function paymentEthEquivalent(event: any) {
  const payment = event?.payment || event?.payment_token || event?.price || null;
  if (!payment || typeof payment !== 'object') return null;
  const symbol = String(payment.symbol || payment.token_symbol || payment?.token?.symbol || '').toUpperCase();
  if (symbol !== 'ETH' && symbol !== 'WETH') return null;
  const raw = payment.quantity ?? payment.amount ?? payment.value;
  const decimals = Number(payment.decimals ?? payment?.token?.decimals ?? 18);
  if (raw == null || !Number.isFinite(decimals) || decimals < 0 || decimals > 30) return null;
  try {
    const quantity = BigInt(String(raw));
    const whole = Number(quantity) / Math.pow(10, decimals);
    return Number.isFinite(whole) && whole >= 0 ? whole : null;
  } catch {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = (url.searchParams.get('wallet') || '').trim();
  if (!ADDRESS_RE.test(wallet)) return NextResponse.json({ error: 'Connect the VoxelFlip wallet to inspect Factory mode.' }, { status: 400 });

  const deployment = await getVoxelFlipDeployment();
  const contract = deployment?.address || '';
  const apiKey = process.env.OPENSEA_API_KEY?.trim() || '';
  const rpcReady = Boolean((process.env.VOXELFLIP_RPC_URL || '').trim());
  const traderSignerReady = PRIVATE_KEY_RE.test((process.env.VOXELFLIP_TRADER_PRIVATE_KEY || '').trim());
  const executorReady = false;
  const factoryRequested = bool(process.env.VOXELFLIP_FACTORY_ENABLED);
  const killSwitch = bool(process.env.VOXELFLIP_AUTOPILOT_KILL_SWITCH) || bool(process.env.VOXELFLIP_FACTORY_KILL_SWITCH);

  const reinvestPercent = Math.min(40, positiveNumber(process.env.VOXELFLIP_FACTORY_REINVEST_PERCENT, 25));
  const reservePercent = 100 - reinvestPercent;
  const maxReinvestPerCycleEth = positiveNumber(process.env.VOXELFLIP_FACTORY_MAX_REINVEST_ETH, 0.01);
  const maxFactoryMintsPerDay = Math.max(1, Math.floor(positiveNumber(process.env.VOXELFLIP_FACTORY_MAX_MINTS_PER_DAY, 3)));
  const maxFactoryInventory = Math.max(1, Math.floor(positiveNumber(process.env.VOXELFLIP_FACTORY_MAX_INVENTORY, 5)));
  const minimumRealizedProfitEth = positiveNumber(process.env.VOXELFLIP_FACTORY_MIN_REALIZED_PROFIT_ETH, 0.003);

  let saleFeed: any = null;
  let verifiedSales = 0;
  let recognizedProceedsEth = 0;
  let proceedsCoverage = 0;
  if (apiKey && ADDRESS_RE.test(contract)) {
    const after = Math.floor(Date.now() / 1000) - 30 * 86_400;
    saleFeed = await openSeaGet(`/events/accounts/${wallet}?event_type=sale&chain=base&after=${after}&limit=200`, apiKey);
    if (saleFeed.ok) {
      const walletLower = wallet.toLowerCase();
      const contractLower = contract.toLowerCase();
      for (const event of eventList(saleFeed.data)) {
        const seller = saleSeller(event);
        const buyer = saleBuyer(event);
        if (!seller || seller !== walletLower || buyer === walletLower) continue;
        if (nftContract(event) !== contractLower) continue;
        verifiedSales += 1;
        const proceeds = paymentEthEquivalent(event);
        if (proceeds != null) {
          recognizedProceedsEth += proceeds;
          proceedsCoverage += 1;
        }
      }
    }
  }

  const profitLedgerReady = false;
  const generationFactoryReady = false;
  const automaticFactoryActive = false;
  const foundationReady = Boolean(apiKey && rpcReady && traderSignerReady && ADDRESS_RE.test(contract));

  return NextResponse.json({
    wallet,
    contract,
    chain: 'base',
    checkedAt: new Date().toISOString(),
    mode: automaticFactoryActive ? 'automatic' : 'approval-gated',
    factoryRequested,
    automaticFactoryActive,
    killSwitch,
    observed: {
      verifiedExternalSales30d: verifiedSales,
      recognizedSaleProceedsEth: Number(recognizedProceedsEth.toFixed(8)),
      proceedsParsedSales: proceedsCoverage,
      saleFeedHealthy: Boolean(saleFeed?.ok),
    },
    policy: {
      reinvestPercent,
      reservePercent,
      maxReinvestPerCycleEth,
      maxFactoryMintsPerDay,
      maxFactoryInventory,
      minimumRealizedProfitEth,
      requireSettledExternalSale: true,
      requireRealizedNetProfit: true,
      selfTradesCountAsProfit: false,
      unsoldInventoryCountsAsProfit: false,
      principalSpendingAllowed: false,
    },
    readiness: {
      openSea: Boolean(apiKey),
      productionRpc: rpcReady,
      separateTraderSigner: traderSignerReady,
      collection: ADDRESS_RE.test(contract),
      profitLedger: profitLedgerReady,
      generationFactory: generationFactoryReady,
      boundedExecutor: executorReady,
      foundation: foundationReady,
    },
    loop: [
      { key: 'sell', label: 'External sale settles', ready: Boolean(apiKey) },
      { key: 'profit', label: 'Verify net profit after costs', ready: profitLedgerReady },
      { key: 'reserve', label: `Reserve ${reservePercent}%`, ready: profitLedgerReady },
      { key: 'reinvest', label: `Reinvest up to ${reinvestPercent}%`, ready: profitLedgerReady && !killSwitch },
      { key: 'generate', label: 'Generate next voxel', ready: generationFactoryReady },
      { key: 'mint', label: 'Mint with bounded approval', ready: executorReady },
      { key: 'list', label: 'List with bounded approval', ready: executorReady },
      { key: 'repeat', label: 'Repeat only after another settled sale', ready: false },
    ],
    nextStep: profitLedgerReady
      ? 'Factory profit accounting is ready. Keep automatic execution disabled until generation and bounded mint/list approvals are installed.'
      : 'Install a real cost/profit ledger before reinvesting. Sale proceeds alone are not profit, so Factory will not spend them automatically yet.',
    notice: 'Factory never treats minting, self-trades, or unsold NFTs as profit. Automatic spending and signing remain OFF.',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
