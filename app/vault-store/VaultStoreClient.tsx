'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import VoxelVaultCanvas from '@/components/VoxelVaultCanvas';
import { getSupabaseBrowserAsync } from '@/lib/supabase-browser';
import { VAULT_STORE_PRODUCTS, formatVaultStorePrice, type VaultStoreProduct, type VaultStoreSku } from '@/lib/vault-store-products';
import styles from './vault-store.module.css';

type OwnedProduct = {
  sku: VaultStoreSku;
  name: string;
  priceCents: number;
  purchasedAt: string;
};

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
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [ownedProducts, setOwnedProducts] = useState<OwnedProduct[]>([]);
  const [status, setStatus] = useState('');
  const accountClient = useRef<any>(null);

  const ownedSkus = useMemo(() => new Set(ownedProducts.map(product => product.sku)), [ownedProducts]);

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
      setStatus(`Signed in as ${accountLabel(session.user)}. Your library is connected to this account.`);
      window.history.replaceState({}, '', '/vault-store');
    }
  }, [session?.user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadLibrary() {
      if (!session?.access_token) {
        setOwnedProducts([]);
        return;
      }
      setLibraryLoading(true);
      try {
        const response = await fetch('/api/vault-store/entitlements', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (checkoutEnabled && !cancelled) setStatus(data?.error || 'Your Vault Store library could not load.');
          return;
        }
        if (!cancelled) setOwnedProducts(Array.isArray(data?.products) ? data.products : []);
      } catch {
        if (checkoutEnabled && !cancelled) setStatus('Your Vault Store library could not load.');
      } finally {
        if (!cancelled) setLibraryLoading(false);
      }
    }
    loadLibrary();
    return () => { cancelled = true; };
  }, [session?.access_token, checkoutEnabled]);

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

  async function signOut() {
    setAccountBusy(true);
    setStatus('');
    try {
      const client = accountClient.current || await getSupabaseBrowserAsync();
      accountClient.current = client;
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setSession(null);
      setOwnedProducts([]);
      setStatus('Signed out. Your purchases remain attached to your account.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not sign out.');
    } finally {
      setAccountBusy(false);
    }
  }

  async function handleCheckout(product: VaultStoreProduct) {
    if (ownedSkus.has(product.sku)) {
      await handleDownload(product);
      return;
    }
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

  async function handleDownload(product: VaultStoreProduct) {
    if (!session?.access_token) {
      setStatus('Sign in with the account that purchased this product to download it.');
      return;
    }
    setDownloadId(product.sku);
    setStatus('Preparing a private download link…');
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
      if (!response.ok || !data?.url) throw new Error(data?.error || 'Download unavailable.');
      setStatus('Private download authorized. The link expires shortly.');
      window.location.assign(data.url);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Download unavailable.');
    } finally {
      setDownloadId(null);
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
              <div className={styles.signedInRow}>
                <span className={styles.accountPill}>SIGNED IN · {accountLabel(session.user)}</span>
                <button className={styles.signOutButton} onClick={signOut} disabled={accountBusy}>SIGN OUT</button>
              </div>
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

        {session?.user && (
          <section className={styles.library} aria-label="My Vault Store library">
            <div>
              <span className={styles.libraryLabel}>MY LIBRARY</span>
              <h2>{libraryLoading ? 'Checking your purchases…' : ownedProducts.length ? `${ownedProducts.length} product${ownedProducts.length === 1 ? '' : 's'} unlocked` : 'Your purchased kits will appear here'}</h2>
              <p>Downloads stay attached to this Voxel Vault account. You can return here later without repurchasing.</p>
            </div>
            <div className={styles.libraryItems}>
              {ownedProducts.length ? ownedProducts.map(owned => {
                const product = VAULT_STORE_PRODUCTS.find(item => item.sku === owned.sku);
                if (!product) return null;
                return (
                  <button key={owned.sku} onClick={() => handleDownload(product)} disabled={downloadId === owned.sku}>
                    <span><b>{owned.name}</b><small>OWNED · PRIVATE DOWNLOAD</small></span>
                    <strong>{downloadId === owned.sku ? 'PREPARING…' : 'DOWNLOAD ↓'}</strong>
                  </button>
                );
              }) : <span className={styles.libraryEmpty}>{libraryLoading ? 'SYNCING ACCOUNT…' : 'NO STORE PURCHASES ON THIS ACCOUNT YET'}</span>}
            </div>
          </section>
        )}

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
              const isDownloading = downloadId === product.sku;
              const isOwned = ownedSkus.has(product.sku);
              return (
                <article className={`${styles.card} ${isOwned ? styles.ownedCard : ''}`} key={product.sku}>
                  <div className={styles.cardGlow} />
                  <div className={styles.cardTop}>
                    <span className={styles.badge}>{isOwned ? '✓ OWNED' : product.badge}</span>
                    <strong>{formatVaultStorePrice(product.priceCents)} <small>USD</small></strong>
                  </div>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <ul>
                    {product.features.map(feature => <li key={feature}><span>✓</span>{feature}</li>)}
                  </ul>
                  <button
                    className={`${styles.buyButton} ${isOwned ? styles.downloadButton : ''}`}
                    onClick={() => handleCheckout(product)}
                    disabled={isLoading || isDownloading || accountBusy || (!checkoutEnabled && !isOwned)}
                  >
                    {isOwned
                      ? isDownloading ? 'PREPARING PRIVATE DOWNLOAD…' : `DOWNLOAD ${product.name.toUpperCase()} ↓`
                      : !checkoutEnabled
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

        <section className={styles.trust}>
          <div className={styles.trustHeading}>
            <span>HOW DELIVERY WORKS</span>
            <h2>Pay once. Verify. Unlock.</h2>
          </div>
          <div className={styles.trustGrid}>
            <div><b>01</b><h3>Account-bound</h3><p>Your purchase is linked to the authenticated Voxel Vault account, not a browser cookie.</p></div>
            <div><b>02</b><h3>Server-priced</h3><p>The browser sends only the product SKU. The server owns the amount and Stripe session configuration.</p></div>
            <div><b>03</b><h3>Webhook-confirmed</h3><p>Access is granted only after a verified Stripe event reports a paid checkout.</p></div>
            <div><b>04</b><h3>Private download</h3><p>Files stay in private storage and are exposed only through a short-lived signed URL after entitlement checks.</p></div>
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
