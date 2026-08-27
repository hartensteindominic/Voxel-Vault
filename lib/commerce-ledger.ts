export type JournalLeg = {
  accountCode: string;
  direction: 'debit' | 'credit';
  amountCents: number;
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

function normalizedLegs(legs: JournalLeg[]) {
  return legs.map(leg => ({
    accountCode: String(leg.accountCode || '').trim(),
    direction: leg.direction,
    amountCents: Math.trunc(Number(leg.amountCents)),
  }));
}

export function assertBalancedJournal(input: BalancedJournalInput) {
  if (!input.sourceType?.trim() || !input.sourceRef?.trim()) throw new Error('Journal source is required.');
  const legs = normalizedLegs(input.legs || []);
  if (legs.length < 2) throw new Error('A balanced journal needs at least two legs.');
  let debits = 0;
  let credits = 0;
  for (const leg of legs) {
    if (!leg.accountCode || !['debit', 'credit'].includes(leg.direction) || !Number.isSafeInteger(leg.amountCents) || leg.amountCents <= 0) {
      throw new Error('Invalid journal leg.');
    }
    if (leg.direction === 'debit') debits += leg.amountCents;
    else credits += leg.amountCents;
  }
  if (debits !== credits) throw new Error(`Journal is unbalanced: debits ${debits}, credits ${credits}.`);
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
    metadata: { sku: input.sku, buyerId: input.buyerId },
    legs: [
      { accountCode: 'stripe_receivable', direction: 'debit', amountCents: input.amountCents },
      { accountCode: 'digital_product_revenue', direction: 'credit', amountCents: input.amountCents },
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
    metadata: { sku: input.sku || null, buyerId: input.buyerId || null },
    legs: [
      { accountCode: 'sales_returns', direction: 'debit', amountCents: input.amountCents },
      { accountCode: 'stripe_receivable', direction: 'credit', amountCents: input.amountCents },
    ],
  });
}
