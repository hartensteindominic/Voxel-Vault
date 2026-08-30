'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import styles from './status.module.css';

const stageCopy = {
  'demo-only': {
    eyebrow: 'DEMO ONLY',
    title: 'Your Galactic Trust account is in demo mode.',
    detail: 'You can explore the product, but no provider-backed bank account or real-money access is active for this signed-in account.',
    icon: '✦',
  },
  'sandbox-owner-bound': {
    eyebrow: 'INCREASE SANDBOX · TEST ACCOUNT',
    title: 'Your signed-in account is bound to an Increase sandbox test account.',
    detail: 'Provider balances and ACH simulations are scoped to your server-side test binding. The money is pretend. This is not a production bank account.',
    icon: '✓',
  },
  'infrastructure-setup-required': {
    eyebrow: 'SETUP REQUIRED',
    title: 'The trusted provider-binding infrastructure needs setup.',
    detail: 'Galactic Trust is refusing to treat any provider account as yours until the required server-side database migrations are installed.',
    icon: '!',
  },
  'signed-out': {
    eyebrow: 'SIGN IN REQUIRED',
    title: 'Sign in to view your Galactic Trust account status.',
    detail: 'Account status is derived from your verified session and trusted provider binding, never from a browser-supplied user ID.',
    icon: '◉',
  },
};

function statusCopy(stage) {
  return stageCopy[stage] || stageCopy['demo-only'];
}

function StatusRow({ label, value, state = 'neutral' }) {
  return (
    <div className={styles.statusRow}>
      <span>{label}</span>
      <strong className={styles[state]}>{value}</strong>
    </div>
  );
}

