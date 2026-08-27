import { Contract, JsonRpcProvider, formatEther, formatUnits, getAddress, parseUnits } from 'ethers';
import {
  AERODROME_FACTORY,
  AERODROME_ROUTER,
  BASE_CHAIN_ID,
  UNISWAP_QUOTER_V2,
  WETH,
} from './base-profit-engine';

const BASE_FLASHBLOCKS_RPC = 'https://mainnet-preconf.base.org';
const AERODROME_MIXED_QUOTER = getAddress('0x0A5aA5D3a4d28014f967Bf0f29EAA3FF9807D5c6');
const UNI_FEE_TIERS = [100, 500, 3000, 10000];
const SLIPSTREAM_TICK_SPACINGS = [1, 10, 50, 100, 200, 2000];
const ZERO = BigInt(0);
const BPS = BigInt(10000);
const MIN_SAMPLE = parseUnits('0.0005', 18);
const MAX_SAMPLE = parseUnits('0.01', 18);

const UNI_QUOTER_ABI = [
  'function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)',
];
const AERO_ROUTER_ABI = [
  'function getAmountsOut(uint256 amountIn,(address from,address to,bool stable,address factory)[] routes) view returns (uint256[] amounts)',
];
const SLIPSTREAM_QUOTER_ABI = [
  'function quoteExactInputSingleV3((address tokenIn,address tokenOut,uint256 amountIn,int24 tickSpacing,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)',
];

type StateTag = 'pending' | 'latest';
type VenueName = 'Uniswap V3' | 'Aerodrome' | 'Aerodrome Slipstream';
type Token = { symbol: string; address: string; decimals: number };
type VenueQuote = {
  venue: VenueName;
  amountOut: bigint;
  fee?: number;
  stable?: boolean;
  tickSpacing?: number;
};

type ProviderCandidate = {
  url: string;
  stateTag: StateTag;
  flashblocks: boolean;
};

