'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import styles from './integrations.module.css';

const goodState = /(CONFIGURED|READY|ENABLED|COMPLETE|OPEN)/i;
const lockedState = /(LOCKED|OFF|DISABLED|NOT CONFIGURED|AWAITING)/i;

function message(error) {
  return String(error?.message || error || 'Integrations status is unavailable.');
}

export default function IntegrationsPage() {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const clientRef = useRef(null);

  useEffect(() => {
    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data: auth } = await client.auth.getSession();
      if (active) setSession(auth.session || null);
      const change = client.auth.onAuthStateChange((_event, next) => { if (active) setSession(next || null); });
      subscription = change.data.subscription;
    }).catch((cause) => {
      if (active) { setStatus('error'); setError(message(cause)); }
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!session?.access_token) {
        setStatus('signed-out');
        setData(null);
        return;
      }
      setStatus('loading');
      setError('');
      try {
        const response = await fetch('/api/admin/integrations/status', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok) {
          setStatus(response.status === 403 ? 'locked' : 'error');
          setError(payload?.error || 'Owner integrations status is unavailable.');
          return;
        }
        setData(payload);
        setStatus('ready');
      } catch (cause) {
        if (active) { setStatus('error'); setError(message(cause)); }
      }
    }
    load();
    return () => { active = false; };
  }, [session?.access_token]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const integration of data?.integrations || []) {
      if (!map.has(integration.category)) map.set(integration.category, []);
      map.get(integration.category).push(integration);
    }
    return [...map.entries()];
  }, [data]);

  async function signIn() {
    setStatus('loading');
    setError('');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error: authError } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: new URL('/admin/integrations', window.location.origin).toString() },
      });
      if (authError) throw authError;
    } catch (cause) {
      setStatus('error');
      setError(message(cause));
    }
  }

  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.top}>
        <Link href="/more">← BACK TO MORE</Link>
        <Link href="/">VOXEL VAULT</Link>
      </header>

      <section className={styles.hero}>
        <small>OWNER · INTEGRATIONS CENTER</small>
        <h1>Know what is actually connected.</h1>
        <p>One status surface for APIs, providers, infrastructure and launch gates. It intentionally returns configuration state only—never API keys, access tokens, private keys or secret values.</p>
        {data ? <div className={styles.summary}>
          <div><b>{data.configuredCount}</b><span>CONFIGURED / READY</span></div>
          <div><b>{data.totalCount}</b><span>TRACKED INTEGRATIONS</span></div>
          <div><b>{String(data.environment || 'unknown').toUpperCase()}</b><span>DEPLOYMENT ENVIRONMENT</span></div>
        </div> : null}
      </section>

      {status === 'signed-out' ? <section className={styles.message}>
        <b>OWNER SIGN-IN REQUIRED</b>
        <span>Sign in with the Google account allowed by the server-side Voxel Vault admin allowlist.</span>
        <button className={styles.button} type="button" onClick={signIn}>SIGN IN WITH GOOGLE</button>
      </section> : null}

      {status === 'loading' ? <section className={styles.message}><b>CHECKING DEPLOYMENT…</b><span>Reading safe boolean configuration state from the server.</span></section> : null}
      {(status === 'locked' || status === 'error') ? <section className={styles.message}><b>{status === 'locked' ? 'OWNER ACCESS LOCKED' : 'STATUS UNAVAILABLE'}</b><span>{error}</span>{!session ? <button className={styles.button} type="button" onClick={signIn}>SIGN IN</button> : null}</section> : null}

      {status === 'ready' ? <section className={styles.panel}>
        {groups.map(([category, integrations]) => <div className={styles.group} key={category}>
          <div className={styles.groupHead}><h2>{category}</h2><span>{integrations.length} CONNECTION{integrations.length === 1 ? '' : 'S'}</span></div>
          <div className={styles.grid}>
            {integrations.map((integration) => {
              const stateClass = goodState.test(integration.state) ? styles.good : lockedState.test(integration.state) ? styles.locked : '';
              return <article className={styles.card} key={integration.id}>
                <div className={styles.cardTop}><h3>{integration.label}</h3><span className={`${styles.state} ${stateClass}`}>{integration.state}</span></div>
                <p>{integration.detail}</p>
                <span className={styles.mode}>{String(integration.mode || 'status only').toUpperCase()}</span>
              </article>;
            })}
          </div>
        </div>)}
        <div className={styles.fine}>{data?.safety?.note}</div>
      </section> : null}
    </div>
  </main>;
}
