'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import styles from './increase-sandbox-recovery.module.css';

function authHeaders(token, json = false) {
  const headers = { Authorization: `Bearer ${token}` };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

function hideLegacyBlockingSetup() {
  const panel = document.querySelector('[aria-label="Owner Increase sandbox setup"]');
  if (!panel) return;
  const parent = panel.parentElement;
  if (parent && parent.childElementCount === 1) parent.style.display = 'none';
  else panel.style.display = 'none';
}

export default function GalacticIncreaseSandboxRecovery() {
  const [token, setToken] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [accountCount, setAccountCount] = useState(0);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [bindingStorageBlocked, setBindingStorageBlocked] = useState(false);

  useEffect(() => {
    let active = true;
    let observer;

    function takeOverLegacySetup() {
      hideLegacyBlockingSetup();
      observer = new MutationObserver(hideLegacyBlockingSetup);
      observer.observe(document.body, { childList: true, subtree: true });
      window.setTimeout(() => observer?.disconnect(), 5000);
    }

    async function inspect() {
      try {
        const client = await getSupabaseBrowserAsync();
        const { data, error } = await client.auth.getSession();
        if (error || !data?.session?.access_token || !active) return;
        const accessToken = data.session.access_token;
        setToken(accessToken);

        const [statusResponse, lifecycleResponse, recoveryResponse] = await Promise.all([
          fetch('/api/admin/bank/increase/status', { cache: 'no-store', headers: authHeaders(accessToken) }),
          fetch('/api/bank/lifecycle', { cache: 'no-store', headers: authHeaders(accessToken) }),
          fetch('/api/admin/bank/increase/recovery', { cache: 'no-store', headers: authHeaders(accessToken) }),
        ]);
        const [status, lifecycle, recovery] = await Promise.all([
          statusResponse.json().catch(() => ({})),
          lifecycleResponse.json().catch(() => ({})),
          recoveryResponse.json().catch(() => ({})),
        ]);
        if (!active) return;

        if (lifecycle?.lifecycle?.sandbox?.ownerBindingReady || recovery?.binding?.status === 'verified') {
          takeOverLegacySetup();
          return;
        }

        // The recovery endpoint is the source of truth for whether this signed-in owner can use
        // Account-only sandbox recovery. Do not require Programs/Entities to fail with one exact
        // provider error shape before offering the safe owner-scoped fallback.
        const providerConnected = statusResponse.ok && Boolean(status?.connected);
        const storageBlocked = recoveryResponse.ok && Boolean(recovery?.setupRequired);
        const canRecover = providerConnected && recoveryResponse.ok && Boolean(recovery?.recoveryAvailable) && !storageBlocked;
        if (!canRecover && !storageBlocked) return;

        setAccountCount(Number(status?.counts?.accounts || 0));
        setBindingStorageBlocked(storageBlocked);
        setRecoveryAvailable(Boolean(canRecover));
        setMessage(storageBlocked
          ? String(recovery?.error || recovery?.bindingStorageIssue || 'Trusted provider binding storage needs attention before owner recovery can continue.')
          : '');
        setVisible(true);
        takeOverLegacySetup();
      } catch {
        // The existing setup UI remains the fallback if recovery inspection itself cannot load.
      }
    }

    inspect();
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, []);

  async function recover() {
    if (!token || busy || !recoveryAvailable) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/bank/increase/recovery', {
        method: 'POST',
        cache: 'no-store',
        headers: authHeaders(token, true),
        body: JSON.stringify({ action: 'recover_account_only' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.nextStep || payload?.error || 'Increase sandbox recovery failed.');

      setMessage(payload?.accountNumberReady
        ? 'Sandbox test account recovered and bound. Reloading Galactic Trust…'
        : 'Sandbox test account recovered and bound. ACH account-number simulation may still need provider access. Reloading…');
      window.setTimeout(() => window.location.reload(), 550);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Increase sandbox recovery failed.');
      setBusy(false);
    }
  }

  if (!visible) return null;

  const storageTitle = 'Galactic Trust sandbox storage needs attention.';
  const recoveryTitle = 'Create your owner-scoped sandbox test account.';

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Increase sandbox recovery">
      <section className={styles.card}>
        <div className={styles.eyebrow}>OWNER RECOVERY · SANDBOX ONLY</div>
        <div className={styles.titleRow}>
          <span className={styles.icon}>🪐</span>
          <div>
            <h2>{bindingStorageBlocked ? storageTitle : recoveryTitle}</h2>
            <p>{bindingStorageBlocked
              ? 'Increase Accounts access is connected, but the owner recovery route reports that its trusted server-side state needs attention before it can continue.'
              : 'Increase Accounts access is connected. Galactic Trust can create or reuse one dedicated owner test Account without requiring Programs, Entities, or hosted onboarding for this sandbox-only path.'}</p>
          </div>
        </div>

        <div className={styles.boundary}>
          <strong>{bindingStorageBlocked ? 'What needs to happen' : 'What this does'}</strong>
          <ul>
            {bindingStorageBlocked ? (
              <>
                <li>Open Integration Health to review the sanitized server-side recovery status.</li>
                <li>Keep provider and database credentials server-only; never paste them into chat or client code.</li>
                <li>Production banking remains locked while this sandbox-only state is resolved.</li>
              </>
            ) : (
              <>
                <li>Creates or reuses one idempotent Increase sandbox checking Account for your signed-in owner.</li>
                <li>Scopes that Account to your verified Galactic Trust user on the server.</li>
                <li>Keeps all balances and ACH activity pretend-money sandbox data.</li>
              </>
            )}
          </ul>
        </div>

        <div className={styles.notKyc}>
          <span>🔒</span>
          <p><b>This is not KYC or a real bank account.</b> Account-only recovery is stored as <code>SANDBOX_ACCOUNT_ONLY</code>. Production money movement remains locked.</p>
        </div>

        {!bindingStorageBlocked && accountCount > 0 && <p className={styles.existing}>Existing unbound sandbox Accounts will not be adopted automatically; recovery creates or reuses a dedicated owner-scoped Account instead.</p>}

        {recoveryAvailable && (
          <button className={styles.primary} type="button" onClick={recover} disabled={busy}>
            {busy ? 'Creating sandbox test account…' : 'Create sandbox test account'}
          </button>
        )}
        <a className={styles.secondary} href="/bank/integrations">Open Integration Health</a>
        {message && <p className={styles.message} role="status">{message}</p>}
      </section>
    </div>
  );
}
