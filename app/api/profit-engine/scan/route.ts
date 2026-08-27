import { NextResponse } from 'next/server';
import { formatEther, parseUnits } from 'ethers';
import { normalizeAmountEth, scanBaseArbitrageGrid } from '../../../../lib/base-profit-engine';
import { scanBaseWideMarkets } from '../../../../lib/base-wide-scanner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MIN_INPUT = parseUnits('0.0005', 18);
const MAX_INPUT = parseUnits('10', 18);

function adaptiveAmounts(amountEth: unknown) {
  const normalized = normalizeAmountEth(amountEth || '0.01');
  const values = [
    normalized.inputWei / BigInt(4),
    normalized.inputWei / BigInt(2),
    normalized.inputWei,
    normalized.inputWei * BigInt(2),
  ].map(value => value < MIN_INPUT ? MIN_INPUT : value > MAX_INPUT ? MAX_INPUT : value);

  const unique = Array.from(new Set(values.map(value => value.toString())))
    .map(value => BigInt(value))
    .sort((a, b) => a < b ? -1 : a > b ? 1 : 0);

  return {
    requested: normalized.amount,
    amountsEth: unique.map(value => formatEther(value)),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sizes = adaptiveAmounts(body?.amountEth || '0.01');
    const targetBps = body?.targetBps;
    const slippageBps = body?.slippageBps;
    const preferFlashblocks = body?.preferFlashblocks !== false;

    const [gridResult, wideResult] = await Promise.allSettled([
      scanBaseArbitrageGrid({
        amountsEth: sizes.amountsEth,
        targetBps,
        slippageBps,
        preferFlashblocks,
      }),
      scanBaseWideMarkets({
        maxCapitalEth: sizes.requested,
        preferFlashblocks,
      }),
    ]);

    if (gridResult.status !== 'fulfilled') throw gridResult.reason;

    const grid = gridResult.value;
    const anchor = grid.scans.find(scan => scan.inputEth === sizes.requested) || grid.scans[0];
    if (!anchor) throw new Error('Adaptive execution scan returned no results.');

    const opportunities = grid.scans
      .flatMap(scan => scan.opportunities.map(opportunity => ({
        ...opportunity,
        id: `${opportunity.id}-${scan.inputWei}`,
        scanInputEth: scan.inputEth,
        scanStateMode: scan.stateMode,
        scanRpcSource: scan.rpcSource,
      })))
      .sort((a, b) => BigInt(a.netAfterGasWei) > BigInt(b.netAfterGasWei) ? -1 : BigInt(a.netAfterGasWei) < BigInt(b.netAfterGasWei) ? 1 : 0);

    const profitable = opportunities.filter(opportunity => opportunity.passes);
    const wideMarkets = wideResult.status === 'fulfilled' ? wideResult.value : null;
    const wideScanError = wideResult.status === 'rejected'
      ? (wideResult.reason instanceof Error ? wideResult.reason.message : String(wideResult.reason))
      : null;

    return NextResponse.json({
      ...anchor,
      scanMode: 'ADAPTIVE_WIDE_V3',
      requestedAmountsEth: sizes.amountsEth,
      executionSizesScanned: grid.scans.length,
      best: profitable[0] || null,
      bestQuoted: opportunities[0] || null,
      opportunities,
      wideMarkets,
      wideScanError,
      coverage: {
        executionPair: 'WETH/USDC',
        executionSizesEth: sizes.amountsEth,
        executionRoutesPerSize: 2,
        widePairsRequested: wideMarkets?.coverage?.pairsRequested || 0,
        widePairsQuoted: wideMarkets?.coverage?.pairsQuoted || 0,
        wideVenues: wideMarkets?.coverage?.venues || [],
        uniswapFeeTiers: wideMarkets?.coverage?.uniswapFeeTiers || [100, 500, 3000, 10000],
        aerodromePoolTypes: wideMarkets?.coverage?.aerodromePoolTypes || ['volatile', 'stable'],
        slipstreamTickSpacings: wideMarkets?.coverage?.slipstreamTickSpacings || [],
      },
      rule: 'NO_TRADE unless an executable WETH/USDC candidate clears conservative gas + target profit and then passes a fresh wallet static simulation. Wide-market signals are discovery-only until a separately reviewed executor supports them.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Profit Engine scan failed', error);
    const message = error instanceof Error ? error.message : 'Profit Engine scan failed.';
    const status = /valid ETH amount|between 0\.0005 and 10 ETH/i.test(message) ? 400 : 503;
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
