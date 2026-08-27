import { scanBaseArbitrage } from './base-profit-engine';

export async function scanBaseArbitrageGridParallel(input: {
  amountsEth: unknown[];
  targetBps?: unknown;
  slippageBps?: unknown;
  preferFlashblocks?: boolean;
}) {
  const raw = Array.isArray(input.amountsEth) ? input.amountsEth : [];
  const unique = Array.from(new Set(raw.map(value => String(value).trim()).filter(Boolean))).slice(0, 4);
  if (!unique.length) throw new Error('Provide at least one ETH amount to optimize.');

  const settled = await Promise.allSettled(unique.map(amountEth => scanBaseArbitrage({
    amountEth,
    targetBps: input.targetBps,
    slippageBps: input.slippageBps,
    preferFlashblocks: input.preferFlashblocks,
  })));

  const scans = settled
    .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof scanBaseArbitrage>>> => result.status === 'fulfilled')
    .map(result => result.value);

  if (!scans.length) {
    const lastFailure = settled.findLast(result => result.status === 'rejected');
    const reason = lastFailure?.status === 'rejected'
      ? (lastFailure.reason instanceof Error ? lastFailure.reason.message : String(lastFailure.reason))
      : 'No executable size completed.';
    throw new Error(`Parallel Base execution scan failed. ${reason}`);
  }

  const profitable = scans
    .flatMap(scan => scan.opportunities.map(opportunity => ({
      ...opportunity,
      scanInputEth: scan.inputEth,
      stateMode: scan.stateMode,
      scannedAt: scan.scannedAt,
    })))
    .filter(opportunity => opportunity.passes)
    .sort((a, b) => BigInt(a.netAfterGasWei) > BigInt(b.netAfterGasWei) ? -1 : BigInt(a.netAfterGasWei) < BigInt(b.netAfterGasWei) ? 1 : 0);

  return {
    chainId: scans[0].chainId,
    pair: 'WETH/USDC',
    requestedAmountsEth: unique,
    completedAmountsEth: scans.map(scan => scan.inputEth),
    best: profitable[0] || null,
    scans,
    partial: scans.length !== unique.length,
    rule: 'Parallel optimization scans up to four sizes concurrently and never executes or signs anything.',
  };
}