const TOKENS: Token[] = [
  { symbol: 'USDC', address: getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'), decimals: 6 },
  { symbol: 'cbBTC', address: getAddress('0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf'), decimals: 8 },
  { symbol: 'cbETH', address: getAddress('0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22'), decimals: 18 },
  { symbol: 'AERO', address: getAddress('0x940181a94A35A4569E4529A3CDfB74e38FD98631'), decimals: 18 },
];

function rpcCandidates(preferFlashblocks: boolean): ProviderCandidate[] {
  const flashblocks = String(process.env.BASE_FLASHBLOCKS_RPC_URL || '').trim() || BASE_FLASHBLOCKS_RPC;
  const standard = [
    String(process.env.BASE_RPC_URL || '').trim(),
    String(process.env.VOXELFLIP_RPC_URL || '').trim(),
    'https://mainnet.base.org',
    'https://base-rpc.publicnode.com',
  ].filter(Boolean);
  const raw = [
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

async function quoteUni(
  provider: JsonRpcProvider,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  blockTag: StateTag,
): Promise<VenueQuote | null> {
  const quoter = new Contract(UNISWAP_QUOTER_V2, UNI_QUOTER_ABI, provider);
  const results = await Promise.all(UNI_FEE_TIERS.map(async fee => {
    try {
      const result = await withTimeout(
        quoter.getFunction('quoteExactInputSingle').staticCall(
          { tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0 },
          { blockTag },
        ),
        3_000,
        `Uniswap ${fee} quote`,
      );
      const amountOut = BigInt(result[0]);
      return amountOut > ZERO ? { venue: 'Uniswap V3' as const, amountOut, fee } : null;
    } catch {
      return null;
    }
  }));
  const viable = results.filter(Boolean) as VenueQuote[];
  return viable.sort((a, b) => a.amountOut > b.amountOut ? -1 : a.amountOut < b.amountOut ? 1 : 0)[0] || null;
}

async function quoteAero(
  provider: JsonRpcProvider,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  blockTag: StateTag,
): Promise<VenueQuote | null> {
  const router = new Contract(AERODROME_ROUTER, AERO_ROUTER_ABI, provider);
  const results = await Promise.all([false, true].map(async stable => {
    try {
      const routes = [{ from: tokenIn, to: tokenOut, stable, factory: AERODROME_FACTORY }];
      const amounts = await withTimeout(
        router.getFunction('getAmountsOut').staticCall(amountIn, routes, { blockTag }),
        3_000,
        `Aerodrome ${stable ? 'stable' : 'volatile'} quote`,
      );
      const amountOut = BigInt(amounts?.[amounts.length - 1] || 0);
      return amountOut > ZERO ? { venue: 'Aerodrome' as const, amountOut, stable } : null;
    } catch {
      return null;
    }
  }));
  const viable = results.filter(Boolean) as VenueQuote[];
  return viable.sort((a, b) => a.amountOut > b.amountOut ? -1 : a.amountOut < b.amountOut ? 1 : 0)[0] || null;
}

async function quoteSlipstream(
  provider: JsonRpcProvider,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  blockTag: StateTag,
): Promise<VenueQuote | null> {
  const quoter = new Contract(AERODROME_MIXED_QUOTER, SLIPSTREAM_QUOTER_ABI, provider);
  const results = await Promise.all(SLIPSTREAM_TICK_SPACINGS.map(async tickSpacing => {
    try {
      const result = await withTimeout(
        quoter.getFunction('quoteExactInputSingleV3').staticCall(
          { tokenIn, tokenOut, amountIn, tickSpacing, sqrtPriceLimitX96: 0 },
          { blockTag },
        ),
        3_000,
        `Slipstream ${tickSpacing} quote`,
      );
      const amountOut = BigInt(result[0]);
      return amountOut > ZERO ? { venue: 'Aerodrome Slipstream' as const, amountOut, tickSpacing } : null;
    } catch {
      return null;
    }
  }));
  const viable = results.filter(Boolean) as VenueQuote[];
  return viable.sort((a, b) => a.amountOut > b.amountOut ? -1 : a.amountOut < b.amountOut ? 1 : 0)[0] || null;
}

const VENUES = [
  { name: 'Uniswap V3' as const, quote: quoteUni },
  { name: 'Aerodrome' as const, quote: quoteAero },
  { name: 'Aerodrome Slipstream' as const, quote: quoteSlipstream },
];

function serializeVenueQuote(quote: VenueQuote, decimals: number) {
  return {
    venue: quote.venue,
    amountOut: quote.amountOut.toString(),
    amountOutFormatted: formatUnits(quote.amountOut, decimals),
    fee: quote.fee ?? null,
    stable: quote.stable ?? null,
    tickSpacing: quote.tickSpacing ?? null,
  };
}

async function scanPair(
  provider: JsonRpcProvider,
  token: Token,
  amountIn: bigint,
  blockTag: StateTag,
) {
  const firstLegs = await Promise.all(VENUES.map(async venue => ({
    venue,
    quote: await venue.quote(provider, WETH, token.address, amountIn, blockTag),
  })));

  const routes = [];
  for (const first of firstLegs) {
    if (!first.quote) continue;
    const secondVenues = VENUES.filter(venue => venue.name !== first.venue.name);
    const secondLegs = await Promise.all(secondVenues.map(async venue => ({
      venue,
      quote: await venue.quote(provider, token.address, WETH, first.quote!.amountOut, blockTag),
    })));
    for (const second of secondLegs) {
      if (!second.quote) continue;
      const finalOut = second.quote.amountOut;
      const grossSpread = finalOut - amountIn;
      const grossBps = Number((grossSpread * BPS) / amountIn);
      routes.push({
        id: `${token.symbol}-${first.venue.name}-${second.venue.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        pair: `WETH/${token.symbol}`,
        inputWei: amountIn.toString(),
        inputEth: formatEther(amountIn),
        first: serializeVenueQuote(first.quote, token.decimals),
        second: serializeVenueQuote(second.quote, 18),
        finalWei: finalOut.toString(),
        finalEth: formatEther(finalOut),
        grossSpreadWei: grossSpread.toString(),
        grossSpreadEth: formatEther(grossSpread),
        grossSpreadBps: grossBps,
        executionCompatibility: token.symbol === 'USDC' &&
          ((first.venue.name === 'Uniswap V3' && second.venue.name === 'Aerodrome') ||
           (first.venue.name === 'Aerodrome' && second.venue.name === 'Uniswap V3'))
          ? 'CURRENT_EXECUTOR'
          : 'WATCH_ONLY',
      });
    }
  }

  routes.sort((a, b) => BigInt(a.finalWei) > BigInt(b.finalWei) ? -1 : BigInt(a.finalWei) < BigInt(b.finalWei) ? 1 : 0);
  return {
    pair: `WETH/${token.symbol}`,
    quoteToken: token.symbol,
    sampleInputEth: formatEther(amountIn),
    routes: routes.slice(0, 4),
    bestRaw: routes[0] || null,
  };
}

export async function scanBaseWideMarkets(input: {
  maxCapitalEth?: unknown;
  preferFlashblocks?: boolean;
}) {
  const amountRaw = String(input.maxCapitalEth ?? '0.01').trim();
  if (!/^\d+(\.\d{1,18})?$/.test(amountRaw)) throw new Error('Enter a valid ETH amount.');
  const maxWei = parseUnits(amountRaw, 18);
  let sampleWei = maxWei / BigInt(2);
  if (sampleWei < MIN_SAMPLE) sampleWei = MIN_SAMPLE;
  if (sampleWei > MAX_SAMPLE) sampleWei = MAX_SAMPLE;

  const candidates = rpcCandidates(input.preferFlashblocks !== false);
  const errors: string[] = [];

  for (const candidate of candidates) {
    const provider = new JsonRpcProvider(candidate.url, BASE_CHAIN_ID, { staticNetwork: true });
    try {
      let observedBlock = '';
      if (candidate.flashblocks) {
        const pending = await withTimeout(
          provider.send('eth_getBlockByNumber', ['pending', false]),
          4_000,
          'Flashblocks wide-scan health check',
        );
        observedBlock = String((pending as { number?: string })?.number || 'pending');
      } else {
        observedBlock = String(await withTimeout(provider.getBlockNumber(), 3_500, 'Base wide-scan health check'));
      }

      const pairResults = await withTimeout(
        Promise.allSettled(TOKENS.map(token => scanPair(provider, token, sampleWei, candidate.stateTag))),
        18_000,
        'Wide Base market scan',
      );
      const pairs = pairResults
        .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof scanPair>>> => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(pair => pair.routes.length > 0);
      if (!pairs.length) throw new Error('No wide-market routes could be quoted.');

      const rawSignals = pairs.flatMap(pair => pair.routes)
        .sort((a, b) => BigInt(a.grossSpreadWei) > BigInt(b.grossSpreadWei) ? -1 : BigInt(a.grossSpreadWei) < BigInt(b.grossSpreadWei) ? 1 : 0);

      return {
        stateMode: candidate.flashblocks ? 'flashblocks-pending' : 'sealed-latest',
        stateTag: candidate.stateTag,
        stateObservedBlock: observedBlock,
        flashblocks: candidate.flashblocks,
        rpcSource: safeRpcLabel(candidate.url),
        sampleInputWei: sampleWei.toString(),
        sampleInputEth: formatEther(sampleWei),
        pairs,
        bestRawSignal: rawSignals[0] || null,
        coverage: {
          pairsRequested: TOKENS.length,
          pairsQuoted: pairs.length,
          venues: VENUES.map(venue => venue.name),
          uniswapFeeTiers: UNI_FEE_TIERS,
          aerodromePoolTypes: ['volatile', 'stable'],
          slipstreamTickSpacings: SLIPSTREAM_TICK_SPACINGS,
        },
        contracts: {
          aerodromeMixedQuoter: AERODROME_MIXED_QUOTER,
        },
        rule: 'WIDE_SCAN_IS_READ_ONLY. Raw cross-venue spread is not gas-adjusted and never authorizes a trade. Current execution remains limited to the separately simulated WETH/USDC Uniswap V3 <-> Aerodrome executor.',
      };
    } catch (error) {
      errors.push(`${safeRpcLabel(candidate.url)}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      provider.destroy();
    }
  }

  throw new Error(`Wide Base scan could not complete across ${candidates.length} RPCs. ${errors.at(-1) || ''}`);
}
