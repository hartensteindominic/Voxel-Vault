'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserAsync } from '@/lib/supabase-browser';
import { getVaultStoreProduct } from '@/lib/vault-store-products';
import styles from './success.module.css';

export default function VaultStoreSuccessPage() {
  const [sku, setSku] = useState('');
  const [session, setSession] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Stripe has returned you to Voxel Vault. Your entitlement unlocks after the signed webhook confirms payment.');
  const product = getVaultStoreProduct(sku);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setSku(query.get('sku') || '');
    let active = true;
    getSupabaseBrowserAsync()
      .then(async client => {
        const { data } = await client.auth.getSession();
        if (active) setSession(data?.session ?? null);
      })
      .catch(error => {
        if (active) setStatus(error instanceof Error ? error.message : 'Account session unavailable.');
      });
    return () => { active = false; };
  }, []);

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
    setStatus('Checking your paid entitlement…');
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
      setStatus('Access verified. Opening your private download…');
      window.location.href = data.url;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Download is not ready yet.');
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.check}>✓</div>
        <span className={styles.kicker}>STRIPE RETURN // ENTITLEMENT CHECK</span>
        <h1>Payment flow complete.</h1>
        <p className={styles.product}>{product?.name || 'VoxelVault Digital Foundry purchase'}</p>
        <p className={styles.status} role="status" aria-live="polite">{status}</p>
        <button onClick={download} disabled={busy || !product}>
          {busy ? 'VERIFYING ACCESS…' : 'VERIFY PURCHASE & DOWNLOAD'}
        </button>
        <div className={styles.links}>
          <a href="/vault-store">← Back to Digital Foundry</a>
          <a href="/">Voxel Vault home</a>
        </div>
      </section>
    </main>
  );
}
