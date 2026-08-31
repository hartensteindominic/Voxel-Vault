'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import styles from './integration-health.module.css';

function displayTime(value) {
  if (!value) return 'Not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function stateLabel(ok, ready = false) {
  if (ok) return ready ? 'READY' : 'HEALTHY';
  return 'SETUP NEEDED';
}

function runModeLabel(mode) {
  if (mode === 'owner-snapshot-fallback') return 'OWNER SNAPSHOT FALLBACK';
  if (mode === 'events-plus-owner-snapshot') return 'EVENTS + OWNER SNAPSHOT';
  return 'OWNER SNAPSHOT';
}

function HealthBadge({ tone = 'neutral', children }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

function Metric({ label, value, tone = 'neutral' }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong className={styles[tone]}>{value}</strong>
    </div>
  );
}

function Capability({ name, capability }) {
  const available = capability?.available === true;
  return (
    <div className={styles.capability}>
      <span className={available ? styles.dotGood : styles.dotWarn} />
      <div>
        <b>{name}</b>
        <small>{available ? 'Available to the configured sandbox key' : capability?.status ? `Restricted · provider status ${capability.status}` : 'Not available yet'}</small>
      </div>
      <HealthBadge tone={available ? 'good' : 'warn'}>{available ? 'ON' : 'CHECK'}</HealthBadge>
    </div>
  );
}

