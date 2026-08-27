import { getSupabaseAdmin } from './supabase-admin';

export type VaultStoreJournalLine = {
  account: string;
  side: 'debit' | 'credit';
  amountCents: number;
};

type JournalInput = {
  sourceRef: string;
  eventType: 'sale_gross' | 'processing_fee' | 'refund';
  currency: string;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  lines: VaultStoreJournalLine[];
};

function normalizedCents(value: unknown) {
  const amount = Math.round(Number(value));
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Vault Store journal amount must be positive integer cents');
  return amount;
}

function normalizedSourceRef(value: string) {
  const sourceRef = String(value || '').trim().slice(0, 500);
  if (!sourceRef) throw new Error('Vault Store journal requires a stable source reference');
  return sourceRef;
}

export async function postVaultStoreJournal(input: JournalInput) {
  if (!Array.isArray(input.lines) || input.lines.length < 2) throw new Error('Vault Store journal requires at least two lines');
  const lines = input.lines.map(line => ({
    account: String(line.account || '').trim().slice(0, 80),
    side: line.side,
    amount_cents: normalizedCents(line.amountCents),
  }));
  if (lines.some(line => !line.account || !['debit', 'credit'].includes(line.side))) {
    throw new Error('Vault Store journal contains an invalid account or side');
  }

  const debit = lines.filter(line => line.side === 'debit').reduce((sum, line) => sum + line.amount_cents, 0);
  const credit = lines.filter(line => line.side === 'credit').reduce((sum, line) => sum + line.amount_cents, 0);
  if (debit !== credit) throw new Error('Vault Store journal is not balanced');

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('post_vault_store_journal', {
    p_source_ref: normalizedSourceRef(input.sourceRef),
    p_event_type: input.eventType,
    p_currency: String(input.currency || '').trim().toLowerCase(),
    p_checkout_session_id: input.checkoutSessionId || null,
    p_payment_intent_id: input.paymentIntentId || null,
    p_lines: lines,
  });
  if (error) throw new Error(`Vault Store journal unavailable: ${error.message}`);
  return data;
}

export async function recordVaultStorePaidSale(input: {
  checkoutSessionId: string;
  paymentIntentId?: string | null;
  currency: string;
  amountCents: number;
  processingFeeCents?: number | null;
}) {
  const amountCents = normalizedCents(input.amountCents);
  await postVaultStoreJournal({
    sourceRef: `stripe:sale:${input.checkoutSessionId}`,
    eventType: 'sale_gross',
    currency: input.currency,
    checkoutSessionId: input.checkoutSessionId,
    paymentIntentId: input.paymentIntentId,
    lines: [
      { account: 'stripe_clearing', side: 'debit', amountCents },
      { account: 'digital_product_revenue', side: 'credit', amountCents },
    ],
  });

  const fee = input.processingFeeCents == null ? null : Math.round(Number(input.processingFeeCents));
  if (fee != null && Number.isSafeInteger(fee) && fee > 0 && input.paymentIntentId) {
    await postVaultStoreJournal({
      sourceRef: `stripe:fee:${input.paymentIntentId}`,
      eventType: 'processing_fee',
      currency: input.currency,
      checkoutSessionId: input.checkoutSessionId,
      paymentIntentId: input.paymentIntentId,
      lines: [
        { account: 'payment_processing_expense', side: 'debit', amountCents: fee },
        { account: 'stripe_clearing', side: 'credit', amountCents: fee },
      ],
    });
  }
}

export async function recordVaultStoreRefund(input: {
  eventId: string;
  checkoutSessionId?: string | null;
  paymentIntentId: string;
  currency: string;
  amountCents: number;
}) {
  const amountCents = normalizedCents(input.amountCents);
  await postVaultStoreJournal({
    sourceRef: `stripe:refund:${input.eventId}`,
    eventType: 'refund',
    currency: input.currency,
    checkoutSessionId: input.checkoutSessionId,
    paymentIntentId: input.paymentIntentId,
    lines: [
      { account: 'sales_returns', side: 'debit', amountCents },
      { account: 'stripe_clearing', side: 'credit', amountCents },
    ],
  });
}
