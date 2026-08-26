import { Contract, JsonRpcProvider, formatEther, formatUnits, getAddress, isAddress, parseUnits } from 'ethers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BASE_CHAIN_ID = 8453;
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
const UNISWAP_QUOTER_V2 = getAddress('0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a');
const AERODROME_ROUTER = getAddress('0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43');
const AERODROME_FACTORY = getAddress('0x420DD381b31aEf6683db6B902084cB0FFECe40Da');
const UNI_FEE_TIERS = [100, 500, 3000, 10000];
const ESTIMATED_EXECUTOR_GAS = BigInt(520000);
const L1_DATA_FEE_BUFFER_WEI = BigInt('20000000000000'); // conservative extra Base/L1-data buffer

const UNI_QUOTER_ABI = [
  'function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)',
];
const AERO_ROUTER_ABI = [
  'function getAmountsOut(uint256 amountIn,(address from,address to,bool stable,address factory)[] routes) view returns (uint256[] amounts)',
];

type Quote = {
  venue: 'Uniswap V3' | 'Aerodrome';
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
  method: 'executeUniThenAero' | 'executeAeroThenUni';
};

function rpcCandidates() {
  return Array.from(new Set([
    String(process.env.BASE_RPC_URL || '').trim(),
    String(process.env.VOXELFLIP_RPC_URL || '').trim(),
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org',
    'https://base.blockscout.com/api/eth-rpc',
    'https://base.llamarpc.com',
  ].filter(Boolean)));
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

async function quoteUni(provider: JsonRpcProvider, tokenIn: string, tokenOut: string, amountIn: bigint): Promise<Quote | null> {
  const quoter = new Contract(UNISWAP_QUOTER_V2, UNI_QUOTER_ABI, provider);
  let best: Quote | null = null;
  for (const fee of UNI_FEE_TIERS) {
    try {
      const result = await withTimeout(
        quoter.getFunction('quoteExactInputSingle').staticCall({ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0 }),
        4_500,
        `Uniswap ${fee} quote`
      );
      const amountOut = BigInt(result[0]);
      if (amountOut > BigInt(0) && (!best || amountOut > best.amountOut)) {
        best = { venue: 'Uniswap V3', amountOut, fee, quoteGas: BigInt(result[3] || 0) };
      }
    } catch {
      // Missing fee tiers/pools are normal. Keep scanning the remaining tiers.
    }
  }
  return best;
}

async function quoteAero(provider: JsonRpcProvider, tokenIn: string, tokenOut: string, amountIn: bigint): Promise<Quote | null> {
  const router = new Contract(AERODROME_ROUTER, AERO_ROUTER_ABI, provider);
  let best: Quote | null = null;
  for (const stable of [false, true]) {
    try {
      const route = [{ from: tokenIn, to: tokenOut, stable, factory: AERODROME_FACTORY }];
      const amounts = await withTimeout(
        router.getFunction('getAmountsOut').staticCall(amountIn, route),
        4_500,
        `Aerodrome ${stable ? 'stable' : 'volatile'} quote`
      );
      const amountOut = BigInt(amounts?.[amounts.length - 1] || 0);
      if (amountOut > BigInt(0) && (!best || amountOut > best.amountOut)) {
        best = { venue: 'Aerodrome', amountOut, stable };
      }
    } catch {
      // A missing stable/volatile pool is not fatal.
    }
  }
  return best;
}

function applySlippage(amount: bigint, bps: number) {
  return (amount * BigInt(10_000 - bps)) / BigInt(10_000);
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
  const firstOutDecimals = 6;
  const minFirstOut = applySlippage(op.first.amountOut, op.slippageBps);
  const minFinalOut = applySlippage(op.finalOut, op.slippageBps);

  return {
    id: op.id,
    passes,
    verdict: passes ? 'PROFITABLE_QUOTE' : 'NO_TRADE',
    method: op.method,
    inputWei: op.input.toString(),
    inputEth: formatEther(op.input),
    first: serializeQuote(op.first, firstOutDecimals),
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

async function scanOnProvider(provider: JsonRpcProvider, inputWei: bigint, targetBps: number, slippageBps: number) {
  const feeData = await withTimeout(provider.getFeeData(), 4_000, 'Base fee data');
  const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || parseUnits('0.02', 'gwei');
  const gasBudgetWei = gasPrice * ESTIMATED_EXECUTOR_GAS + L1_DATA_FEE_BUFFER_WEI;
  const targetProfitWei = (inputWei * BigInt(targetBps)) / BigInt(10_000);
  const opportunities: Opportunity[] = [];

  const uniFirst = await quoteUni(provider, WETH, USDC, inputWei);
  if (uniFirst) {
    const aeroSecond = await quoteAero(provider, USDC, WETH, uniFirst.amountOut);
    if (aeroSecond) {
      opportunities.push({
        id: 'uniswap-to-aerodrome', first: uniFirst, second: aeroSecond, finalOut: aeroSecond.amountOut,
        input: inputWei, gasBudgetWei, targetProfitWei, slippageBps, method: 'executeUniThenAero',
      });
    }
  }

  const aeroFirst = await quoteAero(provider, WETH, USDC, inputWei);
  if (aeroFirst) {
    const uniSecond = await quoteUni(provider, USDC, WETH, aeroFirst.amountOut);
    if (uniSecond) {
      opportunities.push({
        id: 'aerodrome-to-uniswap', first: aeroFirst, second: uniSecond, finalOut: uniSecond.amountOut,
        input: inputWei, gasBudgetWei, targetProfitWei, slippageBps, method: 'executeAeroThenUni',
      });
    }
  }

  if (!opportunities.length) throw new Error('No complete WETH/USDC cross-DEX route could be quoted on this RPC.');
  opportunities.sort((a, b) => (a.finalOut > b.finalOut ? -1 : a.finalOut < b.finalOut ? 1 : 0));
  return { gasPrice, gasBudgetWei, targetProfitWei, opportunities };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const amount = String(body?.amountEth || '0.01').trim();
    const targetBps = Math.min(1000, Math.max(1, Number(body?.targetBps ?? 25)));
    const slippageBps = Math.min(100, Math.max(1, Number(body?.slippageBps ?? 15)));
    if (!/^\d+(\.\d{1,18})?$/.test(amount)) {
      return NextResponse.json({ error: 'Enter a valid ETH amount.' }, { status: 400 });
    }
    const inputWei = parseUnits(amount, 18);
    if (inputWei < parseUnits('0.0005', 18) || inputWei > parseUnits('10', 18)) {
      return NextResponse.json({ error: 'Scanner amount must be between 0.0005 and 10 ETH.' }, { status: 400 });
    }

    let result: Awaited<ReturnType<typeof scanOnProvider>> | null = null;
    let usedRpc = '';
    const errors: string[] = [];
    for (const rpc of rpcCandidates()) {
      const provider = new JsonRpcProvider(rpc, BASE_CHAIN_ID, { staticNetwork: true });
      try {
        await withTimeout(provider.getBlockNumber(), 3_500, 'Base RPC health check');
        result = await scanOnProvider(provider, inputWei, targetBps, slippageBps);
        usedRpc = rpc;
        break;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      } finally {
        provider.destroy();
      }
    }
    if (!result) {
      return NextResponse.json({ error: `Could not complete a live Base scan across ${rpcCandidates().length} RPCs. ${errors.at(-1) || ''}` }, { status: 503 });
    }

    const executorRaw = String(process.env.NEXT_PUBLIC_BASE_ARB_EXECUTOR_ADDRESS || process.env.BASE_ARB_EXECUTOR_ADDRESS || '').trim();
    const executorAddress = isAddress(executorRaw) ? getAddress(executorRaw) : '';
    const serialized = result.opportunities.map(serializeOpportunity);
    const profitable = serialized.filter(item => item.passes);

    return NextResponse.json({
      chainId: BASE_CHAIN_ID,
      pair: 'WETH/USDC',
      inputEth: formatEther(inputWei),
      targetBps,
      slippageBps,
      estimatedExecutorGasUnits: ESTIMATED_EXECUTOR_GAS.toString(),
      gasBudgetWei: result.gasBudgetWei.toString(),
      gasBudgetEth: formatEther(result.gasBudgetWei),
      targetProfitWei: result.targetProfitWei.toString(),
      targetProfitEth: formatEther(result.targetProfitWei),
      executorAddress,
      executionEnabled: Boolean(executorAddress),
      best: profitable[0] || null,
      opportunities: serialized,
      scannedAt: new Date().toISOString(),
      rpcSource: usedRpc.replace(/\?.*$/, ''),
      contracts: {
        weth: WETH,
        usdc: USDC,
        uniswapQuoterV2: UNISWAP_QUOTER_V2,
        aerodromeRouter: AERODROME_ROUTER,
        aerodromeFactory: AERODROME_FACTORY,
      },
      rule: 'NO_TRADE unless quoted final WETH covers starting ETH + conservative gas budget + target profit. Live execution must also pass an atomic contract profit floor.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Profit Engine scan failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Profit Engine scan failed.' }, { status: 500 });
  }
}
