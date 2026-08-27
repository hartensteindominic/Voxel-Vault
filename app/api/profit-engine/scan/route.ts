import { NextResponse } from 'next/server';
import { formatEther, parseUnits } from 'ethers';
import { normalizeAmountEth } from '../../../../lib/base-profit-engine';
import { scanBaseArbitrageGridParallel } from '../../../../lib/base-fast-grid';
import { scanBaseWideMarkets } from '../../../../lib/base-wide-scanner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MIN_INPUT = parseUnits('0.0005', 18);
const MAX_INPUT = parseUnits('10', 18);

function adaptiveAmounts(amountEth: unknown) {
  const normalized = normalizeAmountEth(amountEth || '0.01');
  const values = [
    normalized.inputWei / BigInt(16),
    normalized.inputWei / BigInt(8),
    normalized.inputWei / BigInt(4),
    normalized.inputWei / BigInt(2),
    (normalized.inputWei * BigInt(3)) / BigInt(4),
    normalized.inputWei,
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
    const mode = body?.mode === 'fast' ? 'fast' : 'wide';

    const gridPromise = scanBaseArbitrageGridParallel({
      amountsEth: sizes.amountsEth,
      targetBps,
      slippageBps,
      preferFlashblocks,
    });

    const [gridResult, wideResult] = await Promise.allSettled([
      gridPromise,
      mode === 'wide'
        ? scanBaseWideMarkets({ maxCapitalEth: sizes.requested, preferFlashblocks })
        : Promise.resolve(null),
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
      .sort((a, b) => BigInt(a.marginToProfitFloorWei) > BigInt(b.marginToProfitFloorWei) ? -1 : BigInt(a.marginToProfitFloorWei) < BigInt(b.marginToProfitFloorWei) ? 1 : 0);

    const profitable = opportunities.filter(opportunity => opportunity.passes);
    const bestQuoted = opportunities[0] || null;
    const wideMarkets = mode === 'wide' && wideResult.status === 'fulfilled' ? wideResult.value : null;
    const wideScanError = mode === 'wide' && wideResult.status === 'rejected'
      ? (wideResult.reason instanceof Error ? wideResult.reason.message : String(wideResult.reason))
      : null;

    return NextResponse.json({
      ...anchor,
      scanMode: mode === 'fast' ? 'BOSS_FAST_V5' : 'BOSS_WIDE_V5',
      requestedMode: mode,
      maxCapitalEth: sizes.requested,
      requestedAmountsEth: sizes.amountsEth,
      executionSizesScanned: grid.scans.length,
      executionScanPartial: grid.partial,
      batchLatencyMs: grid.batchLatencyMs,
      best: profitable[0] || null,
      bestQuoted,
      nearMiss: profitable[0] ? null : bestQuoted,
      marketHeat: grid.marketHeat,
      suggestedCadenceMs: grid.suggestedCadenceMs,
      closestMarginBps: grid.closestMarginBps,
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
      rule: 'NO_TRADE unless an executable WETH/USDC candidate at or below the user capital cap clears conservative gas + target profit and then passes a fresh wallet static simulation. V5 speeds read-only scans near the profit floor but never auto-executes.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Profit Engine scan failed', error);
    const message = error instanceof Error ? error.message : 'Profit Engine scan failed.';
    const status = /valid ETH amount|between 0\.0005 and 10 ETH/i.test(message) ? 400 : 503;
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
