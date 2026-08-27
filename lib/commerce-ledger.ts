export type JournalAmount = string | number | bigint;

export type JournalLeg = {
  accountCode: string;
  direction: 'debit' | 'credit';
  amountMinor: JournalAmount;
};

export type BalancedJournalInput = {
  sourceType: string;
  sourceRef: string;
  eventType: string;
  currency?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  legs: JournalLeg[];
};

function toPositiveInteger(value: JournalAmount) {
  let amount: bigint;
  try { amount = typeof value === 'bigint' ? value : BigInt(String(value)); }
  catch { throw new Error('Journal amount must be an integer minor-unit value.'); }
  if (amount <= 0n) throw new Error('Journal amount must be positive.');
  return amount;
}

function normalizedLegs(legs: JournalLeg[]) {
  return legs.map(leg => ({
    accountCode: String(leg.accountCode || '').trim(),
    direction: leg.direction,
    amountMinor: toPositiveInteger(leg.amountMinor).toString(),
  }));
}

export function assertBalancedJournal(input: BalancedJournalInput) {
  if (!input.sourceType?.trim() || !input.sourceRef?.trim()) throw new Error('Journal source is required.');
  const legs = normalizedLegs(input.legs || []);
  if (legs.length < 2) throw new Error('A balanced journal needs at least two legs.');
  let debits = 0n;
  let credits = 0n;
  for (const leg of legs) {
    if (!leg.accountCode || !['debit', 'credit'].includes(leg.direction)) throw new Error('Invalid journal leg.');
    const amount = BigInt(leg.amountMinor);
    if (leg.direction === 'debit') debits += amount;
    else credits += amount;
  }
  if (debits !== credits) throw new Error(`Journal is unbalanced: debits ${debits.toString()}, credits ${credits.toString()}.`);
  return legs;
}

export async function recordBalancedJournalEntry(supabaseAdmin: any, input: BalancedJournalInput) {
  const legs = assertBalancedJournal(input);
  const currency = String(input.currency || 'usd').toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) throw new Error('Journal currency must be a three-letter code.');

  const { data, error } = await supabaseAdmin.rpc('post_balanced_journal_entry', {
    p_source_type: input.sourceType,
    p_source_ref: input.sourceRef,
    p_event_type: input.eventType,
    p_currency: currency,
    p_description: input.description || '',
    p_metadata: input.metadata || {},
    p_legs: legs,
  });
  if (error) throw error;
  return String(data || '');
}

export async function recordVaultStoreSaleJournal(
  supabaseAdmin: any,
  input: { checkoutSessionId: string; amountCents: number; currency: string; sku: string; buyerId: string },
) {
  return recordBalancedJournalEntry(supabaseAdmin, {
    sourceType: 'stripe_checkout',
    sourceRef: input.checkoutSessionId,
    eventType: 'vault_store_sale',
    currency: input.currency,
    description: `VoxelVault Digital Foundry sale: ${input.sku}`,
    metadata: { sku: input.sku, buyerId: input.buyerId, unit: 'cents' },
    legs: [
      { accountCode: 'stripe_receivable', direction: 'debit', amountMinor: input.amountCents },
      { accountCode: 'digital_product_revenue', direction: 'credit', amountMinor: input.amountCents },
    ],
  });
}

export async function recordVaultStoreRefundJournal(
  supabaseAdmin: any,
  input: { paymentIntentId: string; amountCents: number; currency: string; sku?: string; buyerId?: string },
) {
  return recordBalancedJournalEntry(supabaseAdmin, {
    sourceType: 'stripe_refund',
    sourceRef: input.paymentIntentId,
    eventType: 'vault_store_refund',
    currency: input.currency,
    description: `VoxelVault Digital Foundry refund${input.sku ? `: ${input.sku}` : ''}`,
    metadata: { sku: input.sku || null, buyerId: input.buyerId || null, unit: 'cents' },
    legs: [
      { accountCode: 'sales_returns', direction: 'debit', amountMinor: input.amountCents },
      { accountCode: 'stripe_receivable', direction: 'credit', amountMinor: input.amountCents },
    ],
  });
}

export async function recordSpatialMintFeeJournal(
  supabaseAdmin: any,
  input: { txHash: string; feeWei: string | bigint; assetId: string; tokenId: string; wallet: string; chainId: number },
) {
  const feeWei = toPositiveInteger(input.feeWei);
  return recordBalancedJournalEntry(supabaseAdmin, {
    sourceType: 'spatial_nft_mint',
    sourceRef: input.txHash.toLowerCase(),
    eventType: 'spatial_mint_platform_fee',
    currency: 'eth',
    description: `Spatial NFT mint platform fee for token ${input.tokenId}`,
    metadata: { assetId: input.assetId, tokenId: input.tokenId, wallet: input.wallet.toLowerCase(), chainId: input.chainId, unit: 'wei' },
    legs: [
      { accountCode: 'treasury_eth', direction: 'debit', amountMinor: feeWei },
      { accountCode: 'mint_fee_revenue', direction: 'credit', amountMinor: feeWei },
    ],
  });
}