export default function GalacticIntegrationHealthPage() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [reconciliationRun, setReconciliationRun] = useState(null);

  const requestHealth = useCallback(async (method = 'GET') => {
    const client = await getSupabaseBrowserAsync();
    const { data, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const token = String(data?.session?.access_token || '');
    setSignedIn(Boolean(token));
    if (!token) {
      setHealth(null);
      throw new Error('Sign in with the authorized Galactic Trust owner account to view integration health.');
    }

    const response = await fetch('/api/admin/bank/integration-health', {
      method,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (payload?.provider || payload?.production) setHealth(payload);
    if (!response.ok) throw new Error(String(payload?.error || 'Integration health could not be loaded.'));
    return payload;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await requestHealth('GET');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Integration health could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [requestHealth]);

  useEffect(() => {
    load();
  }, [load]);

  const runReconciliation = useCallback(async () => {
    setRunning(true);
    setError('');
    setReconciliationRun(null);
    try {
      const payload = await requestHealth('POST');
      setReconciliationRun(payload?.reconciliationRun || null);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Sandbox reconciliation could not run.');
    } finally {
      setRunning(false);
    }
  }, [requestHealth]);

  const summary = useMemo(() => {
    const providerHealthy = health?.provider?.connected === true && health?.provider?.capabilities?.accounts?.available === true;
    const bindingHealthy = health?.binding?.storageReady === true && health?.binding?.bound === true;
    const webhookHealthy = health?.webhook?.active === true;
    const reconciliationHealthy = health?.reconciliation?.databaseReady === true && health?.reconciliation?.status !== 'failed' && health?.reconciliation?.status !== 'unavailable';
    const productionLocked = health?.production?.liveBankingEnabled !== true && health?.production?.implementationReady !== true && health?.canMoveRealMoney !== true;
    return { providerHealthy, bindingHealthy, webhookHealthy, reconciliationHealthy, productionLocked };
  }, [health]);

  return (
    <main className={styles.page}>
      <div className={styles.aurora} aria-hidden="true" />
      <div className={styles.stars} aria-hidden="true" />

      <header className={styles.header}>
        <Link className={styles.brand} href="/bank">
          <span className={styles.brandMark}>✦</span>
          <span><b>Galactic Trust</b><small>Integration Health</small></span>
        </Link>
        <nav>
          <Link href="/bank/status">My Account</Link>
          <Link href="/bank/readiness">Launch Readiness</Link>
          <Link className={styles.primaryLink} href="/bank">Dashboard</Link>
        </nav>
      </header>

      <section className={styles.shell}>
        <div className={styles.hero}>
          <div>
            <span className={styles.kicker}>✦ OWNER OPERATIONS · SANDBOX ONLY</span>
            <h1>One screen for the<br /><em>banking integration stack.</em></h1>
            <p>Provider access, owner binding, webhook delivery, reconciliation, migrations, and the production lock are summarized here without exposing provider secrets or full provider identifiers to the browser.</p>
          </div>
          <div className={styles.heroLock}>
            <span>🔒</span>
            <div><small>REAL MONEY</small><b>LOCKED</b><p>Production banking remains fail-closed.</p></div>
          </div>
        </div>

        {loading ? (
          <section className={styles.loading} aria-live="polite">
            <span>◌</span><h2>Checking the Galactic Trust stack…</h2><p>Reading owner-authorized server health without loading provider credentials into the browser.</p>
          </section>
        ) : (
          <>
            {error && <div className={styles.error} role="status"><span>!</span><p><b>Attention needed</b><small>{error}</small></p></div>}

            {!health ? (
              <section className={styles.accessCard}>
                <span>◉</span>
                <h2>{signedIn ? 'Owner access is required.' : 'Sign in to continue.'}</h2>
                <p>This page only loads operational banking integration data for the authorized Galactic Trust owner account.</p>
                <Link href="/bank">Return to Galactic Trust</Link>
              </section>
            ) : (
              <>
                <section className={styles.overview} aria-label="Integration health overview">
                  <article>
                    <div className={styles.cardHead}><span>◈</span><HealthBadge tone={summary.providerHealthy ? 'good' : 'warn'}>{stateLabel(summary.providerHealthy)}</HealthBadge></div>
                    <h2>Increase sandbox</h2>
                    <p>The server-only provider connection and minimum account-read capability.</p>
                    <Metric label="Connection" value={health.provider?.connected ? 'CONNECTED' : 'NOT CONNECTED'} tone={health.provider?.connected ? 'goodText' : 'warnText'} />
                    <Metric label="Sandbox enabled" value={health.provider?.enabled ? 'YES' : 'NO'} tone={health.provider?.enabled ? 'goodText' : 'warnText'} />
                    <Metric label="Credentials" value={health.provider?.credentialsConfigured ? 'CONFIGURED' : 'MISSING'} tone={health.provider?.credentialsConfigured ? 'goodText' : 'warnText'} />
                  </article>

                  <article>
                    <div className={styles.cardHead}><span>◎</span><HealthBadge tone={summary.bindingHealthy ? 'good' : 'warn'}>{summary.bindingHealthy ? 'BOUND' : 'SETUP NEEDED'}</HealthBadge></div>
                    <h2>Owner binding</h2>
                    <p>The signed-in owner is mapped server-side to one Increase sandbox test account.</p>
                    <Metric label="Binding storage" value={health.binding?.storageReady ? 'READY' : 'MIGRATION NEEDED'} tone={health.binding?.storageReady ? 'goodText' : 'warnText'} />
                    <Metric label="Test account" value={health.binding?.bound ? `BOUND · •••${health.binding?.accountSuffix || ''}` : 'NOT BOUND'} tone={health.binding?.bound ? 'goodText' : 'warnText'} />
                    <Metric label="Validation" value={health.binding?.validationKind === 'sandbox-simulation' ? 'SANDBOX SIMULATION' : 'NONE'} />
                  </article>

                  <article>
                    <div className={styles.cardHead}><span>↻</span><HealthBadge tone={summary.webhookHealthy && summary.reconciliationHealthy ? 'good' : 'warn'}>{summary.webhookHealthy && summary.reconciliationHealthy ? 'SYNC READY' : 'CHECK SYNC'}</HealthBadge></div>
                    <h2>Events & reconciliation</h2>
                    <p>Webhook subscription plus the database-backed missed-event reconciliation backstop.</p>
                    <Metric label="Webhook" value={health.webhook?.active ? 'ACTIVE' : String(health.webhook?.status || 'NOT READY').toUpperCase()} tone={health.webhook?.active ? 'goodText' : 'warnText'} />
                    <Metric label="Reconciliation DB" value={health.reconciliation?.databaseReady ? 'READY' : 'MIGRATION NEEDED'} tone={health.reconciliation?.databaseReady ? 'goodText' : 'warnText'} />
                    <Metric label="Last reconciliation" value={displayTime(health.reconciliation?.lastReconciledAt)} />
                  </article>

                  <article className={styles.lockedCard}>
                    <div className={styles.cardHead}><span>🔒</span><HealthBadge tone="locked">LOCKED</HealthBadge></div>
                    <h2>Production banking</h2>
                    <p>Sandbox success cannot unlock real customer money or production account opening.</p>
                    <Metric label="Implementation ready" value={health.production?.implementationReady ? 'YES · REVIEW' : 'NO'} tone={health.production?.implementationReady ? 'warnText' : 'lockedText'} />
                    <Metric label="Evidence gates" value={`${health.production?.assertedGateCount || 0} / ${health.production?.totalGateCount || 0}`} />
                    <Metric label="Real-money movement" value="NO" tone="lockedText" />
                  </article>
                </section>

                <section className={styles.detailGrid}>
                  <article className={styles.panel}>
                    <div className={styles.panelHead}><div><span>PROVIDER CAPABILITIES</span><h2>What the sandbox key can access</h2></div><HealthBadge tone={summary.providerHealthy ? 'good' : 'warn'}>{health.provider?.connected ? 'CONNECTED' : 'OFFLINE'}</HealthBadge></div>
                    <div className={styles.capabilities}>
                      <Capability name="Accounts" capability={health.provider?.capabilities?.accounts} />
                      <Capability name="Programs" capability={health.provider?.capabilities?.programs} />
                      <Capability name="Entities" capability={health.provider?.capabilities?.entities} />
                    </div>
                    <div className={styles.counts}>
                      <div><b>{health.provider?.counts?.accounts || 0}</b><span>Accounts visible</span></div>
                      <div><b>{health.onboarding?.programCount || 0}</b><span>Programs available</span></div>
                      <div><b>{health.provider?.counts?.entities || 0}</b><span>Entities visible</span></div>
                    </div>
                  </article>

                  <article className={styles.panel}>
                    <div className={styles.panelHead}><div><span>RECONCILIATION</span><h2>Event-sync heartbeat</h2></div><HealthBadge tone={summary.reconciliationHealthy ? 'good' : 'warn'}>{String(health.reconciliation?.status || 'NOT RUN').toUpperCase()}</HealthBadge></div>
                    <div className={styles.syncGrid}>
                      <div><span>Last webhook</span><b>{displayTime(health.reconciliation?.lastWebhookAt)}</b></div>
                      <div><span>Last poll</span><b>{displayTime(health.reconciliation?.lastPollAt)}</b></div>
                      <div><span>Recent events</span><b>{health.reconciliation?.recentEventCount || 0}</b></div>
                      <div><span>Transactions seen</span><b>{health.reconciliation?.transactionCount || 0}</b></div>
                    </div>
                    {health.reconciliation?.lastTrigger && (
                      <div className={styles.latestEvent}>
                        <span>Last persisted reconciliation path</span>
                        <p><b>{health.reconciliation.lastTrigger === 'owner' ? 'Owner account snapshot' : health.reconciliation.lastTrigger === 'poll' ? 'Events + owner snapshot' : `${health.reconciliation.lastTrigger} snapshot`}</b><small>{displayTime(health.reconciliation.lastReconciledAt)} · sandbox only</small></p>
                      </div>
                    )}
                    {reconciliationRun && (
                      <div className={styles.latestEvent} role="status">
                        <span>Latest manual run</span>
                        <p>
                          <b>{runModeLabel(reconciliationRun.mode)}</b>
                          <small>{reconciliationRun.reconciled ? 'Owner reconciliation completed' : 'Reconciliation did not complete'} · Events polling {reconciliationRun.eventPollingAvailable ? 'available' : 'restricted/unavailable'} · {reconciliationRun.observedEvents || 0} events observed</small>
                        </p>
                      </div>
                    )}
                    {health.reconciliation?.latestEvent && (
                      <div className={styles.latestEvent}>
                        <span>Latest safe event summary</span>
                        <p><b>{health.reconciliation.latestEvent.category || 'Increase sandbox event'}</b><small>{health.reconciliation.latestEvent.source || 'provider'} · {health.reconciliation.latestEvent.processingStatus || 'received'} · {displayTime(health.reconciliation.latestEvent.receivedAt)}</small></p>
                      </div>
                    )}
                    <button className={styles.reconcileButton} type="button" onClick={runReconciliation} disabled={running || !health.provider?.connected} aria-busy={running}>
                      {running ? 'Reconciling sandbox…' : '↻ Run sandbox reconciliation'}
                    </button>
                    <small className={styles.buttonNote}>This checks pretend-money Increase sandbox events and, when Events access is restricted, falls back to the signed-in owner sandbox Account snapshot. It cannot move real money.</small>
                  </article>
                </section>

                <section className={styles.queue}>
                  <div className={styles.queueHead}>
                    <div><span>SETUP QUEUE</span><h2>{health.nextSteps?.length ? 'What still needs attention' : 'Sandbox integration is operationally clean'}</h2></div>
                    <HealthBadge tone={health.nextSteps?.length ? 'warn' : 'good'}>{health.nextSteps?.length ? `${health.nextSteps.length} ITEMS` : 'CLEAR'}</HealthBadge>
                  </div>
                  {health.nextSteps?.length ? (
                    <div className={styles.steps}>
                      {health.nextSteps.map((step, index) => (
                        <div className={styles.step} key={`${index}-${step}`}><span>{index + 1}</span><p>{step}</p></div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.clearMessage}>Provider access, owner scope, reconciliation storage, and the owner snapshot backstop are ready for Galactic Trust sandbox testing. Webhook/Event availability remains a separate provider capability. Production banking still remains separately locked.</p>
                  )}
                </section>

                <section className={styles.truthStrip}>
                  <span>✓</span>
                  <p><b>Truthful operating boundary</b><small>Increase data shown here is sandbox test data. SANDBOX_VALID_SIMULATION and SANDBOX_ACCOUNT_ONLY are not real KYC/CIP/AML approval. Galactic Trust is a financial technology product, not a bank, and this build cannot accept or move real customer deposits.</small></p>
                  <Link href="/bank/readiness">Review production gates →</Link>
                </section>

                <div className={styles.actions}>
                  <button type="button" onClick={load}>Refresh integration health</button>
                  <Link href="/bank/status">View my account status</Link>
                </div>

                <p className={styles.updated}>Last checked {displayTime(health.generatedAt)}</p>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
