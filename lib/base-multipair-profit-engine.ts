import { Contract, JsonRpcProvider, formatEther, formatUnits, getAddress, isAddress, parseUnits } from 'ethers';
import {
  AERODROME_FACTORY,
  AERODROME_ROUTER,
  BASE_CHAIN_ID,
  UNISWAP_QUOTER_V2,
  WETH,
  normalizeAmountEth,
  normalizeBps,
} from './base-profit-engine';

const BASE_FLASHBLOCKS_RPC = 'https://mainnet-preconf.base.org';
const UNI_FEE_TIERS = [100, 500, 3000, 10000];
const ESTIMATED_MULTI_EXECUTOR_GAS = BigInt(650000);
const L1_DATA_FEE_BUFFER_WEI = BigInt('25000000000000');
const BPS = BigInt(10000);
const ZERO = BigInt(0);
const MIN_INPUT = parseUnits('0.0005', 18);

const UNI_QUOTER_ABI = [
  'function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)',
];
const AERO_ROUTER_ABI = [
  'function getAmountsOut(uint256 amountIn,(address from,address to,bool stable,address factory)[] routes) view returns (uint256[] amounts)',
];

type StateTag = 'pending' | 'latest';
type Venue = 'Uniswap V3' | 'Aerodrome';
type Method = 'executeUniThenAero' | 'executeAeroThenUni';
type QuoteToken = {
  symbol: 'USDC' | 'cbBTC' | 'cbETH' | 'AERO';
  address: string;
  decimals: number;
};
type RpcCandidate = { url: string; stateTag: StateTag; flashblocks: boolean };
type Quote = { venue: Venue; amountOut: bigint; fee?: number; stable?: boolean };
type RawOpportunity = {
  pair: string;
  quoteToken: QuoteToken;
  inputWei: bigint;
  first: Quote;
  second: Quote;
  finalWei: bigint;
  gasBudgetWei: bigint;
  targetProfitWei: bigint;
  slippageBps: number;
  method: Method;
};

export const MULTI_QUOTE_TOKENS: QuoteToken[] = [
  { symbol: 'USDC', address: getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'), decimals: 6 },
  { symbol: 'cbBTC', address: getAddress('0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf'), decimals: 8 },
  { symbol: 'cbETH', address: getAddress('0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22'), decimals: 18 },
  { symbol: 'AERO', address: getAddress('0x940181a94A35A4569E4529A3CDfB74e38FD98631'), decimals: 18 },
];

function rpcCandidates(preferFlashblocks: boolean): RpcCandidate[] {
  const flashblocks = String(process.env.BASE_FLASHBLOCKS_RPC_URL || '').trim() || BASE_FLASHBLOCKS_RPC;
  const standard = [
    String(process.env.BASE_RPC_URL || '').trim(),
    String(process.env.VOXELFLIP_RPC_URL || '').trim(),
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org',
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
  try { return new URL(value).hostname || 'Base RPC'; } catch { return 'Base RPC'; }
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
      'Flashblocks multi-pair health check',
    );
    if (!pending || typeof pending !== 'object') throw new Error('Flashblocks pending state unavailable');
    return String((pending as { number?: string }).number || 'pending');
  }
  return String(await withTimeout(provider.getBlockNumber(), 3_500, 'Base multi-pair health check'));
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
        `Uniswap multi-pair ${fee}`,
      );
      const amountOut = BigInt(result[0]);
      return amountOut > ZERO ? { venue: 'Uniswap V3' as const, amountOut, fee } : null;
    } catch { return null; }
  }));
  let best: Quote | null = null;
  for (const result of results) if (result && (!best || result.amountOut > best.amountOut)) best = result;
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
      const routes = [{ from: tokenIn, to: tokenOut, stable, factory: AERODROME_FACTORY }];
      const amounts = await withTimeout(
        router.getFunction('getAmountsOut').staticCall(amountIn, routes, { blockTag }),
        3_500,
        `Aerodrome multi-pair ${stable ? 'stable' : 'volatile'}`,
      );
      const amountOut = BigInt(amounts?.[amounts.length - 1] || 0);
      return amountOut > ZERO ? { venue: 'Aerodrome' as const, amountOut, stable } : null;
    } catch { return null; }
  }));
  let best: Quote | null = null;
  for (const result of results) if (result && (!best || result.amountOut > best.amountOut)) best = result;
  return best;
}

function minOut(value: bigint, slippageBps: number) {
  return (value * (BPS - BigInt(slippageBps))) / BPS;
}

function serializeQuote(quote: Quote, decimals: number) {
  return {
    venue: quote.venue,
    amountOut: quote.amountOut.toString(),
    amountOutFormatted: formatUnits(quote.amountOut, decimals),
    fee: quote.fee ?? null,
    stable: quote.stable ?? null,
  };
}

