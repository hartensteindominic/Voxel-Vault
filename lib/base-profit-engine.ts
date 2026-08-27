import { Contract, JsonRpcProvider, formatEther, formatUnits, getAddress, isAddress, parseUnits } from 'ethers';

export const BASE_CHAIN_ID = 8453;
export const WETH = getAddress('0x4200000000000000000000000000000000000006');
export const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
export const UNISWAP_QUOTER_V2 = getAddress('0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a');
export const AERODROME_ROUTER = getAddress('0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43');
export const AERODROME_FACTORY = getAddress('0x420DD381b31aEf6683db6B902084cB0FFECe40Da');

const BASE_FLASHBLOCKS_RPC = 'https://mainnet-preconf.base.org';
const UNI_FEE_TIERS = [100, 500, 3000, 10000];
const ESTIMATED_EXECUTOR_GAS = BigInt(520000);
const L1_DATA_FEE_BUFFER_WEI = BigInt('20000000000000');
const MIN_INPUT = parseUnits('0.0005', 18);
const MAX_INPUT = parseUnits('10', 18);
const BPS_DENOMINATOR = BigInt(10000);
const ZERO = BigInt(0);

const UNI_QUOTER_ABI = [
  'function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)',
];
const AERO_ROUTER_ABI = [
  'function getAmountsOut(uint256 amountIn,(address from,address to,bool stable,address factory)[] routes) view returns (uint256[] amounts)',
];

type StateTag = 'pending' | 'latest';
type Venue = 'Uniswap V3' | 'Aerodrome';
type Method = 'executeUniThenAero' | 'executeAeroThenUni';

type RpcCandidate = {
  url: string;
  stateTag: StateTag;
  flashblocks: boolean;
};

type Quote = {
  venue: Venue;
  amountOut: bigint;
  fee?: number;
  stable?: boolean;
  quoteGas?: bigint;
};

type Opportunity = {
  id: string;
  first: Quote;
  second: Quote;
  finalOut: bigint;
  input: bigint;
  gasBudgetWei: bigint;
  targetProfitWei: bigint;
  slippageBps: number;
  method: Method;
};

type ProviderScan = {
  gasPrice: bigint;
  gasBudgetWei: bigint;
  targetProfitWei: bigint;
  opportunities: Opportunity[];
};

export type SerializedOpportunity = ReturnType<typeof serializeOpportunity>;

