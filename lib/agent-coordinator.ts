import { formatEther, keccak256, parseUnits, toUtf8Bytes } from 'ethers';
import { normalizeAmountEth, scanBaseArbitrage } from './base-profit-engine';

const DEFAULT_MAX_QUOTE_ETH = '0.05';
const DEFAULT_TICKET_LIFETIME_MS = 1_200;
const MIN_TICKET_LIFETIME_MS = 400;
const MAX_TICKET_LIFETIME_MS = 5_000;

export type AgentDecisionInput = {
  amountEth?: unknown;
  targetBps?: unknown;
  slippageBps?: unknown;
  requireFlashblocks?: boolean;
  ticketLifetimeMs?: unknown;
};

function configuredMaxQuoteWei() {
  const raw = String(process.env.AGENT_MAX_QUOTE_ETH || DEFAULT_MAX_QUOTE_ETH).trim();
  try {
    const value = parseUnits(raw, 18);
    return value > BigInt(0) ? value : parseUnits(DEFAULT_MAX_QUOTE_ETH, 18);
  } catch {
    return parseUnits(DEFAULT_MAX_QUOTE_ETH, 18);
  }
}

function ticketLifetimeMs(value: unknown) {
  const parsed = Number(value ?? DEFAULT_TICKET_LIFETIME_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_TICKET_LIFETIME_MS;
  return Math.min(MAX_TICKET_LIFETIME_MS, Math.max(MIN_TICKET_LIFETIME_MS, Math.round(parsed)));
}

function policyBlocked(reason: string, policy: Record<string, unknown>) {
  return {
    decision: 'POLICY_BLOCK' as const,
    reason,
    policy,
    ticket: null,
    scan: null,
  };
}

export async function coordinateBaseAgentDecision(input: AgentDecisionInput) {
  const { amount, inputWei } = normalizeAmountEth(input.amountEth || '0.01');
  const maxQuoteWei = configuredMaxQuoteWei();
  const requireFlashblocks = input.requireFlashblocks !== false;
  const lifetimeMs = ticketLifetimeMs(input.ticketLifetimeMs);
  const policy = {
    mode: 'READ_ONLY_COORDINATOR',
    maxQuoteWei: maxQuoteWei.toString(),
    maxQuoteEth: formatEther(maxQuoteWei),
    requireFlashblocks,
    ticketLifetimeMs: lifetimeMs,
    signsTransactions: false,
    submitsTransactions: false,
    authorizesSpending: false,
    requiresFreshWalletSimulation: true,
  };

  if (inputWei > maxQuoteWei) {
    return policyBlocked(`Requested ${amount} ETH exceeds the coordinator quote cap of ${formatEther(maxQuoteWei)} ETH.`, policy);
  }

  const scan = await scanBaseArbitrage({
    amountEth: amount,
    targetBps: input.targetBps,
    slippageBps: input.slippageBps,
    preferFlashblocks: true,
  });

  if (requireFlashblocks && !scan.flashblocks) {
    return {
      decision: 'POLICY_BLOCK' as const,
      reason: 'Flashblocks pending state was unavailable, so the autonomous candidate gate refused a sealed-state fallback.',
      policy,
      ticket: null,
      scan,
    };
  }

  if (!scan.best) {
    return {
      decision: 'NO_TRADE' as const,
      reason: 'No route cleared starting capital, conservative gas, and the requested net-profit floor.',
      policy,
      ticket: null,
      scan,
    };
  }

  const candidate = scan.best;
  const scannedAtMs = Date.parse(scan.scannedAt);
  const expiresAtMs = Number.isFinite(scannedAtMs) ? scannedAtMs + lifetimeMs : Date.now() + lifetimeMs;
  const ticketCore = {
    version: 1,
    chainId: scan.chainId,
    pair: scan.pair,
    stateMode: scan.stateMode,
    stateObservedBlock: scan.stateObservedBlock,
    scannedAt: scan.scannedAt,
    expiresAt: new Date(expiresAtMs).toISOString(),
    executorAddress: scan.executorAddress || '',
    method: candidate.method,
    inputWei: candidate.inputWei,
    targetProfitWei: candidate.targetProfitWei,
    gasBudgetWei: candidate.gasBudgetWei,
    quotedFinalWei: candidate.finalWei,
    quotedNetAfterGasWei: candidate.netAfterGasWei,
    uniFee: candidate.params.uniFee ?? null,
    aeroStable: candidate.params.aeroStable ?? null,
    minUsdcOut: candidate.params.minUsdcOut,
    minWethOut: candidate.params.minWethOut,
    minProfitWei: candidate.params.minProfitWei,
  };
  const ticketId = keccak256(toUtf8Bytes(JSON.stringify(ticketCore)));
  const ticket = {
    ...ticketCore,
    ticketId,
    authorization: false,
    signature: null,
    status: scan.executionEnabled ? 'SIMULATION_REQUIRED' : 'EXECUTOR_NOT_ACTIVE',
    instructions: 'Treat this as an expiring quote envelope only. Before any transaction, re-run the exact executor staticCall and wallet gas estimate against current Base state.',
  };

  return {
    decision: scan.executionEnabled ? 'EXECUTION_CANDIDATE' as const : 'EXECUTOR_NOT_ACTIVE' as const,
    reason: scan.executionEnabled
      ? 'The route cleared the quote gate and received a short-lived deterministic ticket. Fresh wallet simulation is still mandatory.'
      : 'The route cleared the quote gate, but live execution remains locked because no reviewed executor address is active.',
    policy,
    ticket,
    scan,
  };
}
