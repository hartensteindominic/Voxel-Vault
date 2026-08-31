import { getSupabaseAdminCandidates } from '../supabase-admin';

function safeCode(error: any) {
  const code = String(error?.code || '').trim();
  if (code) return code.slice(0, 40);
  const status = Number(error?.status);
  if (Number.isFinite(status)) return `status_${status}`;
  return 'unavailable';
}

export async function probeIncreaseReconciliationPersistence() {
  const candidates = getSupabaseAdminCandidates();
  let lastIssue = 'unavailable';

  for (const client of candidates) {
    try {
      const { error } = await client
        .from('galactic_increase_reconciliation_state')
        .upsert({
          environment: 'sandbox',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'environment' });

      if (!error) {
        return {
          databaseWritable: true,
          writeIssue: '',
          canMoveRealMoney: false,
        };
      }
      lastIssue = safeCode(error);
    } catch (error) {
      lastIssue = safeCode(error);
    }
  }

  return {
    databaseWritable: false,
    writeIssue: lastIssue,
    canMoveRealMoney: false,
  };
}