export function normalizeBps(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function normalizeAmountEth(value: unknown, fallback = '0.01') {
  const amount = String(value ?? fallback).trim();
  if (!/^\d+(\.\d{1,18})?$/.test(amount)) throw new Error('Enter a valid ETH amount.');
  const inputWei = parseUnits(amount, 18);
  if (inputWei < MIN_INPUT || inputWei > MAX_INPUT) throw new Error('Scanner amount must be between 0.0005 and 10 ETH.');
  return { amount, inputWei };
}

function rpcCandidates(preferFlashblocks: boolean): RpcCandidate[] {
  const flashblocks = String(process.env.BASE_FLASHBLOCKS_RPC_URL || '').trim() || BASE_FLASHBLOCKS_RPC;
  const standard = [
    String(process.env.BASE_RPC_URL || '').trim(),
    String(process.env.VOXELFLIP_RPC_URL || '').trim(),
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org',
    'https://base.blockscout.com/api/eth-rpc',
    'https://base.llamarpc.com',
  ].filter(Boolean);

  const raw: RpcCandidate[] = [
    ...(preferFlashblocks ? [{ url: flashblocks, stateTag: 'pending' as const, flashblocks: true }] : []),
    ...standard.map(url => ({ url, stateTag: 'latest' as const, flashblocks: false })),
  ];

  const seen = new Set<string>();
  return raw.filter(candidate => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

function safeRpcLabel(value: string) {
  try {
    return new URL(value).hostname || 'Base RPC';
  } catch {
    return 'Base RPC';
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function stateHealth(provider: JsonRpcProvider, candidate: RpcCandidate) {
  if (candidate.flashblocks) {
    const pending = await withTimeout(
      provider.send('eth_getBlockByNumber', ['pending', false]),
      4_000,
      'Base Flashblocks pending-state health check',
    );
    if (!pending || typeof pending !== 'object') throw new Error('Flashblocks pending state unavailable');
    return String((pending as { number?: string }).number || 'pending');
  }
  const block = await withTimeout(provider.getBlockNumber(), 3_500, 'Base RPC health check');
  return String(block);
}

async function quoteUni(
  provider: JsonRpcProvider,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  blockTag: StateTag,
): Promise<Quote | null> {
  const quoter = new Contract(UNISWAP_QUOTER_V2, UNI_QUOTER_ABI, provider);
  const results = await Promise.all(UNI_FEE_TIERS.map(async fee => {
    try {
      const result = await withTimeout(
        quoter.getFunction('quoteExactInputSingle').staticCall(
          { tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0 },
          { blockTag },
        ),
        3_500,
        `Uniswap ${fee} ${blockTag} quote`,
      );
      const amountOut = BigInt(result[0]);
      return amountOut > ZERO
        ? { venue: 'Uniswap V3' as const, amountOut, fee, quoteGas: BigInt(result[3] || 0) }
        : null;
    } catch {
      return null;
    }
  }));

  let best: Quote | null = null;
  for (const result of results) {
    if (result && (!best || result.amountOut > best.amountOut)) best = result;
  }
  return best;
}

async function quoteAero(
  provider: JsonRpcProvider,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  blockTag: StateTag,
): Promise<Quote | null> {
  const router = new Contract(AERODROME_ROUTER, AERO_ROUTER_ABI, provider);
  const results = await Promise.all([false, true].map(async stable => {
    try {
      const route = [{ from: tokenIn, to: tokenOut, stable, factory: AERODROME_FACTORY }];
      const amounts = await withTimeout(
        router.getFunction('getAmountsOut').staticCall(amountIn, route, { blockTag }),
        3_500,
        `Aerodrome ${stable ? 'stable' : 'volatile'} ${blockTag} quote`,
      );
      const amountOut = BigInt(amounts?.[amounts.length - 1] || 0);
      return amountOut > ZERO ? { venue: 'Aerodrome' as const, amountOut, stable } : null;
    } catch {
      return null;
    }
  }));

  let best: Quote | null = null;
  for (const result of results) {
    if (result && (!best || result.amountOut > best.amountOut)) best = result;
  }
  return best;
}

function applySlippage(amount: bigint, bps: number) {
  return (amount * BigInt(10_000 - bps)) / BPS_DENOMINATOR;
}

function signedBps(value: bigint, input: bigint) {
  if (input === ZERO) return 0;
  return Number((value * BPS_DENOMINATOR) / input);
}

function serializeQuote(quote: Quote, outputDecimals: number) {
  return {
    venue: quote.venue,
    amountOut: quote.amountOut.toString(),
    amountOutFormatted: formatUnits(quote.amountOut, outputDecimals),
    fee: quote.fee ?? null,
    stable: quote.stable ?? null,
    quoteGas: quote.quoteGas?.toString() || null,
  };
}

function serializeOpportunity(op: Opportunity) {
  const grossProfit = op.finalOut - op.input;
  const netAfterGas = grossProfit - op.gasBudgetWei;
  const requiredGross = op.gasBudgetWei + op.targetProfitWei;
  const marginToProfitFloor = grossProfit - requiredGross;
  const distanceToProfitFloor = marginToProfitFloor < ZERO ? -marginToProfitFloor : ZERO;
  const passes = marginToProfitFloor >= ZERO;
  const minFirstOut = applySlippage(op.first.amountOut, op.slippageBps);
  const minFinalOut = applySlippage(op.finalOut, op.slippageBps);

  return {
    id: op.id,
    passes,
    verdict: passes ? 'PROFITABLE_QUOTE' : 'NO_TRADE',
    method: op.method,
    inputWei: op.input.toString(),
    inputEth: formatEther(op.input),
    first: serializeQuote(op.first, 6),
    second: serializeQuote(op.second, 18),
    finalWei: op.finalOut.toString(),
    finalEth: formatEther(op.finalOut),
    grossProfitWei: grossProfit.toString(),
    grossProfitEth: formatEther(grossProfit),
    grossProfitBps: signedBps(grossProfit, op.input),
    gasBudgetWei: op.gasBudgetWei.toString(),
    gasBudgetEth: formatEther(op.gasBudgetWei),
    targetProfitWei: op.targetProfitWei.toString(),
    targetProfitEth: formatEther(op.targetProfitWei),
    netAfterGasWei: netAfterGas.toString(),
    netAfterGasEth: formatEther(netAfterGas),
    netAfterGasBps: signedBps(netAfterGas, op.input),
    requiredGrossProfitWei: requiredGross.toString(),
    marginToProfitFloorWei: marginToProfitFloor.toString(),
    marginToProfitFloorBps: signedBps(marginToProfitFloor, op.input),
    distanceToProfitFloorWei: distanceToProfitFloor.toString(),
    distanceToProfitFloorEth: formatEther(distanceToProfitFloor),
    distanceToProfitFloorBps: Math.max(0, -signedBps(marginToProfitFloor, op.input)),
    minFirstOut: minFirstOut.toString(),
    minFinalOut: minFinalOut.toString(),
    minProfitWei: requiredGross.toString(),
    slippageBps: op.slippageBps,
    params: {
      uniFee: op.method === 'executeUniThenAero' ? op.first.fee : op.second.fee,
      aeroStable: op.method === 'executeUniThenAero' ? op.second.stable : op.first.stable,
      minUsdcOut: minFirstOut.toString(),
      minWethOut: minFinalOut.toString(),
      minProfitWei: requiredGross.toString(),
      deadlineSeconds: 90,
    },
  };
}

async function readGasPrice(provider: JsonRpcProvider) {
  const feeData = await withTimeout(provider.getFeeData(), 3_500, 'Base fee data');
  return feeData.maxFeePerGas || feeData.gasPrice || parseUnits('0.02', 'gwei');
}

async function scanOnProviderWithGas(
  provider: JsonRpcProvider,
  inputWei: bigint,
  targetBps: number,
  slippageBps: number,
  blockTag: StateTag,
  gasPrice: bigint,
): Promise<ProviderScan> {
  const gasBudgetWei = gasPrice * ESTIMATED_EXECUTOR_GAS + L1_DATA_FEE_BUFFER_WEI;
  const targetProfitWei = (inputWei * BigInt(targetBps)) / BPS_DENOMINATOR;
  const opportunities: Opportunity[] = [];

  const [uniFirst, aeroFirst] = await Promise.all([
    quoteUni(provider, WETH, USDC, inputWei, blockTag),
    quoteAero(provider, WETH, USDC, inputWei, blockTag),
  ]);

  const [aeroSecond, uniSecond] = await Promise.all([
    uniFirst ? quoteAero(provider, USDC, WETH, uniFirst.amountOut, blockTag) : Promise.resolve(null),
    aeroFirst ? quoteUni(provider, USDC, WETH, aeroFirst.amountOut, blockTag) : Promise.resolve(null),
  ]);

  if (uniFirst && aeroSecond) {
    opportunities.push({
      id: 'uniswap-to-aerodrome',
      first: uniFirst,
      second: aeroSecond,
      finalOut: aeroSecond.amountOut,
      input: inputWei,
      gasBudgetWei,
      targetProfitWei,
      slippageBps,
      method: 'executeUniThenAero',
    });
  }

  if (aeroFirst && uniSecond) {
    opportunities.push({
      id: 'aerodrome-to-uniswap',
      first: aeroFirst,
      second: uniSecond,
      finalOut: uniSecond.amountOut,
      input: inputWei,
      gasBudgetWei,
      targetProfitWei,
      slippageBps,
      method: 'executeAeroThenUni',
    });
  }

  if (!opportunities.length) throw new Error('No complete WETH/USDC cross-DEX route could be quoted on this RPC.');
  opportunities.sort((a, b) => (a.finalOut > b.finalOut ? -1 : a.finalOut < b.finalOut ? 1 : 0));
  return { gasPrice, gasBudgetWei, targetProfitWei, opportunities };
}

async function scanOnProvider(
  provider: JsonRpcProvider,
  inputWei: bigint,
  targetBps: number,
  slippageBps: number,
  blockTag: StateTag,
) {
  const gasPrice = await readGasPrice(provider);
  return scanOnProviderWithGas(provider, inputWei, targetBps, slippageBps, blockTag, gasPrice);
}

function configuredExecutorAddress() {
  const executorRaw = String(process.env.NEXT_PUBLIC_BASE_ARB_EXECUTOR_ADDRESS || process.env.BASE_ARB_EXECUTOR_ADDRESS || '').trim();
  return isAddress(executorRaw) ? getAddress(executorRaw) : '';
}

function serializeScan(
  inputWei: bigint,
  targetBps: number,
  slippageBps: number,
  scanned: ProviderScan,
  used: RpcCandidate,
  observedState: string,
  executorAddress: string,
  scanLatencyMs: number,
) {
  const opportunities = scanned.opportunities.map(serializeOpportunity);
  const profitable = opportunities
    .filter(item => item.passes)
    .sort((a, b) => BigInt(a.netAfterGasWei) > BigInt(b.netAfterGasWei) ? -1 : BigInt(a.netAfterGasWei) < BigInt(b.netAfterGasWei) ? 1 : 0);
  const ranked = [...opportunities]
    .sort((a, b) => BigInt(a.marginToProfitFloorWei) > BigInt(b.marginToProfitFloorWei) ? -1 : BigInt(a.marginToProfitFloorWei) < BigInt(b.marginToProfitFloorWei) ? 1 : 0);

  return {
    chainId: BASE_CHAIN_ID,
    pair: 'WETH/USDC',
    inputWei: inputWei.toString(),
    inputEth: formatEther(inputWei),
    targetBps,
    slippageBps,
    estimatedExecutorGasUnits: ESTIMATED_EXECUTOR_GAS.toString(),
    gasBudgetWei: scanned.gasBudgetWei.toString(),
    gasBudgetEth: formatEther(scanned.gasBudgetWei),
    targetProfitWei: scanned.targetProfitWei.toString(),
    targetProfitEth: formatEther(scanned.targetProfitWei),
    executorAddress,
    executionEnabled: Boolean(executorAddress),
    best: profitable[0] || null,
    bestQuoted: ranked[0] || null,
    opportunities,
    scannedAt: new Date().toISOString(),
    scanLatencyMs,
    rpcSource: safeRpcLabel(used.url),
    stateMode: used.flashblocks ? 'flashblocks-pending' : 'sealed-latest',
    stateTag: used.stateTag,
    stateObservedBlock: observedState,
    flashblocks: used.flashblocks,
    contracts: {
      weth: WETH,
      usdc: USDC,
      uniswapQuoterV2: UNISWAP_QUOTER_V2,
      aerodromeRouter: AERODROME_ROUTER,
      aerodromeFactory: AERODROME_FACTORY,
    },
    rule: 'NO_TRADE unless quoted final WETH covers starting ETH + conservative gas budget + target profit. Live execution must still pass a fresh atomic executor simulation.',
  };
}

export async function scanBaseArbitrage(input: {
  amountEth?: unknown;
  targetBps?: unknown;
  slippageBps?: unknown;
  preferFlashblocks?: boolean;
}) {
  const startedAt = Date.now();
  const { inputWei } = normalizeAmountEth(input.amountEth || '0.01');
  const targetBps = normalizeBps(input.targetBps, 25, 1, 1000);
  const slippageBps = normalizeBps(input.slippageBps, 15, 1, 100);
  const preferFlashblocks = input.preferFlashblocks !== false;

  let scanned: ProviderScan | null = null;
  let used: RpcCandidate | null = null;
  let observedState = '';
  const errors: string[] = [];

  const candidates = rpcCandidates(preferFlashblocks);
  for (const candidate of candidates) {
    const provider = new JsonRpcProvider(candidate.url, BASE_CHAIN_ID, { staticNetwork: true });
    try {
      observedState = await stateHealth(provider, candidate);
      scanned = await scanOnProvider(provider, inputWei, targetBps, slippageBps, candidate.stateTag);
      used = candidate;
      break;
    } catch (error) {
      errors.push(`${safeRpcLabel(candidate.url)}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      provider.destroy();
    }
  }

  if (!scanned || !used) {
    throw new Error(`Could not complete a live Base scan across ${candidates.length} RPCs. ${errors.at(-1) || ''}`);
  }

  return serializeScan(
    inputWei,
    targetBps,
    slippageBps,
    scanned,
    used,
    observedState,
    configuredExecutorAddress(),
    Date.now() - startedAt,
  );
}

export async function scanBaseArbitrageBatch(input: {
  amountsEth: unknown[];
  targetBps?: unknown;
  slippageBps?: unknown;
  preferFlashblocks?: boolean;
}) {
  const startedAt = Date.now();
  const normalized = Array.from(new Set((input.amountsEth || []).map(value => normalizeAmountEth(value).amount)))
    .slice(0, 6)
    .map(amount => normalizeAmountEth(amount));
  if (!normalized.length) throw new Error('Provide at least one ETH amount to optimize.');

  const targetBps = normalizeBps(input.targetBps, 25, 1, 1000);
  const slippageBps = normalizeBps(input.slippageBps, 15, 1, 100);
  const preferFlashblocks = input.preferFlashblocks !== false;
  const executorAddress = configuredExecutorAddress();
  const errors: string[] = [];
  const candidates = rpcCandidates(preferFlashblocks);

  for (const candidate of candidates) {
    const provider = new JsonRpcProvider(candidate.url, BASE_CHAIN_ID, { staticNetwork: true });
    try {
      const [observedState, gasPrice] = await Promise.all([
        stateHealth(provider, candidate),
        readGasPrice(provider),
      ]);
      const settled = await Promise.allSettled(normalized.map(item => scanOnProviderWithGas(
        provider,
        item.inputWei,
        targetBps,
        slippageBps,
        candidate.stateTag,
        gasPrice,
      )));

      const elapsed = Date.now() - startedAt;
      const scans = settled.flatMap((result, index) => {
        if (result.status !== 'fulfilled') return [];
        return [serializeScan(
          normalized[index].inputWei,
          targetBps,
          slippageBps,
          result.value,
          candidate,
          observedState,
          executorAddress,
          elapsed,
        )];
      });

      if (!scans.length) throw new Error('No executable capital size completed on this RPC.');
      const allOpportunities = scans.flatMap(scan => scan.opportunities.map(opportunity => ({
        ...opportunity,
        scanInputEth: scan.inputEth,
        stateMode: scan.stateMode,
        scannedAt: scan.scannedAt,
      })));
      const profitable = allOpportunities
        .filter(opportunity => opportunity.passes)
        .sort((a, b) => BigInt(a.marginToProfitFloorWei) > BigInt(b.marginToProfitFloorWei) ? -1 : BigInt(a.marginToProfitFloorWei) < BigInt(b.marginToProfitFloorWei) ? 1 : 0);
      const ranked = [...allOpportunities]
        .sort((a, b) => BigInt(a.marginToProfitFloorWei) > BigInt(b.marginToProfitFloorWei) ? -1 : BigInt(a.marginToProfitFloorWei) < BigInt(b.marginToProfitFloorWei) ? 1 : 0);

      return {
        chainId: BASE_CHAIN_ID,
        pair: 'WETH/USDC',
        requestedAmountsEth: normalized.map(item => item.amount),
        completedAmountsEth: scans.map(scan => scan.inputEth),
        best: profitable[0] || null,
        bestQuoted: ranked[0] || null,
        scans,
        partial: scans.length !== normalized.length,
        batchLatencyMs: elapsed,
        stateMode: candidate.flashblocks ? 'flashblocks-pending' : 'sealed-latest',
        stateObservedBlock: observedState,
        rpcSource: safeRpcLabel(candidate.url),
        flashblocks: candidate.flashblocks,
        rule: 'Batch optimization shares one Base state source and one gas read across up to six concurrent capital sizes. It never executes or signs anything.',
      };
    } catch (error) {
      errors.push(`${safeRpcLabel(candidate.url)}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      provider.destroy();
    }
  }

  throw new Error(`Could not complete a batch Base scan across ${candidates.length} RPCs. ${errors.at(-1) || ''}`);
}

export async function scanBaseArbitrageGrid(input: {
  amountsEth: unknown[];
  targetBps?: unknown;
  slippageBps?: unknown;
  preferFlashblocks?: boolean;
}) {
  const batch = await scanBaseArbitrageBatch(input);
  return {
    chainId: batch.chainId,
    pair: batch.pair,
    requestedAmountsEth: batch.requestedAmountsEth,
    best: batch.best,
    scans: batch.scans,
    rule: 'Optimization chooses the highest positive margin-to-profit-floor candidate across the requested sizes; it does not execute or sign anything.',
  };
}
