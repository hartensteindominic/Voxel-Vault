import { getSupabaseAdminCandidates } from '../supabase-admin';
import { getIncreaseSandboxDashboardForAccount, increaseSandboxRequest } from './increase-sandbox.js';

type IncreaseEvent = {
  id?: string;
  type?: string;
  category?: string;
  associated_object_type?: string | null;
  associated_object_id?: string | null;
  created_at?: string | null;
};

type EventSource = 'webhook' | 'poll';

function listData(payload: any): IncreaseEvent[] {
  return Array.isArray(payload?.data) ? payload.data : [];
}

function safeText(value: unknown, max = 200) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function safeError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error && Number.isFinite(Number((error as any).status))) {
    return `provider_status_${Number((error as any).status)}`;
  }
  return error instanceof Error ? safeText(error.message, 160) : 'reconciliation_failed';
}

function safeStorageIssue(error: any) {
  const code = safeText(error?.code, 40);
  if (code) return code;
  const status = Number(error?.status);
  if (Number.isFinite(status)) return `status_${status}`;
  return 'storage_unavailable';
}

function safeEventPollingIssue(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error && Number.isFinite(Number((error as any).status))) {
    return `provider_status_${Number((error as any).status)}`;
  }
  return 'events_unavailable';
}

function dollarsToCents(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function requireOwnerAccountId(value: unknown) {
  const accountId = safeText(value, 200);
  if (!accountId) throw new Error('Owner-scoped Increase sandbox Account is required for reconciliation.');
  return accountId;
}

async function withSupabaseAdmin(
  operation: (client: any) => Promise<any>,
  accept: (result: any) => boolean = (result) => !result?.error,
) {
  let lastError: any = null;
  const candidates = getSupabaseAdminCandidates();

  for (const client of candidates) {
    try {
      const result = await operation(client);
      if (accept(result)) return result;
      lastError = result?.error || lastError;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Supabase reconciliation storage is unavailable.');
}

function validateEvent(event: IncreaseEvent) {
  const eventId = safeText(event?.id, 200);
  const category = safeText(event?.category, 160);
  if (!eventId || !category || event?.type !== 'event') throw new Error('Increase webhook event is invalid.');
  return {
    eventId,
    category,
    associatedObjectType: safeText(event?.associated_object_type, 120) || null,
    associatedObjectId: safeText(event?.associated_object_id, 200) || null,
    providerCreatedAt: event?.created_at ? new Date(event.created_at).toISOString() : null,
  };
}

async function updateReconciliationState(values: Record<string, unknown>) {
  await withSupabaseAdmin((supabase) => supabase.from('galactic_increase_reconciliation_state').upsert({
    environment: 'sandbox',
    ...values,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'environment' }));
}

export async function recordIncreaseSandboxEvent(event: IncreaseEvent, options: {
  source: EventSource;
  webhookMessageId?: string | null;
  payloadSha256?: string | null;
}): Promise<{ duplicate: boolean; eventId: string }> {
  const normalized = validateEvent(event);
  const now = new Date().toISOString();
  const result = await withSupabaseAdmin(
    (supabase) => supabase.from('galactic_increase_webhook_events').insert({
      event_id: normalized.eventId,
      category: normalized.category,
      associated_object_type: normalized.associatedObjectType,
      associated_object_id: normalized.associatedObjectId,
      source: options.source,
      webhook_message_id: safeText(options.webhookMessageId, 200) || null,
      payload_sha256: safeText(options.payloadSha256, 64) || null,
      provider_created_at: normalized.providerCreatedAt,
      received_at: now,
      processing_status: 'received',
    }),
    (candidateResult) => !candidateResult?.error || candidateResult?.error?.code === '23505',
  );

  const error = result?.error;
  if (error?.code === '23505') return { duplicate: true, eventId: normalized.eventId };
  if (error) throw error;

  await updateReconciliationState({
    last_event_id: normalized.eventId,
    last_event_category: normalized.category,
    ...(options.source === 'webhook' ? { last_webhook_at: now } : { last_poll_at: now }),
  });
  return { duplicate: false, eventId: normalized.eventId };
}

async function markEvents(eventIds: string[], status: 'processed' | 'failed', lastError: string | null = null) {
  const ids = Array.from(new Set(eventIds.map((id) => safeText(id, 200)).filter(Boolean)));
  if (!ids.length) return;
  const update: Record<string, unknown> = {
    processing_status: status,
    processed_at: new Date().toISOString(),
    last_error: lastError,
  };
  await withSupabaseAdmin((supabase) => supabase.from('galactic_increase_webhook_events').update(update).in('event_id', ids));
}

export async function reconcileIncreaseSandbox(options: {
  accountId: string;
  eventIds?: string[];
  trigger?: 'webhook' | 'poll' | 'owner' | 'dashboard';
}) {
  const accountId = requireOwnerAccountId(options?.accountId);
  const eventIds = Array.isArray(options?.eventIds) ? options.eventIds : [];
  const trigger = options?.trigger || 'owner';
  const startedAt = new Date().toISOString();

  try {
    const snapshot = await getIncreaseSandboxDashboardForAccount(accountId, process.env);
    const accounts = Array.isArray(snapshot?.accounts) ? snapshot.accounts : [];
    const transactions = Array.isArray(snapshot?.transactions) ? snapshot.transactions : [];
    const currentBalanceCents = accounts.reduce((sum: number, account: any) => sum + dollarsToCents(account?.currentBalance), 0);
    const availableBalanceCents = accounts.reduce((sum: number, account: any) => sum + dollarsToCents(account?.availableBalance), 0);
    const lastTransactionId = safeText(transactions[0]?.id, 200) || null;
    const reconciledAt = new Date().toISOString();

    await updateReconciliationState({
      last_reconciled_at: reconciledAt,
      last_reconciliation_status: 'ok',
      last_reconciliation_trigger: trigger,
      account_count: accounts.length,
      transaction_count: transactions.length,
      current_balance_cents: currentBalanceCents,
      available_balance_cents: availableBalanceCents,
      last_transaction_id: lastTransactionId,
      last_error: null,
    });

    let eventLedgerUpdated = true;
    let eventLedgerIssue = '';
    try {
      await markEvents(eventIds, 'processed');
    } catch (error) {
      eventLedgerUpdated = false;
      eventLedgerIssue = safeStorageIssue(error);
    }

    return {
      ok: true,
      environment: 'sandbox',
      canMoveRealMoney: false,
      scope: 'owner-account',
      trigger,
      startedAt,
      reconciledAt,
      accountCount: accounts.length,
      transactionCount: transactions.length,
      currentBalanceCents,
      availableBalanceCents,
      lastTransactionId,
      eventLedgerUpdated,
      eventLedgerIssue,
    };
  } catch (error) {
    const code = safeError(error);
    try {
      await updateReconciliationState({
        last_reconciled_at: new Date().toISOString(),
        last_reconciliation_status: 'failed',
        last_reconciliation_trigger: trigger,
        last_error: code,
      });
      try {
        await markEvents(eventIds, 'failed', code);
      } catch {
        // Event-ledger failure must not replace the original reconciliation error.
      }
    } catch {
      // Preserve the original provider/database error for the caller.
    }
    throw error;
  }
}

export async function pollIncreaseSandboxEvents(options: {
  accountId: string;
  maxPages?: number;
  forceReconcile?: boolean;
}) {
  const accountId = requireOwnerAccountId(options?.accountId);
  const maxPages = Math.max(1, Math.min(5, Number(options?.maxPages || 2)));

  let state: any = null;
  let stateReadAvailable = true;
  let stateReadIssue = '';
  try {
    const result = await withSupabaseAdmin((supabase) => supabase
      .from('galactic_increase_reconciliation_state')
      .select('event_cursor,last_reconciled_at')
      .eq('environment', 'sandbox')
      .maybeSingle());
    state = result?.data || null;
  } catch (error) {
    stateReadAvailable = false;
    stateReadIssue = safeStorageIssue(error);
  }

  let cursor = safeText(state?.event_cursor, 500);
  const observedEventIds: string[] = [];
  let newEvents = 0;
  let pages = 0;
  let scanned = 0;
  let eventPollingAvailable = true;
  let eventPollingIssue = '';
  const pollAttemptedAt = new Date().toISOString();

  if (stateReadAvailable) {
    try {
      while (pages < maxPages) {
        const params = new URLSearchParams();
        params.set('order_by.field', 'created_at');
        params.set('order_by.direction', 'ascending');
        params.set('limit', '100');
        if (cursor) params.set('cursor', cursor);

        const payload = await increaseSandboxRequest(`/events?${params.toString()}`, {}, process.env);
        const events = listData(payload);
        pages += 1;
        scanned += events.length;

        for (const event of events) {
          const recorded = await recordIncreaseSandboxEvent(event, { source: 'poll' });
          observedEventIds.push(recorded.eventId);
          if (!recorded.duplicate) newEvents += 1;
        }

        const nextCursor = safeText(payload?.next_cursor, 500);
        if (nextCursor) cursor = nextCursor;
        await updateReconciliationState({ event_cursor: cursor || null, last_poll_at: new Date().toISOString() });
        if (!events.length) break;
      }
    } catch (error) {
      eventPollingAvailable = false;
      eventPollingIssue = safeEventPollingIssue(error);
      try {
        await updateReconciliationState({ last_poll_at: pollAttemptedAt });
      } catch {
        // Reconciliation below will surface a database failure if storage is actually unavailable.
      }
    }
  } else {
    eventPollingAvailable = false;
    eventPollingIssue = stateReadIssue || 'state_unavailable';
  }

  const shouldReconcile = observedEventIds.length > 0
    || Boolean(options?.forceReconcile)
    || !state?.last_reconciled_at
    || !eventPollingAvailable;
  const reconciliation = shouldReconcile
    ? await reconcileIncreaseSandbox({
        accountId,
        eventIds: observedEventIds,
        trigger: eventPollingAvailable ? 'poll' : 'owner',
      })
    : null;

  return {
    ok: true,
    environment: 'sandbox',
    canMoveRealMoney: false,
    scope: 'owner-account',
    pages,
    scanned,
    observedEvents: observedEventIds.length,
    newEvents,
    cursorStored: Boolean(cursor),
    stateReadAvailable,
    stateReadIssue,
    eventPollingAvailable,
    eventPollingIssue,
    mode: eventPollingAvailable ? 'events-plus-owner-snapshot' : 'owner-snapshot-fallback',
    reconciled: Boolean(reconciliation),
    reconciliation,
  };
}

export async function getIncreaseReconciliationStatus() {
  let state: any = null;
  let recentEvents: any[] = [];
  let stateReadable = false;
  let eventLedgerReadable = false;
  let stateIssue = '';
  let eventLedgerIssue = '';

  try {
    const result = await withSupabaseAdmin((supabase) => supabase
      .from('galactic_increase_reconciliation_state')
      .select('*')
      .eq('environment', 'sandbox')
      .maybeSingle());
    state = result?.data || null;
    stateReadable = true;
  } catch (error) {
    stateIssue = safeStorageIssue(error);
  }

  try {
    const result = await withSupabaseAdmin((supabase) => supabase
      .from('galactic_increase_webhook_events')
      .select('event_id,category,associated_object_type,source,provider_created_at,received_at,processed_at,processing_status,last_error')
      .order('received_at', { ascending: false })
      .limit(12));
    recentEvents = Array.isArray(result?.data) ? result.data : [];
    eventLedgerReadable = true;
  } catch (error) {
    eventLedgerIssue = safeStorageIssue(error);
  }

  if (!stateReadable && !eventLedgerReadable) {
    throw new Error('Supabase reconciliation storage is unavailable.');
  }

  return {
    environment: 'sandbox',
    canMoveRealMoney: false,
    scope: 'owner-account',
    state,
    stateReadable,
    stateIssue,
    eventLedgerReadable,
    eventLedgerIssue,
    recentEvents,
  };
}
