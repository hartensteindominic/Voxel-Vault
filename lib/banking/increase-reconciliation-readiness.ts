import { getSupabaseAdminCandidates } from '../supabase-admin';

type TableProbe = {
  ready: boolean;
  missing: boolean;
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
      databaseReady: false,
      migration024Status: 'server-config-missing',
      nextStep: 'Configure the deployed server Supabase admin connection before checking reconciliation storage.',
      canMoveRealMoney: false,
    };
  }

  let missingObservation: { eventLedger: TableProbe; reconciliationState: TableProbe } | null = null;

  for (const client of candidates) {
    const [eventLedger, reconciliationState] = await Promise.all([
      probeTable(client, 'galactic_increase_webhook_events'),
      probeTable(client, 'galactic_increase_reconciliation_state'),
    ]);

    if (eventLedger.ready || reconciliationState.ready) {
      const databaseReady = eventLedger.ready && reconciliationState.ready;
      return {
        ok: true,
        environment: 'sandbox',
        runtime: process.env.VERCEL ? 'vercel' : 'server',
        source: 'deployed-server',
        serverCredentialsPresent: true,
        eventLedgerReady: eventLedger.ready,
        reconciliationStateReady: reconciliationState.ready,
        databaseReady,
        migration024Status: databaseReady ? 'ready' : 'migration-needed',
        nextStep: databaseReady
          ? ''
          : 'Apply migration 024 so both Increase sandbox reconciliation tables are present.',
        canMoveRealMoney: false,
      };
    }

    if (eventLedger.missing || reconciliationState.missing) {
      missingObservation = { eventLedger, reconciliationState };
    }
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
    databaseReady: false,
    migration024Status: 'unavailable',
    nextStep: 'The deployed server has Supabase admin configuration, but reconciliation storage could not be verified. Check the server-side Supabase connection and project permissions.',
    canMoveRealMoney: false,
  };
}
