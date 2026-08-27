'use client';

import { useEffect, useRef, useState } from 'react';
import VoxelVaultCanvas from '@/components/VoxelVaultCanvas';
import { getSupabaseBrowserAsync } from '@/lib/supabase-browser';
import { VAULT_STORE_PRODUCTS, formatVaultStorePrice, type VaultStoreProduct } from '@/lib/vault-store-products';
import styles from './vault-store.module.css';

function accountLabel(user: any) {
  return String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Verified account');
}

function googleReturnUrl() {
  const target = new URL('/vault-store', window.location.origin);
  target.searchParams.set('auth', 'google');
  return target.toString();
}

export default function VaultStoreClient({ checkoutEnabled }: { checkoutEnabled: boolean }) {
  const [session, setSession] = useState<any>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [status, setStatus] = useState('');
  const accountClient = useRef<any>(null);

  useEffect(() => {
    let active = true;
    let subscription: any = null;

    const query = new URLSearchParams(window.location.search);
    if (query.get('checkout') === 'cancelled') setStatus('Checkout was cancelled. Nothing was charged.');

    getSupabaseBrowserAsync()
      .then(async client => {
        if (!active) return;
        accountClient.current = client;
        const { data, error } = await client.auth.getSession();
        if (!active) return;
        if (error) setStatus(error.message);
        setSession(data?.session ?? null);
        const auth = client.auth.onAuthStateChange((_event: string, next: any) => {
          if (active) setSession(next);
        });
        subscription = auth.data.subscription;
      })
      .catch(error => {
        if (active) setStatus(error instanceof Error ? error.message : 'Account sign-in is unavailable.');
      });

    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!session?.user || typeof window === 'undefined') return;
    const query = new URLSearchParams(window.location.search);
    if (query.get('auth') === 'google') {
      setStatus(`Signed in as ${accountLabel(session.user)}. Choose a product to continue to Stripe.`);
      window.history.replaceState({}, '', '/vault-store');
    }
  }, [session?.user?.id]);

  async function signInGoogle() {
    setAccountBusy(true);
    setStatus('');
    try {
      const statusResponse = await fetch('/api/account/status', { cache: 'no-store' });
      const providerStatus = await statusResponse.json().catch(() => ({}));
      if (!statusResponse.ok || !providerStatus?.supabaseConfigured) {
        throw new Error('Voxel Vault account sign-in is not configured yet.');
      }
      if (providerStatus.googleProviderEnabled !== true) {
        throw new Error('Google sign-in is not enabled for Voxel Vault yet.');
      }

      const client = accountClient.current || await getSupabaseBrowserAsync();
      accountClient.current = client;
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: googleReturnUrl() },
      });
      if (error) throw error;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not start Google sign-in.');
      setAccountBusy(false);
    }
  }

  async function handleCheckout(product: VaultStoreProduct) {
    if (!checkoutEnabled) {
      setStatus('Checkout is locked until the private product files and production configuration are verified.');
      return;
    }
    if (!session?.access_token) {
      setStatus('Sign in with a valid Voxel Vault account before purchasing.');
      await signInGoogle();
      return;
    }

    setLoadingId(product.sku);
    setStatus('');
    try {
      const response = await fetch('/api/vault-store/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ sku: product.sku }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) throw new Error(data?.error || 'Checkout session initialization failed.');
      window.location.href = data.url;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Checkout is unavailable.');
      setLoadingId(null);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.systemLine}>
              <span className={styles.liveDot} />
              SECURE COMMERCE // ACCOUNT ENTITLEMENTS // PRIVATE DELIVERY
            </div>
            <h1>VoxelVault <em>Digital Foundry</em></h1>
            <p>Spatial 3D components and security-focused developer kits, delivered through verified payment and private account access.</p>
          </div>
          <div className={styles.accountArea}>
            <span className={`${styles.envPill} ${checkoutEnabled ? styles.ready : styles.preview}`}>
              {checkoutEnabled ? 'CHECKOUT ENABLED' : 'PREVIEW MODE'}
            </span>
            {session?.user ? (
              <span className={styles.accountPill}>SIGNED IN · {accountLabel(session.user)}</span>
            ) : (
              <button className={styles.accountButton} onClick={signInGoogle} disabled={accountBusy}>
                {accountBusy ? 'CONNECTING…' : 'SIGN IN WITH GOOGLE'}
              </button>
            )}
          </div>
        </header>

        <section className={styles.hero}>
          <div className={styles.sectionLabel}><span /> LIVE 3D ENGINE PREVIEW</div>
          <VoxelVaultCanvas />
          <div className={styles.heroNotes}>
            <span>THREE.JS</span>
            <span>ACCOUNT-GATED CHECKOUT</span>
            <span>WEBHOOK VERIFIED</span>
            <span>PRIVATE STORAGE</span>
          </div>
        </section>

        <section className={styles.products}>
          <div className={styles.productHeading}>
            <div>
              <span>AVAILABLE ARTIFACTS</span>
              <h2>Choose your build kit.</h2>
            </div>
            <p>One-time purchase. No subscription. Access is attached to the signed-in Voxel Vault account.</p>
          </div>

          <div className={styles.grid}>
            {VAULT_STORE_PRODUCTS.map(product => {
              const isLoading = loadingId === product.sku;
              return (
                <article className={styles.card} key={product.sku}>
                  <div className={styles.cardGlow} />
                  <div className={styles.cardTop}>
                    <span className={styles.badge}>{product.badge}</span>
                    <strong>{formatVaultStorePrice(product.priceCents)} <small>USD</small></strong>
                  </div>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <ul>
                    {product.features.map(feature => <li key={feature}><span>✓</span>{feature}</li>)}
                  </ul>
                  <button
                    className={styles.buyButton}
                    onClick={() => handleCheckout(product)}
                    disabled={isLoading || accountBusy || !checkoutEnabled}
                  >
                    {!checkoutEnabled
                      ? 'LOCKED UNTIL DELIVERY FILES VERIFIED'
                      : isLoading
                        ? 'OPENING SECURE CHECKOUT…'
                        : session?.user
                          ? `UNLOCK ${product.name.toUpperCase()} — ${formatVaultStorePrice(product.priceCents)}`
                          : `SIGN IN TO BUY — ${formatVaultStorePrice(product.priceCents)}`}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {status && <div className={styles.notice} role="status" aria-live="polite">{status}</div>}

        <footer className={styles.footer}>
          <span>PAYMENT CONFIRMATION → IDEMPOTENT WEBHOOK → ACCOUNT ENTITLEMENT → 60-SECOND SIGNED DOWNLOAD</span>
          <a href="/">← BACK TO VOXEL VAULT</a>
        </footer>
      </div>
    </main>
  );
}
