import { getSupabaseAdminCandidates } from '../supabase-admin';

type TableProbe = {
  ready: boolean;
  missing: boolean;
  unavailable: boolean;
};

type WriteProbe = {
  writable: boolean;
  unavailable: boolean;
};

function isMissingRelation(error: any) {
  const code = String(error?.code || '').trim();
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01'
    || code === 'PGRST205'
    || message.includes('could not find the table')
    || message.includes('relation') && message.includes('does not exist');
}

async function probeTable(client: any, table: string): Promise<TableProbe> {
  try {
    const { error } = await client.from(table).select('*', { head: true, count: 'exact' }).limit(1);
    if (!error) return { ready: true, missing: false, unavailable: false };
    if (isMissingRelation(error)) return { ready: false, missing: true, unavailable: false };
    return { ready: false, missing: false, unavailable: true };
  } catch {
    return { ready: false, missing: false, unavailable: true };
  }
}

async function probeReconciliationWrite(client: any): Promise<WriteProbe> {
  try {
    const { error } = await client
      .from('galactic_increase_reconciliation_state')
      .upsert({
        environment: 'sandbox',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'environment' });
    return error
      ? { writable: false, unavailable: true }
      : { writable: true, unavailable: false };
  } catch {
    return { writable: false, unavailable: true };
  }
}

export async function inspectIncreaseReconciliationStorage() {
  let candidates: any[] = [];
  try {
    candidates = getSupabaseAdminCandidates();
  } catch {
    return {
      ok: true,
      environment: 'sandbox',
      runtime: process.env.VERCEL ? 'vercel' : 'server',
      source: 'deployed-server',
      serverCredentialsPresent: false,
      eventLedgerReady: false,
      reconciliationStateReady: false,
      reconciliationStateWritable: false,
      databaseReady: false,
      migration024Status: 'server-config-missing',
      nextStep: 'Configure the deployed server Supabase admin connection before checking reconciliation storage.',
      canMoveRealMoney: false,
    };
  }

  let missingObservation: { eventLedger: TableProbe; reconciliationState: TableProbe } | null = null;
  let readableButWriteBlocked = false;

  for (const client of candidates) {
    const [eventLedger, reconciliationState] = await Promise.all([
      probeTable(client, 'galactic_increase_webhook_events'),
      probeTable(client, 'galactic_increase_reconciliation_state'),
    ]);

    if (eventLedger.ready || reconciliationState.ready) {
      const writeProbe = reconciliationState.ready
        ? await probeReconciliationWrite(client)
        : { writable: false, unavailable: true };
      const tablesReady = eventLedger.ready && reconciliationState.ready;
      const databaseReady = tablesReady && writeProbe.writable;

      if (databaseReady) {
        return {
          ok: true,
          environment: 'sandbox',
          runtime: process.env.VERCEL ? 'vercel' : 'server',
          source: 'deployed-server',
          serverCredentialsPresent: true,
          eventLedgerReady: true,
          reconciliationStateReady: true,
          reconciliationStateWritable: true,
          databaseReady: true,
          migration024Status: 'ready',
          nextStep: '',
          canMoveRealMoney: false,
        };
      }

      if (tablesReady && !writeProbe.writable) readableButWriteBlocked = true;

      if (!tablesReady) {
        return {
          ok: true,
          environment: 'sandbox',
          runtime: process.env.VERCEL ? 'vercel' : 'server',
          source: 'deployed-server',
          serverCredentialsPresent: true,
          eventLedgerReady: eventLedger.ready,
          reconciliationStateReady: reconciliationState.ready,
          reconciliationStateWritable: writeProbe.writable,
          databaseReady: false,
          migration024Status: 'migration-needed',
          nextStep: 'Apply migration 024 so both Increase sandbox reconciliation tables are present.',
          canMoveRealMoney: false,
        };
      }
    }

    if (eventLedger.missing || reconciliationState.missing) {
      missingObservation = { eventLedger, reconciliationState };
    }
  }

  if (readableButWriteBlocked) {
    return {
      ok: true,
      environment: 'sandbox',
      runtime: process.env.VERCEL ? 'vercel' : 'server',
      source: 'deployed-server',
      serverCredentialsPresent: true,
      eventLedgerReady: true,
      reconciliationStateReady: true,
      reconciliationStateWritable: false,
      databaseReady: false,
      migration024Status: 'write-blocked',
      nextStep: 'Apply migration 026 so the backend service role can write the sandbox reconciliation heartbeat while browser roles remain denied.',
      canMoveRealMoney: false,
    };
  }

  if (missingObservation) {
    return {
      ok: true,
      environment: 'sandbox',
      runtime: process.env.VERCEL ? 'vercel' : 'server',
      source: 'deployed-server',
      serverCredentialsPresent: true,
      eventLedgerReady: false,
      reconciliationStateReady: false,
      reconciliationStateWritable: false,
      databaseReady: false,
      migration024Status: 'migration-needed',
      nextStep: 'The deployed Supabase project is reachable, but migration 024 reconciliation storage is not fully present.',
      canMoveRealMoney: false,
    };
  }

  return {
    ok: true,
    environment: 'sandbox',
    runtime: process.env.VERCEL ? 'vercel' : 'server',
    source: 'deployed-server',
    serverCredentialsPresent: true,
    eventLedgerReady: false,
    reconciliationStateReady: false,
    reconciliationStateWritable: false,
    databaseReady: false,
    migration024Status: 'unavailable',
    nextStep: 'The deployed server has Supabase admin configuration, but reconciliation storage could not be verified. Check the server-side Supabase connection and project permissions.',
    canMoveRealMoney: false,
  };
}