function serializeOpportunity(op: RawOpportunity) {
  const requiredGross = op.gasBudgetWei + op.targetProfitWei;
  const grossProfit = op.finalWei - op.inputWei;
  const netAfterGas = grossProfit - op.gasBudgetWei;
  const margin = grossProfit - requiredGross;
  const grossBps = Number((grossProfit * BPS) / op.inputWei);
  const netBps = Number((netAfterGas * BPS) / op.inputWei);
  const marginBps = Number((margin * BPS) / op.inputWei);
  const distanceWei = margin >= ZERO ? ZERO : -margin;
  const distanceBps = margin >= ZERO ? 0 : Number((distanceWei * BPS) / op.inputWei);
  const firstMin = minOut(op.first.amountOut, op.slippageBps);
  const finalMin = minOut(op.finalWei, op.slippageBps);

  const uniFee = op.method === 'executeUniThenAero' ? op.first.fee : op.second.fee;
  const aeroStable = op.method === 'executeUniThenAero' ? op.second.stable : op.first.stable;

  return {
    id: `${op.quoteToken.symbol}-${op.method}-${op.inputWei}`,
    pair: op.pair,
    quoteSymbol: op.quoteToken.symbol,
    quoteToken: op.quoteToken.address,
    quoteDecimals: op.quoteToken.decimals,
    inputWei: op.inputWei.toString(),
    inputEth: formatEther(op.inputWei),
    first: serializeQuote(op.first, op.quoteToken.decimals),
    second: serializeQuote(op.second, 18),
    finalWei: op.finalWei.toString(),
    finalEth: formatEther(op.finalWei),
    grossProfitWei: grossProfit.toString(),
    grossProfitEth: formatEther(grossProfit),
    grossProfitBps: grossBps,
    gasBudgetWei: op.gasBudgetWei.toString(),
    gasBudgetEth: formatEther(op.gasBudgetWei),
    targetProfitWei: op.targetProfitWei.toString(),
    targetProfitEth: formatEther(op.targetProfitWei),
    netAfterGasWei: netAfterGas.toString(),
    netAfterGasEth: formatEther(netAfterGas),
    netAfterGasBps: netBps,
    marginToProfitFloorWei: margin.toString(),
    marginToProfitFloorBps: marginBps,
    distanceToProfitFloorWei: distanceWei.toString(),
    distanceToProfitFloorBps: distanceBps,
    passes: margin >= ZERO,
    method: op.method,
    slippageBps: op.slippageBps,
    params: {
      quoteToken: op.quoteToken.address,
      uniFee: Number(uniFee || 0),
      aeroStable: Boolean(aeroStable),
      minQuoteOut: firstMin.toString(),
      minWethOut: finalMin.toString(),
      minProfitWei: requiredGross.toString(),
      deadlineSeconds: 75,
    },
  };
}

async function scanTokenSize(
  provider: JsonRpcProvider,
  token: QuoteToken,
  inputWei: bigint,
  gasBudgetWei: bigint,
  targetProfitWei: bigint,
  slippageBps: number,
  blockTag: StateTag,
) {
  const [uniFirst, aeroFirst] = await Promise.all([
    quoteUni(provider, WETH, token.address, inputWei, blockTag),
    quoteAero(provider, WETH, token.address, inputWei, blockTag),
  ]);

  const opportunities: RawOpportunity[] = [];
  const pair = `WETH/${token.symbol}`;
  const [aeroSecond, uniSecond] = await Promise.all([
    uniFirst ? quoteAero(provider, token.address, WETH, uniFirst.amountOut, blockTag) : Promise.resolve(null),
    aeroFirst ? quoteUni(provider, token.address, WETH, aeroFirst.amountOut, blockTag) : Promise.resolve(null),
  ]);

  if (uniFirst && aeroSecond) {
    opportunities.push({
      pair,
      quoteToken: token,
      inputWei,
      first: uniFirst,
      second: aeroSecond,
      finalWei: aeroSecond.amountOut,
      gasBudgetWei,
      targetProfitWei,
      slippageBps,
      method: 'executeUniThenAero',
    });
  }
  if (aeroFirst && uniSecond) {
    opportunities.push({
      pair,
      quoteToken: token,
      inputWei,
      first: aeroFirst,
      second: uniSecond,
      finalWei: uniSecond.amountOut,
      gasBudgetWei,
      targetProfitWei,
      slippageBps,
      method: 'executeAeroThenUni',
    });
  }
  return opportunities;
}

function adaptiveSizes(maxCapitalEth: unknown) {
  const normalized = normalizeAmountEth(maxCapitalEth || '0.01');
  const values = [
    normalized.inputWei / BigInt(4),
    normalized.inputWei / BigInt(2),
    normalized.inputWei,
  ].map(value => value < MIN_INPUT ? MIN_INPUT : value);
  const unique = Array.from(new Set(values.map(value => value.toString())))
    .map(value => BigInt(value))
    .sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  return { maxCapitalEth: normalized.amount, sizes: unique };
}

