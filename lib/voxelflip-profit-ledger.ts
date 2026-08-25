import { getSupabaseAdmin } from './supabase-admin';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;

type Direction = 'income' | 'cost';
type Settlement = 'pending' | 'estimated' | 'verified';
export type LedgerEntryType =
  | 'sale_gross'
  | 'sale_fee'
  | 'royalty_income'
  | 'mint_gas'
  | 'listing_gas'
  | 'generation_cost'
  | 'mesh_cost'
  | 'other_cost'
  | 'adjustment';

export type VoxelFlipLedgerEntry = {
  wallet: string;
  contractAddress?: string | null;
  tokenId?: string | null;
  sessionId?: string | null;
  entryType: LedgerEntryType;
  direction: Direction;
  amountEth?: number | string | null;
  amountUsdCents?: number | null;
  source: string;
  sourceRef: string;
  txHash?: string | null;
  settlementStatus?: Settlement;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

function normalizedAddress(value: string | null | undefined) {
  const next = String(value || '').trim();
  if (!ADDRESS_RE.test(next)) throw new Error('VoxelFlip ledger requires a valid wallet address.');
  return next.toLowerCase();
}

function nonnegativeNumber(value: unknown) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function recordVoxelFlipLedgerEntry(entry: VoxelFlipLedgerEntry) {
  const amountEth = nonnegativeNumber(entry.amountEth);
  const amountUsdCents = entry.amountUsdCents == null ? null : Math.max(0, Math.round(Number(entry.amountUsdCents)));
  if (amountEth == null && !Number.isFinite(amountUsdCents)) throw new Error('VoxelFlip ledger entry requires a valid amount.');
  const wallet = normalizedAddress(entry.wallet);
  const contractAddress = entry.contractAddress ? normalizedAddress(entry.contractAddress) : null;
  const txHash = entry.txHash ? String(entry.txHash).trim().toLowerCase() : null;
  if (txHash && !TX_RE.test(txHash)) throw new Error('VoxelFlip ledger transaction hash is invalid.');
  const sourceRef = String(entry.sourceRef || '').trim().slice(0, 500);
  if (!sourceRef) throw new Error('VoxelFlip ledger entry requires a stable source reference.');

  const supabase = getSupabaseAdmin();
  const row = {
    wallet,
    contract_address: contractAddress,
    token_id: entry.tokenId ? String(entry.tokenId).slice(0, 120) : null,
    session_id: entry.sessionId ? String(entry.sessionId).slice(0, 255) : null,
    entry_type: entry.entryType,
    direction: entry.direction,
    amount_eth: amountEth,
    amount_usd_cents: Number.isFinite(amountUsdCents) ? amountUsdCents : null,
    source: String(entry.source || '').trim().slice(0, 80) || 'unknown',
    source_ref: sourceRef,
    tx_hash: txHash,
    settlement_status: entry.settlementStatus || 'pending',
    occurred_at: entry.occurredAt || new Date().toISOString(),
    metadata: entry.metadata || {},
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('voxelflip_profit_ledger').upsert(row, { onConflict: 'source_ref', ignoreDuplicates: true });
  if (error) throw new Error(`VoxelFlip profit ledger is unavailable: ${error.message}`);
  return row;
}

export async function readVoxelFlipProfitSummary(walletValue: string) {
  const wallet = normalizedAddress(walletValue);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('voxelflip_profit_ledger')
    .select('wallet,contract_address,token_id,session_id,entry_type,direction,amount_eth,amount_usd_cents,source,source_ref,tx_hash,settlement_status,occurred_at')
    .eq('wallet', wallet)
    .order('occurred_at', { ascending: false })
    .limit(1000);
  if (error) throw new Error(`VoxelFlip profit ledger is unavailable: ${error.message}`);

  const rows = Array.isArray(data) ? data : [];
  const verified = rows.filter((row: any) => row.settlement_status === 'verified');
  let verifiedIncomeEth = 0;
  let verifiedCostEth = 0;
  let verifiedIncomeUsdCents = 0;
  let verifiedCostUsdCents = 0;
  const soldTokens = new Set<string>();
  const typesByToken = new Map<string, Set<string>>();

  for (const row of verified as any[]) {
    const eth = nonnegativeNumber(row.amount_eth) || 0;
    const usd = nonnegativeNumber(row.amount_usd_cents) || 0;
    if (row.direction === 'income') {
      verifiedIncomeEth += eth;
      verifiedIncomeUsdCents += usd;
    } else if (row.direction === 'cost') {
      verifiedCostEth += eth;
      verifiedCostUsdCents += usd;
    }
    const tokenId = String(row.token_id || '');
    if (tokenId) {
      if (!typesByToken.has(tokenId)) typesByToken.set(tokenId, new Set());
      typesByToken.get(tokenId)!.add(String(row.entry_type || ''));
      if (row.entry_type === 'sale_gross') soldTokens.add(tokenId);
    }
  }

  // A gross sale is not realized profit. For every sold token we require at minimum
  // its mint-chain cost and marketplace-sale fee before ETH net profit is complete.
  // Generation/mesh costs may be in USD, so cross-currency profit remains blocked
  // until those costs are either absent by design or converted by a future verified FX entry.
  const incompleteSoldTokens = Array.from(soldTokens).filter((tokenId) => {
    const types = typesByToken.get(tokenId) || new Set<string>();
    return !types.has('mint_gas') || !types.has('sale_fee');
  });
  const hasMixedCurrencyCosts = verifiedCostUsdCents > 0;
  const costCoverageComplete = soldTokens.size > 0 && incompleteSoldTokens.length === 0 && !hasMixedCurrencyCosts;
  const knownNetEth = verifiedIncomeEth - verifiedCostEth;
  const realizedProfitEth = costCoverageComplete ? Math.max(0, knownNetEth) : null;

  return {
    available: true,
    entries: rows.length,
    verifiedEntries: verified.length,
    soldTokens: soldTokens.size,
    incompleteSoldTokens,
    verifiedIncomeEth: Number(verifiedIncomeEth.toFixed(12)),
    verifiedCostEth: Number(verifiedCostEth.toFixed(12)),
    knownNetEth: Number(knownNetEth.toFixed(12)),
    verifiedIncomeUsdCents: Math.round(verifiedIncomeUsdCents),
    verifiedCostUsdCents: Math.round(verifiedCostUsdCents),
    costCoverageComplete,
    realizedProfitEth: realizedProfitEth == null ? null : Number(realizedProfitEth.toFixed(12)),
    latest: rows.slice(0, 20),
  };
}
