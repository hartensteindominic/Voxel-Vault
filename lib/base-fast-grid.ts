import { scanBaseArbitrageBatch } from './base-profit-engine';

export async function scanBaseArbitrageGridParallel(input: {
  amountsEth: unknown[];
  targetBps?: unknown;
  slippageBps?: unknown;
  preferFlashblocks?: boolean;
}) {
  const batch = await scanBaseArbitrageBatch({
    amountsEth: input.amountsEth,
    targetBps: input.targetBps,
    slippageBps: input.slippageBps,
    preferFlashblocks: input.preferFlashblocks,
  });

  const allOpportunities = batch.scans
    .flatMap(scan => scan.opportunities.map(opportunity => ({
      ...opportunity,
      scanInputEth: scan.inputEth,
      stateMode: scan.stateMode,
      scannedAt: scan.scannedAt,
    })))
    .sort((a, b) => BigInt(a.marginToProfitFloorWei) > BigInt(b.marginToProfitFloorWei) ? -1 : BigInt(a.marginToProfitFloorWei) < BigInt(b.marginToProfitFloorWei) ? 1 : 0);

  const profitable = allOpportunities.filter(opportunity => opportunity.passes);
  const bestQuoted = allOpportunities[0] || null;
  const closestMarginBps = Number(bestQuoted?.marginToProfitFloorBps ?? -10000);
  const marketHeat = profitable.length > 0
    ? 'ACTIONABLE'
    : closestMarginBps >= -5
      ? 'HOT'
      : closestMarginBps >= -20
        ? 'WARM'
        : 'COLD';
  const suggestedCadenceMs = marketHeat === 'HOT'
    ? 4000
    : marketHeat === 'WARM'
      ? 7000
      : 12000;

  return {
    chainId: batch.chainId,
    pair: batch.pair,
    requestedAmountsEth: batch.requestedAmountsEth,
    completedAmountsEth: batch.completedAmountsEth,
    best: profitable[0] || null,
    bestQuoted,
    nearMiss: profitable[0] ? null : bestQuoted,
    marketHeat,
    suggestedCadenceMs,
    closestMarginBps,
    scans: batch.scans,
    partial: batch.partial,
    batchLatencyMs: batch.batchLatencyMs,
    stateMode: batch.stateMode,
    stateObservedBlock: batch.stateObservedBlock,
    rpcSource: batch.rpcSource,
    flashblocks: batch.flashblocks,
    rule: 'Boss scan ranks every executable quote by distance to the on-chain profit floor, speeds up read-only watching near an opportunity, and never executes or signs anything.',
  };
}
