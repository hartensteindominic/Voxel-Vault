'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../../lib/supabase-browser';
import styles from '../integration-health.module.css';

function Badge({ ready, children }) {
  return <span className={`${styles.badge} ${ready ? styles.good : styles.warn}`}>{children}</span>;
}

function Metric({ label, value, ready = true }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong className={ready ? styles.goodText : styles.warnText}>{value}</strong>
    </div>
  );
}

export default function ReconciliationStorageReadinessPage() {
  const [loading, setLoading] = useState(true);
  const [readiness, setReadiness] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const client = await getSupabaseBrowserAsync();
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const token = String(data?.session?.access_token || '');
      if (!token) throw new Error('Sign in with the authorized Galactic Trust owner account to check storage readiness.');

      const response = await fetch('/api/admin/bank/increase/reconciliation-readiness', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload?.error || 'Storage readiness could not be checked.'));
      setReadiness(payload);
    } catch (loadError) {
      setReadiness(null);
      setError(loadError instanceof Error ? loadError.message : 'Storage readiness could not be checked.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const databaseReady = readiness?.databaseReady === true;

  return (
    <main className={styles.page}>
      <div className={styles.aurora} aria-hidden="true" />
      <div className={styles.stars} aria-hidden="true" />
      <header className={styles.header}>
        <Link className={styles.brand} href="/bank">
          <span className={styles.brandMark}>✦</span>
          <span><b>Galactic Trust</b><small>Storage Readiness</small></span>
        </Link>
        <nav>
          <Link href="/bank/integrations">Integration Health</Link>
          <Link className={styles.primaryLink} href="/bank">Dashboard</Link>
        </nav>
      </header>

      <section className={styles.shell}>
        <div className={styles.hero}>
          <div>
            <span className={styles.kicker}>✦ OWNER CHECK · DEPLOYED SERVER</span>
            <h1>Verify reconciliation storage<br /><em>from the app itself.</em></h1>
            <p>This check uses the Supabase admin connection already available to the deployed Galactic Trust server. It does not rely on GitHub Actions secrets and never returns credentials to the browser.</p>
          </div>
          <div className={styles.heroLock}>
            <span>🔒</span>
            <div><small>REAL MONEY</small><b>LOCKED</b><p>Sandbox readiness only.</p></div>
          </div>
        </div>

        {loading ? (
          <section className={styles.loading} aria-live="polite">
            <span>◌</span><h2>Checking deployed Supabase storage…</h2><p>No secret values are returned.</p>
          </section>
        ) : error ? (
          <div className={styles.error} role="status"><span>!</span><p><b>Readiness check needs attention</b><small>{error}</small></p></div>
        ) : readiness ? (
          <>
            <section className={styles.overview} aria-label="Reconciliation storage readiness">
              <article>
                <div className={styles.cardHead}><span>◈</span><Badge ready={readiness.serverCredentialsPresent}>{readiness.serverCredentialsPresent ? 'CONFIGURED' : 'MISSING'}</Badge></div>
                <h2>Deployed server</h2>
                <p>Checks whether the running app can initialize its server-side Supabase admin connection.</p>
                <Metric label="Runtime" value={String(readiness.runtime || 'server').toUpperCase()} />
                <Metric label="Admin configuration" value={readiness.serverCredentialsPresent ? 'PRESENT' : 'MISSING'} ready={readiness.serverCredentialsPresent} />
              </article>

              <article>
                <div className={styles.cardHead}><span>◎</span><Badge ready={readiness.eventLedgerReady}>{readiness.eventLedgerReady ? 'READY' : 'CHECK'}</Badge></div>
                <h2>Increase event ledger</h2>
                <p>Service-only storage for verified Increase sandbox events.</p>
                <Metric label="Event ledger" value={readiness.eventLedgerReady ? 'READY' : 'NOT READY'} ready={readiness.eventLedgerReady} />
              </article>

              <article>
                <div className={styles.cardHead}><span>↻</span><Badge ready={readiness.reconciliationStateReady}>{readiness.reconciliationStateReady ? 'READY' : 'CHECK'}</Badge></div>
                <h2>Reconciliation state</h2>
                <p>Stores the sandbox event cursor, heartbeat, and owner-scoped reconciliation checkpoint.</p>
                <Metric label="State table" value={readiness.reconciliationStateReady ? 'READY' : 'NOT READY'} ready={readiness.reconciliationStateReady} />
              </article>

              <article className={databaseReady ? '' : styles.lockedCard}>
                <div className={styles.cardHead}><span>{databaseReady ? '✓' : '!'}</span><Badge ready={databaseReady}>{databaseReady ? 'MIGRATION 024 READY' : 'MIGRATION 024 NEEDED'}</Badge></div>
                <h2>Automatic reconciliation</h2>
                <p>Both tables must exist before webhook persistence and missed-event reconciliation can be durable.</p>
                <Metric label="Storage" value={databaseReady ? 'READY' : 'NOT READY'} ready={databaseReady} />
                <Metric label="Real-money movement" value="NO" ready={false} />
              </article>
            </section>

            <section className={styles.queue}>
              <div className={styles.queueHead}>
                <div><span>NEXT STEP</span><h2>{databaseReady ? 'Reconciliation storage is ready' : 'One infrastructure step remains'}</h2></div>
                <Badge ready={databaseReady}>{databaseReady ? 'READY' : 'ACTION NEEDED'}</Badge>
              </div>
              <p className={styles.clearMessage}>{databaseReady ? 'The deployed app can see both migration-024 tables. Return to Integration Health and run owner-scoped sandbox reconciliation.' : readiness.nextStep}</p>
            </section>

            <section className={styles.truthStrip}>
              <span>✓</span>
              <p><b>Safe verification only</b><small>This page checks table readiness using the deployed server connection. It does not expose Supabase credentials, raw database errors, provider identifiers, or enable production banking.</small></p>
              <Link href="/bank/integrations">Integration Health →</Link>
            </section>

            <div className={styles.actions}>
              <button type="button" onClick={load}>Refresh storage readiness</button>
              <Link href="/bank">Back to dashboard</Link>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
