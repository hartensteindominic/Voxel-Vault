export type VoxelFlipAgentDecision = {
  agent: 'SCOUT' | 'PRICER' | 'RISK' | 'MAKER';
  state: 'observe' | 'suggest' | 'blocked';
  headline: string;
  reason: string;
  proposedAction: string;
  requiresApproval: boolean;
};

type FactoryAgentInput = {
  externalSales30d: number;
  grossProceedsEth: number;
  realizedProfitEth: number | null;
  costCoverageComplete: boolean;
  reinvestPercent: number;
  maxReinvestPerCycleEth: number;
  minimumRealizedProfitEth: number;
  maxInventory: number;
  killSwitch: boolean;
};

export function buildVoxelFlipFactoryAgents(input: FactoryAgentInput): VoxelFlipAgentDecision[] {
  const sales = Math.max(0, Number(input.externalSales30d || 0));
  const gross = Math.max(0, Number(input.grossProceedsEth || 0));
  const profit = input.realizedProfitEth == null ? null : Math.max(0, Number(input.realizedProfitEth || 0));
  const eligibleProfit = profit != null && input.costCoverageComplete && profit >= input.minimumRealizedProfitEth;
  const reinvestAllowance = eligibleProfit
    ? Math.min(input.maxReinvestPerCycleEth, profit * Math.max(0, input.reinvestPercent) / 100)
    : 0;

  return [
    {
      agent: 'SCOUT',
      state: sales > 0 ? 'suggest' : 'observe',
      headline: sales > 0 ? `${sales} external sale${sales === 1 ? '' : 's'} detected` : 'Waiting for real demand',
      reason: sales > 0
        ? `Observed external VoxelFlip sales with ${gross.toFixed(5)} ETH of recognized gross proceeds.`
        : 'No verified external sale is available to justify a compounding cycle.',
      proposedAction: sales > 0 ? 'Keep monitoring demand and feed settled sales into the ledger.' : 'Watch the market; do not manufacture activity.',
      requiresApproval: false,
    },
    {
      agent: 'PRICER',
      state: 'observe',
      headline: 'Price from live market data only',
      reason: 'Pricing should use Autopilot floor, listings, offers, and recent external sales. Factory does not invent a target price.',
      proposedAction: 'Draft a listing range only when live OpenSea market data is available.',
      requiresApproval: true,
    },
    {
      agent: 'RISK',
      state: input.killSwitch || !input.costCoverageComplete ? 'blocked' : 'suggest',
      headline: input.killSwitch ? 'Kill switch is on' : input.costCoverageComplete ? 'Ledger coverage complete' : 'Reinvestment blocked',
      reason: input.killSwitch
        ? 'Factory activity is stopped by the kill switch.'
        : input.costCoverageComplete
          ? 'Verified sale income and required ETH costs are present for the sold inventory.'
          : 'Gross sale proceeds are not profit. Required cost entries are still missing or mixed-currency costs are unresolved.',
      proposedAction: input.costCoverageComplete ? 'Allow an approval-gated reinvestment proposal.' : 'Complete cost accounting before proposing any spend.',
      requiresApproval: true,
    },
    {
      agent: 'MAKER',
      state: eligibleProfit && !input.killSwitch ? 'suggest' : 'blocked',
      headline: eligibleProfit ? `Next-candidate budget: up to ${reinvestAllowance.toFixed(5)} ETH` : 'Next voxel stays queued',
      reason: eligibleProfit
        ? `Only a capped ${input.reinvestPercent}% slice of verified realized profit may be considered; principal remains protected.`
        : 'The Maker cannot call generation, minting, or listing a profit event until realized profit passes the minimum threshold.',
      proposedAction: eligibleProfit ? 'Draft the next voxel concept for human approval; do not mint or list automatically.' : 'Wait for verified realized profit.',
      requiresApproval: true,
    },
  ];
}

export const VOXELFLIP_AGENT_EXECUTION_RULE =
  'Agents may observe, score, wait, and draft actions. Spending ETH, minting, listing, transferring, or signing always requires an approved bounded executor and remains disabled until separately verified.';
