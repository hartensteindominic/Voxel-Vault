'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import styles from './increase-sandbox-recovery.module.css';

function authHeaders(token, json = false) {
  const headers = { Authorization: `Bearer ${token}` };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

function hasPrivateFeatureRestriction(status) {
  return Object.values(status?.capabilities || {}).some((capability) => (
    capability?.available === false && capability?.issue?.type === 'private_feature_error'
  ));
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
  const [restrictionDetected, setRestrictionDetected] = useState(false);

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

        const connected = Boolean(statusResponse.ok && status?.connected);
        const privateFeatureBlocked = connected && hasPrivateFeatureRestriction(status);
        const storageBlocked = Boolean(recovery?.setupRequired);
        const canRecover = Boolean(
          connected &&
          recoveryResponse.ok &&
          recovery?.recoveryAvailable &&
          !storageBlocked
        );

        // Account-only recovery is intentionally not coupled to hosted-onboarding capability
        // detection. Increase can permit Programs/Entities reads while rejecting the hosted
        // onboarding session itself as a private feature. If Accounts are connected and the
        // owner recovery route confirms a safe dedicated Account can be created, prefer that
        // path immediately instead of leaving the owner trapped behind hosted onboarding.
        if (!canRecover && !privateFeatureBlocked) return;

        setAccountCount(Number(status?.counts?.accounts || 0));
        setBindingStorageBlocked(storageBlocked);
        setRestrictionDetected(privateFeatureBlocked);
        setRecoveryAvailable(canRecover);
        setMessage(storageBlocked
          ? String(recovery?.error || 'Trusted provider binding storage is not installed yet. Galactic Trust cannot safely bind the Increase sandbox Account until the required Supabase migration is applied.')
          : canRecover
            ? ''
            : String(recovery?.nextStep || recovery?.error || status?.nextStep || 'Owner sandbox Account recovery is not available yet.'));
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

  const storageTitle = 'Galactic Trust database setup is the blocker.';
  const recoveryTitle = restrictionDetected
    ? 'We can bypass the blocked hosted-onboarding feature.'
    : 'Create your dedicated sandbox test account.';

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Increase sandbox recovery">
      <section className={styles.card}>
        <div className={styles.eyebrow}>OWNER RECOVERY · SANDBOX ONLY</div>
        <div className={styles.titleRow}>
          <span className={styles.icon}>🪐</span>
          <div>
            <h2>{bindingStorageBlocked ? storageTitle : recoveryTitle}</h2>
            <p>{bindingStorageBlocked
              ? 'Increase Accounts access is connected. The restricted hosted-onboarding feature is no longer the actionable blocker; trusted provider-binding storage must be installed before Galactic Trust can safely attach a sandbox Account to your signed-in user.'
              : restrictionDetected
                ? 'Increase Accounts access is connected. Galactic Trust can create a dedicated owner test Account without requiring the restricted Programs/Entities onboarding screen.'
                : 'Increase Accounts access is connected and the owner recovery endpoint is ready. Galactic Trust can create a dedicated owner test Account without relying on hosted onboarding.'}</p>
          </div>
        </div>

        <div className={styles.boundary}>
          <strong>{bindingStorageBlocked ? 'What needs to happen' : 'What this does'}</strong>
          <ul>
            {bindingStorageBlocked ? (
              <>
                <li>Apply the pending Galactic Trust Supabase provider-binding migration, including migration 025.</li>
                <li>Keep database credentials in GitHub Actions secrets only; never paste them into chat or client code.</li>
                <li>After the migration is actually applied, this panel will offer the one-click Increase sandbox Account recovery automatically.</li>
              </>
            ) : (
              <>
                <li>Creates or reuses one idempotent Increase sandbox checking Account for your signed-in owner.</li>
                <li>Scopes only that dedicated Account to your Galactic Trust user on the server.</li>
                <li>Keeps all balances and ACH activity pretend-money sandbox data.</li>
              </>
            )}
          </ul>
        </div>

        <div className={styles.notKyc}>
          <span>🔒</span>
          <p><b>This is not KYC or a real bank account.</b> Account-only recovery is stored as <code>SANDBOX_ACCOUNT_ONLY</code>. Production money movement remains locked.</p>
        </div>

        {!bindingStorageBlocked && accountCount > 0 && <p className={styles.existing}>Existing unbound sandbox Accounts will not be adopted automatically; recovery creates/reuses a dedicated owner-scoped Account instead.</p>}

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