export async function scanBaseMultiPairArbitrage(input: {
  maxCapitalEth?: unknown;
  targetBps?: unknown;
  slippageBps?: unknown;
  preferFlashblocks?: boolean;
}) {
  const normalized = adaptiveSizes(input.maxCapitalEth || '0.01');
  const targetBps = normalizeBps(input.targetBps, 5, 1, 1000);
  const slippageBps = normalizeBps(input.slippageBps, 15, 1, 100);
  const preferFlashblocks = input.preferFlashblocks !== false;
  const errors: string[] = [];

  for (const candidate of rpcCandidates(preferFlashblocks)) {
    const provider = new JsonRpcProvider(candidate.url, BASE_CHAIN_ID, { staticNetwork: true });
    const started = Date.now();
    try {
      const [observedState, feeData] = await Promise.all([
        stateHealth(provider, candidate),
        withTimeout(provider.getFeeData(), 4_000, 'Base multi-pair fee data'),
      ]);
      const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || parseUnits('0.02', 'gwei');
      const gasBudgetWei = gasPrice * ESTIMATED_MULTI_EXECUTOR_GAS + L1_DATA_FEE_BUFFER_WEI;

      const jobs = MULTI_QUOTE_TOKENS.flatMap(token => normalized.sizes.map(async inputWei => {
        const targetProfitWei = (inputWei * BigInt(targetBps)) / BPS;
        return scanTokenSize(
          provider,
          token,
          inputWei,
          gasBudgetWei,
          targetProfitWei,
          slippageBps,
          candidate.stateTag,
        );
      }));

      const results = await withTimeout(
        Promise.allSettled(jobs),
        24_000,
        'Base multi-pair opportunity grid',
      );
      const serialized = results
        .filter((result): result is PromiseFulfilledResult<RawOpportunity[]> => result.status === 'fulfilled')
        .flatMap(result => result.value)
        .map(serializeOpportunity)
        .sort((a, b) => BigInt(a.marginToProfitFloorWei) > BigInt(b.marginToProfitFloorWei) ? -1 : BigInt(a.marginToProfitFloorWei) < BigInt(b.marginToProfitFloorWei) ? 1 : 0);

      if (!serialized.length) throw new Error('No multi-pair executable routes could be quoted.');
      const profitable = serialized.filter(item => item.passes);
      const closest = serialized[0] || null;
      const closestDistance = Number(closest?.distanceToProfitFloorBps || 0);
      const marketHeat = profitable.length ? 'ACTIONABLE' : closestDistance <= 5 ? 'HOT' : closestDistance <= 25 ? 'WARM' : 'COLD';
      const suggestedCadenceMs = marketHeat === 'ACTIONABLE' ? 4_000 : marketHeat === 'HOT' ? 4_000 : marketHeat === 'WARM' ? 7_000 : 12_000;

      const executorRaw = String(process.env.NEXT_PUBLIC_BASE_MULTI_ARB_EXECUTOR_ADDRESS || process.env.BASE_MULTI_ARB_EXECUTOR_ADDRESS || '').trim();
      const executorAddress = isAddress(executorRaw) ? getAddress(executorRaw) : '';

      return {
        chainId: BASE_CHAIN_ID,
        scanMode: 'MULTI_PAIR_V6',
        maxCapitalEth: normalized.maxCapitalEth,
        requestedAmountsEth: normalized.sizes.map(formatEther),
        quoteTokens: MULTI_QUOTE_TOKENS.map(token => ({ ...token })),
        pairsScanned: MULTI_QUOTE_TOKENS.length,
        sizesPerPair: normalized.sizes.length,
        routeDirectionsPerPair: 2,
        routesQuoted: serialized.length,
        targetBps,
        slippageBps,
        estimatedExecutorGasUnits: ESTIMATED_MULTI_EXECUTOR_GAS.toString(),
        gasBudgetWei: gasBudgetWei.toString(),
        gasBudgetEth: formatEther(gasBudgetWei),
        best: profitable[0] || null,
        bestQuoted: closest,
        opportunities: serialized,
        marketHeat,
        suggestedCadenceMs,
        batchLatencyMs: Date.now() - started,
        executorAddress,
        executionEnabled: Boolean(executorAddress),
        rpcSource: safeRpcLabel(candidate.url),
        stateMode: candidate.flashblocks ? 'flashblocks-pending' : 'sealed-latest',
        stateTag: candidate.stateTag,
        stateObservedBlock: observedState,
        flashblocks: candidate.flashblocks,
        scannedAt: new Date().toISOString(),
        rule: 'MULTI_PAIR_NO_TRADE unless a fixed-allowlist WETH round trip clears conservative gas + target profit. Execution still requires live contract verification, fresh static simulation, fresh gas estimate, and owner-wallet approval.',
      };
    } catch (error) {
      errors.push(`${safeRpcLabel(candidate.url)}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      provider.destroy();
    }
  }

  throw new Error(`Could not complete the V6 multi-pair Base scan. ${errors.at(-1) || ''}`);
}
