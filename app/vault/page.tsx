'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '@/lib/supabase-browser';
import type { SpatialAsset } from '@/lib/spatial-assets';
import { spatialAssetStatusLabel } from '@/lib/spatial-assets';
import styles from './vault.module.css';

type Filter = 'all' | 'minted' | 'unminted' | 'favorites';

function userLabel(user: any) {
  return String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'VoxelVault creator');
}

function googleReturnUrl() {
  const target = new URL('/vault', window.location.origin);
  target.searchParams.set('auth', 'google');
  return target.toString();
}

export default function MyVaultPage() {
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<SpatialAsset[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [status, setStatus] = useState('');
  const [actionId, setActionId] = useState('');
  const accountClient = useRef<any>(null);

  const visible = useMemo(() => assets.filter(asset => {
    if (filter === 'minted') return asset.state === 'minted';
    if (filter === 'unminted') return asset.state !== 'minted';
    if (filter === 'favorites') return asset.favorite;
    return true;
  }), [assets, filter]);

  useEffect(() => {
    let active = true;
    let subscription: any = null;
    getSupabaseBrowserAsync().then(async client => {
      if (!active) return;
      accountClient.current = client;
      const { data, error } = await client.auth.getSession();
      if (!active) return;
      if (error) setStatus(error.message);
      setSession(data?.session || null);
      setAuthReady(true);
      const auth = client.auth.onAuthStateChange((_event: string, next: any) => {
        if (active) { setSession(next); setAuthReady(true); }
      });
      subscription = auth.data.subscription;
    }).catch(error => {
      if (active) { setAuthReady(true); setStatus(error instanceof Error ? error.message : 'Account sign-in unavailable.'); }
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  const load = useCallback(async (sync = true) => {
    const token = session?.access_token;
    if (!token) { setAssets([]); return; }
    setLoading(true);
    try {
      if (sync) {
        const syncResponse = await fetch('/api/spatial-assets/sync', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        if (!syncResponse.ok) {
          const data = await syncResponse.json().catch(() => ({}));
          throw new Error(data?.error || 'Could not sync your VoxelPop creations.');
        }
      }
      const response = await fetch('/api/spatial-assets', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'My Vault is unavailable.');
      setAssets(Array.isArray(data?.assets) ? data.assets : []);
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'My Vault is unavailable.');
    } finally { setLoading(false); }
  }, [session?.access_token]);

  useEffect(() => { if (session?.access_token) load(true); else setAssets([]); }, [session?.access_token, load]);

  async function signInGoogle() {
    setAccountBusy(true);
    try {
      const statusResponse = await fetch('/api/account/status', { cache: 'no-store' });
      const providerStatus = await statusResponse.json().catch(() => ({}));
      if (!statusResponse.ok || !providerStatus?.supabaseConfigured || providerStatus.googleProviderEnabled !== true) throw new Error('Google sign-in is not configured for VoxelVault yet.');
      const client = accountClient.current || await getSupabaseBrowserAsync();
      accountClient.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: googleReturnUrl() } });
      if (error) throw error;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not start Google sign-in.');
      setAccountBusy(false);
    }
  }

  async function signOut() {
    setAccountBusy(true);
    try {
      const client = accountClient.current || await getSupabaseBrowserAsync();
      await client.auth.signOut();
      setAssets([]);
    } finally { setAccountBusy(false); }
  }

  async function toggleFavorite(asset: SpatialAsset) {
    if (!session?.access_token) return;
    setActionId(asset.id);
    try {
      const response = await fetch('/api/spatial-assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: asset.id, favorite: !asset.favorite }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Could not update favorite.');
      setAssets(current => current.map(item => item.id === asset.id ? { ...item, favorite: !item.favorite, auditHash: data.auditHash || item.auditHash } : item));
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not update favorite.'); }
    finally { setActionId(''); }
  }

  async function download(asset: SpatialAsset) {
    if (!session?.access_token) return;
    setActionId(asset.id);
    try {
      const response = await fetch('/api/spatial-assets/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ assetId: asset.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) throw new Error(data?.error || 'Download unavailable.');
      window.location.assign(data.url);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Download unavailable.'); }
    finally { setActionId(''); }
  }

  if (!authReady) return <main className={styles.page}><div className={styles.loading}>LOADING MY VAULT…</div></main>;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <a href="/" className={styles.brand}>VOXEL<span>VAULT</span></a>
          <div className={styles.navActions}>
            <a href="/creator">CREATE</a>
            <a href="/vault/space">3D VAULT</a>
            <a href="/vault-store">FOUNDRY</a>
            {session?.user && <button type="button" onClick={signOut} disabled={accountBusy}>SIGN OUT</button>}
          </div>
        </nav>

        <header className={styles.header}>
          <div>
            <div className={styles.kicker}>MY CREATIONS · ACCOUNT-BOUND LIBRARY</div>
            <h1>Your 3D life,<br/><em>in one vault.</em></h1>
            <p>Every saved voxel, imported GLB and server-verified NFT can live here. Use this fast library on any device or enter the immersive room when you want the full spatial experience.</p>
          </div>
          <aside className={styles.spaceCta}><b>Walk inside your collection.</b><p>Open the same library as a live 3D vault with pedestals, wallet HUD and inspect mode.</p><a href="/vault/space">ENTER 3D VAULT →</a></aside>
        </header>

        {!session?.user ? (
          <section className={styles.login}><h2>Connect your VoxelVault account.</h2><p>Your creation library is private and account-bound. MetaMask is optional and never stores keys here.</p><button type="button" onClick={signInGoogle} disabled={accountBusy}>{accountBusy ? 'CONNECTING…' : 'CONTINUE WITH GOOGLE'}</button></section>
        ) : loading ? <div className={styles.loading}>SYNCING YOUR CREATIONS…</div> : (
          <>
            <div className={styles.toolbar}>
              <div className={styles.filters}>
                {(['all','minted','unminted','favorites'] as Filter[]).map(value => <button type="button" key={value} className={filter === value ? styles.active : ''} onClick={() => setFilter(value)}>{value.toUpperCase()}</button>)}
              </div>
              <span>{visible.length} OF {assets.length} ITEMS</span>
            </div>

            {visible.length ? <section className={styles.grid}>
              {visible.map(asset => (
                <article className={styles.card} key={asset.id}>
                  <div className={styles.visual}>
                    {asset.imageUrl ? <img src={asset.imageUrl} alt={`${asset.title} preview`} /> : <div className={styles.placeholder} />}
                    <button type="button" className={styles.favorite} onClick={() => toggleFavorite(asset)} disabled={actionId === asset.id} aria-label={asset.favorite ? 'Remove favorite' : 'Add favorite'}>{asset.favorite ? '★' : '☆'}</button>
                    <span className={`${styles.state} ${asset.state === 'minted' ? styles.minted : ''}`}>{spatialAssetStatusLabel(asset)}</span>
                  </div>
                  <div className={styles.body}>
                    <h2>{asset.title}</h2>
                    <p>{asset.description || asset.prompt || 'A creation saved in your VoxelVault account.'}</p>
                    <div className={styles.meta}><span>{asset.sourceKind.toUpperCase()}</span><span>{asset.collectionName}</span>{asset.chainId ? <span>{asset.chainId === 84532 ? 'BASE SEPOLIA' : asset.chainId === 8453 ? 'BASE' : `CHAIN ${asset.chainId}`}</span> : null}</div>
                    <div className={styles.actions}>
                      <a className={styles.primary} href={`/vault/space?asset=${encodeURIComponent(asset.id)}`}>INSPECT IN 3D</a>
                      {(asset.modelUrl || asset.sourceTaskId) && <button type="button" className={styles.secondary} onClick={() => download(asset)} disabled={actionId === asset.id}>↓</button>}
                    </div>
                  </div>
                </article>
              ))}
            </section> : <section className={styles.empty}><h2>{assets.length ? 'No items match this filter.' : 'Your vault is ready.'}</h2><p>{assets.length ? 'Choose another filter to see more creations.' : 'Create a voxel or import a GLB to place your first 3D object in My Vault.'}</p>{!assets.length && <a href="/creator">CREATE OR IMPORT →</a>}</section>}
          </>
        )}
        {status && <div className={styles.status} role="status" aria-live="polite">{status}</div>}
      </div>
    </main>
  );
}
