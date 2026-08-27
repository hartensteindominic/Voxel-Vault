'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '@/lib/supabase-browser';
import { getVaultStoreProduct } from '@/lib/vault-store-products';
import styles from './success.module.css';

export default function VaultStoreSuccessPage() {
  const [sku, setSku] = useState('');
  const [session, setSession] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState('Stripe has returned you to Voxel Vault. Waiting for the verified payment event to unlock your account.');
  const attempts = useRef(0);
  const product = getVaultStoreProduct(sku);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setSku(query.get('sku') || '');
    let active = true;
    getSupabaseBrowserAsync()
      .then(async client => {
        const { data, error } = await client.auth.getSession();
        if (!active) return;
        if (error) setStatus(error.message);
        setSession(data?.session ?? null);
      })
      .catch(error => {
        if (active) setStatus(error instanceof Error ? error.message : 'Account session unavailable.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!product || !session?.access_token || ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function checkEntitlement() {
      if (cancelled) return;
      setChecking(true);
      attempts.current += 1;
      try {
        const response = await fetch('/api/vault-store/entitlements', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || 'Could not verify your library yet.');
        const owned = Array.isArray(data?.products) && data.products.some((item: any) => item?.sku === product.sku);
        if (owned) {
          if (!cancelled) {
            setReady(true);
            setChecking(false);
            setStatus('Payment verified. Your product is now unlocked in My Library and ready for private download.');
          }
          return;
        }
        if (!cancelled && attempts.current < 8) {
          setStatus('Payment returned successfully. Waiting for the signed Stripe webhook to confirm access…');
          timer = setTimeout(checkEntitlement, 1500);
          return;
        }
        if (!cancelled) {
          setChecking(false);
          setStatus('Payment confirmation is still processing. Your purchase is safe; use Refresh access below or return to My Library once the webhook completes.');
        }
      } catch (error) {
        if (!cancelled) {
          setChecking(false);
          setStatus(error instanceof Error ? error.message : 'Could not verify your library yet.');
        }
      }
    }

    checkEntitlement();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [product?.sku, session?.access_token, ready]);

  async function refreshAccess() {
    if (!product || !session?.access_token) {
      setStatus('Return to the store and sign in with the same Voxel Vault account used for checkout.');
      return;
    }
    setChecking(true);
    setStatus('Refreshing your account entitlement…');
    try {
      const response = await fetch('/api/vault-store/entitlements', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Could not refresh access.');
      const owned = Array.isArray(data?.products) && data.products.some((item: any) => item?.sku === product.sku);
      setReady(Boolean(owned));
      setStatus(owned
        ? 'Payment verified. Your product is unlocked and ready for private download.'
        : 'Access is not confirmed yet. The verified Stripe webhook must finish before the file can unlock.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not refresh access.');
    } finally {
      setChecking(false);
    }
  }

  async function download() {
    if (!product) {
      setStatus('This purchase link does not identify a valid Vault Store product.');
      return;
    }
    if (!session?.access_token) {
      setStatus('Your Voxel Vault account session is missing. Return to the store and sign in with the same account used for checkout.');
      return;
    }

    setBusy(true);
    setStatus('Authorizing a private download link…');
    try {
      const response = await fetch('/api/vault-store/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ sku: product.sku }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) throw new Error(data?.error || 'Download is not ready yet.');
      setReady(true);
      setStatus('Access verified. Opening your private download…');
      window.location.assign(data.url);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Download is not ready yet.');
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={`${styles.check} ${ready ? styles.readyCheck : ''}`}>{ready ? '✓' : '…'}</div>
        <span className={styles.kicker}>STRIPE RETURN // VERIFIED ENTITLEMENT</span>
        <h1>{ready ? 'Your kit is unlocked.' : 'Confirming your purchase.'}</h1>
        <p className={styles.product}>{product?.name || 'VoxelVault Digital Foundry purchase'}</p>
        <p className={styles.status} role="status" aria-live="polite">{status}</p>
        <div className={styles.actions}>
          <button className={styles.primary} onClick={download} disabled={busy || !product || !ready}>
            {busy ? 'AUTHORIZING DOWNLOAD…' : ready ? 'DOWNLOAD PRIVATE KIT ↓' : 'WAITING FOR VERIFIED ACCESS'}
          </button>
          {!ready && (
            <button className={styles.secondary} onClick={refreshAccess} disabled={checking || !product}>
              {checking ? 'CHECKING…' : 'REFRESH ACCESS'}
            </button>
          )}
        </div>
        <div className={styles.securityRow}>
          <span>ACCOUNT-BOUND</span>
          <span>WEBHOOK-VERIFIED</span>
          <span>60-SECOND LINK</span>
        </div>
        <div className={styles.links}>
          <a href="/vault-store">← My Library & Digital Foundry</a>
          <a href="/">Voxel Vault home</a>
        </div>
      </section>
    </main>
  );
}
