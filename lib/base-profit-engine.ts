import { Contract, JsonRpcProvider, formatEther, formatUnits, getAddress, isAddress, parseUnits } from 'ethers';

export const BASE_CHAIN_ID = 8453;
export const WETH = getAddress('0x4200000000000000000000000000000000000006');
export const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
export const UNISWAP_QUOTER_V2 = getAddress('0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a');
export const AERODROME_ROUTER = getAddress('0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43');
export const AERODROME_FACTORY = getAddress('0x420DD381b31aEf6683db6B902084cB0FFECe40Da');

const BASE_FLASHBLOCKS_RPC = 'https://mainnet-preconf.base.org';
const UNI_FEE_TIERS = [100, 500, 3000, 10000];
const ESTIMATED_EXECUTOR_GAS = 520000n;
const L1_DATA_FEE_BUFFER_WEI = 20_000_000_000_000n;
const MIN_INPUT = parseUnits('0.0005', 18);
const MAX_INPUT = parseUnits('10', 18);

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

export type SerializedOpportunity = ReturnType<typeof serializeOpportunity>;
export type BaseArbScan = Awaited<ReturnType<typeof scanBaseArbitrage>>;

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
  let best: Quote | null = null;
  for (const fee of UNI_FEE_TIERS) {
    try {
      const result = await withTimeout(
        quoter.getFunction('quoteExactInputSingle').staticCall(
          { tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0 },
          { blockTag },
        ),
        4_500,
        `Uniswap ${fee} ${blockTag} quote`,
      );
      const amountOut = BigInt(result[0]);
      if (amountOut > 0n && (!best || amountOut > best.amountOut)) {
        best = { venue: 'Uniswap V3', amountOut, fee, quoteGas: BigInt(result[3] || 0) };
      }
    } catch {
      // Missing fee tiers/pools are normal. Continue scanning the remaining tiers.
    }
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
  let best: Quote | null = null;
  for (const stable of [false, true]) {
    try {
      const route = [{ from: tokenIn, to: tokenOut, stable, factory: AERODROME_FACTORY }];
      const amounts = await withTimeout(
        router.getFunction('getAmountsOut').staticCall(amountIn, route, { blockTag }),
        4_500,
        `Aerodrome ${stable ? 'stable' : 'volatile'} ${blockTag} quote`,
      );
      const amountOut = BigInt(amounts?.[amounts.length - 1] || 0);
      if (amountOut > 0n && (!best || amountOut > best.amountOut)) {
        best = { venue: 'Aerodrome', amountOut, stable };
      }
    } catch {
      // A missing stable/volatile pool is not fatal.
    }
  }
  return best;
}

function applySlippage(amount: bigint, bps: number) {
  return (amount * BigInt(10_000 - bps)) / 10_000n;
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
  const passes = grossProfit >= requiredGross;
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
    gasBudgetWei: op.gasBudgetWei.toString(),
    gasBudgetEth: formatEther(op.gasBudgetWei),
    targetProfitWei: op.targetProfitWei.toString(),
    targetProfitEth: formatEther(op.targetProfitWei),
    netAfterGasWei: netAfterGas.toString(),
    netAfterGasEth: formatEther(netAfterGas),
    requiredGrossProfitWei: requiredGross.toString(),
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

async function scanOnProvider(
  provider: JsonRpcProvider,
  inputWei: bigint,
  targetBps: number,
  slippageBps: number,
  blockTag: StateTag,
) {
  const feeData = await withTimeout(provider.getFeeData(), 4_000, 'Base fee data');
  const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || parseUnits('0.02', 'gwei');
  const gasBudgetWei = gasPrice * ESTIMATED_EXECUTOR_GAS + L1_DATA_FEE_BUFFER_WEI;
  const targetProfitWei = (inputWei * BigInt(targetBps)) / 10_000n;
  const opportunities: Opportunity[] = [];

  const uniFirst = await quoteUni(provider, WETH, USDC, inputWei, blockTag);
  if (uniFirst) {
    const aeroSecond = await quoteAero(provider, USDC, WETH, uniFirst.amountOut, blockTag);
    if (aeroSecond) {
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
  }

  const aeroFirst = await quoteAero(provider, WETH, USDC, inputWei, blockTag);
  if (aeroFirst) {
    const uniSecond = await quoteUni(provider, USDC, WETH, aeroFirst.amountOut, blockTag);
    if (uniSecond) {
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
  }

  if (!opportunities.length) throw new Error('No complete WETH/USDC cross-DEX route could be quoted on this RPC.');
  opportunities.sort((a, b) => (a.finalOut > b.finalOut ? -1 : a.finalOut < b.finalOut ? 1 : 0));
  return { gasPrice, gasBudgetWei, targetProfitWei, opportunities };
}

export async function scanBaseArbitrage(input: {
  amountEth?: unknown;
  targetBps?: unknown;
  slippageBps?: unknown;
  preferFlashblocks?: boolean;
}) {
  const { inputWei } = normalizeAmountEth(input.amountEth || '0.01');
  const targetBps = normalizeBps(input.targetBps, 25, 1, 1000);
  const slippageBps = normalizeBps(input.slippageBps, 15, 1, 100);
  const preferFlashblocks = input.preferFlashblocks !== false;

  let scanned: Awaited<ReturnType<typeof scanOnProvider>> | null = null;
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

  const executorRaw = String(process.env.NEXT_PUBLIC_BASE_ARB_EXECUTOR_ADDRESS || process.env.BASE_ARB_EXECUTOR_ADDRESS || '').trim();
  const executorAddress = isAddress(executorRaw) ? getAddress(executorRaw) : '';
  const opportunities = scanned.opportunities.map(serializeOpportunity);
  const profitable = opportunities
    .filter(item => item.passes)
    .sort((a, b) => BigInt(a.netAfterGasWei) > BigInt(b.netAfterGasWei) ? -1 : BigInt(a.netAfterGasWei) < BigInt(b.netAfterGasWei) ? 1 : 0);

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
    bestQuoted: opportunities[0] || null,
    opportunities,
    scannedAt: new Date().toISOString(),
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

export async function scanBaseArbitrageGrid(input: {
  amountsEth: unknown[];
  targetBps?: unknown;
  slippageBps?: unknown;
  preferFlashblocks?: boolean;
}) {
  const unique = Array.from(new Set((input.amountsEth || []).map(value => normalizeAmountEth(value).amount))).slice(0, 4);
  if (!unique.length) throw new Error('Provide at least one ETH amount to optimize.');

  const scans = [];
  for (const amountEth of unique) {
    scans.push(await scanBaseArbitrage({
      amountEth,
      targetBps: input.targetBps,
      slippageBps: input.slippageBps,
      preferFlashblocks: input.preferFlashblocks,
    }));
  }

  const profitable = scans
    .flatMap(scan => scan.opportunities.map(opportunity => ({ ...opportunity, scanInputEth: scan.inputEth, stateMode: scan.stateMode, scannedAt: scan.scannedAt })))
    .filter(opportunity => opportunity.passes)
    .sort((a, b) => BigInt(a.netAfterGasWei) > BigInt(b.netAfterGasWei) ? -1 : BigInt(a.netAfterGasWei) < BigInt(b.netAfterGasWei) ? 1 : 0);

  return {
    chainId: BASE_CHAIN_ID,
    pair: 'WETH/USDC',
    requestedAmountsEth: unique,
    best: profitable[0] || null,
    scans,
    rule: 'Optimization chooses the highest positive net-after-gas candidate across the requested sizes; it does not execute or sign anything.',
  };
}