export default function GalacticAccountStatusPage() {
  const [loading, setLoading] = useState(true);
  const [lifecycle, setLifecycle] = useState(null);
  const [error, setError] = useState('');
  const [signedIn, setSignedIn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const client = await getSupabaseBrowserAsync();
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const token = String(data?.session?.access_token || '');
      setSignedIn(Boolean(token));
      if (!token) {
        setLifecycle({
          stage: 'signed-out',
          canMoveRealMoney: false,
          canOpenProductionAccount: false,
          sandbox: { ownerBindingReady: false, bindingStorageReady: true, canMoveRealMoney: false, validationKind: 'none' },
          production: { status: 'production-gated', implementationReady: false, customerAccountOpeningSupported: false, customerMoneyMovementSupported: false, canMoveRealMoney: false },
        });
        return;
      }

      const response = await fetch('/api/bank/lifecycle', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (payload?.lifecycle) setLifecycle(payload.lifecycle);
      if (!response.ok) setError(String(payload?.error || 'Account status could not be loaded.'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Account status could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copy = useMemo(() => statusCopy(lifecycle?.stage), [lifecycle?.stage]);
  const productionLocked = lifecycle?.production?.customerAccountOpeningSupported !== true
    && lifecycle?.production?.customerMoneyMovementSupported !== true
    && lifecycle?.canMoveRealMoney !== true;

  return (
    <main className={styles.page}>
      <div className={styles.stars} aria-hidden="true" />
      <header className={styles.header}>
        <Link className={styles.brand} href="/bank"><span className={styles.planet}>✦</span><span><b>Galactic Trust</b><small>Account Status</small></span></Link>
        <div className={styles.headerActions}>
          <Link href="/bank/readiness">Launch Readiness</Link>
          <Link className={styles.primaryLink} href="/bank">Back to Dashboard</Link>
        </div>
      </header>

      <section className={styles.shell}>
        <div className={styles.intro}>
          <span className={styles.kicker}>✦ SERVER-DERIVED ACCOUNT STATE</span>
          <h1>Know exactly what your<br /><em>Galactic Trust account</em> can do.</h1>
          <p>This page reads your verified session, trusted provider binding, and Galactic Trust&apos;s regulated-launch locks. It does not infer banking access from a button, balance card, environment switch, or marketing copy.</p>
        </div>

        <section className={styles.statusCard} aria-live="polite">
          {loading ? (
            <div className={styles.loading}><span>◌</span><h2>Checking your account state…</h2><p>Verifying your signed-in lifecycle.</p></div>
          ) : (
            <>
              <div className={styles.statusHero}>
                <span className={styles.statusIcon}>{copy.icon}</span>
                <div><small>{copy.eyebrow}</small><h2>{copy.title}</h2><p>{copy.detail}</p></div>
              </div>

              {error && <div className={styles.error} role="status">{error}</div>}

              <div className={styles.grid}>
                <article>
                  <span className={styles.cardIcon}>◈</span>
                  <h3>Provider test account</h3>
                  <StatusRow label="Increase sandbox binding" value={lifecycle?.sandbox?.ownerBindingReady ? 'BOUND' : 'NOT BOUND'} state={lifecycle?.sandbox?.ownerBindingReady ? 'good' : 'neutral'} />
                  <StatusRow label="Binding storage" value={lifecycle?.sandbox?.bindingStorageReady === false ? 'SETUP REQUIRED' : 'READY'} state={lifecycle?.sandbox?.bindingStorageReady === false ? 'warn' : 'good'} />
                  <StatusRow label="Validation kind" value={lifecycle?.sandbox?.validationKind === 'sandbox-simulation' ? 'SANDBOX SIMULATION' : 'NONE'} />
                  <StatusRow label="Real money" value="NO" state="locked" />
                  <p className={styles.cardNote}>A sandbox binding proves only that test data is scoped to the signed-in user. It is not KYC approval, a deposit account, or permission to move real money.</p>
                </article>

                <article>
                  <span className={styles.cardIcon}>🔒</span>
                  <h3>Production banking</h3>
                  <StatusRow label="Launch status" value={lifecycle?.production?.status === 'live' ? 'LIVE' : 'GATED'} state={lifecycle?.production?.status === 'live' ? 'warn' : 'locked'} />
                  <StatusRow label="Implementation ready" value={lifecycle?.production?.implementationReady ? 'YES' : 'NO'} state={lifecycle?.production?.implementationReady ? 'warn' : 'locked'} />
                  <StatusRow label="Customer account opening" value={lifecycle?.production?.customerAccountOpeningSupported ? 'SUPPORTED' : 'NOT SUPPORTED'} state={lifecycle?.production?.customerAccountOpeningSupported ? 'warn' : 'locked'} />
                  <StatusRow label="Real-money movement" value={lifecycle?.production?.customerMoneyMovementSupported ? 'SUPPORTED' : 'NOT SUPPORTED'} state={lifecycle?.production?.customerMoneyMovementSupported ? 'warn' : 'locked'} />
                  <p className={styles.cardNote}>Production access requires an approved sponsor-bank/provider program plus the reviewed production implementation. Environment flags alone cannot enable it.</p>
                </article>
              </div>

              <div className={`${styles.bottomState} ${productionLocked ? styles.safe : styles.alert}`}>
                <span>{productionLocked ? '✓' : '!'}</span>
                <p><b>{productionLocked ? 'Production remains fail-closed.' : 'Production status requires immediate review.'}</b><small>{productionLocked ? 'No production account opening or real-money movement is enabled for this lifecycle.' : 'This page detected an unexpected production-capable lifecycle.'}</small></p>
              </div>

              <div className={styles.actions}>
                {!signedIn ? <Link className={styles.button} href="/bank">Sign in to Galactic Trust</Link> : <button className={styles.button} type="button" onClick={load}>Refresh account status</button>}
                <Link className={styles.secondaryButton} href="/bank/readiness">See regulated launch requirements</Link>
              </div>
            </>
          )}
        </section>

        <footer className={styles.disclosure}>
          <b>Galactic Trust is a financial technology product, not a bank.</b> This status page is not a bank-account approval, KYC decision, credit decision, or representation that deposits are insured. Increase sandbox values are test data with pretend money only.
        </footer>
      </section>
    </main>
  );
}
