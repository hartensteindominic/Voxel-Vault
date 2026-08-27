'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '@/lib/supabase-browser';
import type { SpatialAsset } from '@/lib/spatial-assets';
import { connectSpatialWallet, readWalletBalance, signWalletLinkMessage, spatialNetworkLabel } from '@/lib/web3-wallet';
import SpatialVaultWorld from '@/components/spatial/SpatialVaultWorld';
import SpatialWalletUI from '@/components/spatial/SpatialWalletUI';
import SpatialInspectPanel from '@/components/spatial/SpatialInspectPanel';
import styles from './space.module.css';

type WalletLink = {
  wallet_address: string;
  chain_id: number | null;
  verified_at: string;
};

function userLabel(user: any) {
  return String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'VoxelVault creator');
}

function googleReturnUrl() {
  const target = new URL('/vault/space', window.location.origin);
  target.searchParams.set('auth', 'google');
  return target.toString();
}

export default function SpatialVaultPage() {
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [assets, setAssets] = useState<SpatialAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'vault'|'gallery'>('vault');
  const [status, setStatus] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletChainId, setWalletChainId] = useState(0);
  const [walletBalance, setWalletBalance] = useState('0');
  const [walletLinks, setWalletLinks] = useState<WalletLink[]>([]);
  const accountClient = useRef<any>(null);
  const walletProvider = useRef<any>(null);

  const selectedAsset = useMemo(() => assets.find(asset => asset.id === selectedId) || null, [assets, selectedId]);
  const walletVerified = useMemo(() => walletLinks.some(link => link.wallet_address?.toLowerCase() === walletAddress.toLowerCase()), [walletLinks, walletAddress]);

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
      if (active) {
        setAuthReady(true);
        setStatus(error instanceof Error ? error.message : 'VoxelVault account sign-in is unavailable.');
      }
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  useEffect(() => {
    if (!session?.user || typeof window === 'undefined') return;
    const query = new URLSearchParams(window.location.search);
    if (query.get('auth') === 'google') {
      setStatus(`Signed in as ${userLabel(session.user)}. Loading your spatial vault…`);
      window.history.replaceState({}, '', '/vault/space');
    }
  }, [session?.user?.id]);

  const loadWalletLinks = useCallback(async (accessToken = session?.access_token) => {
    if (!accessToken) { setWalletLinks([]); return; }
    try {
      const response = await fetch('/api/wallet/link', { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await response.json().catch(() => ({}));
      if (response.ok) setWalletLinks(Array.isArray(data?.wallets) ? data.wallets : []);
    } catch {}
  }, [session?.access_token]);

  const loadAssets = useCallback(async (options: { sync?: boolean } = {}) => {
    const accessToken = session?.access_token;
    if (!accessToken) { setAssets([]); return; }
    setLoadingAssets(true);
    try {
      if (options.sync !== false) {
        const syncResponse = await fetch('/api/spatial-assets/sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!syncResponse.ok) {
          const syncData = await syncResponse.json().catch(() => ({}));
          throw new Error(syncData?.error || 'My Vault sync is unavailable.');
        }
      }
      const response = await fetch('/api/spatial-assets', { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'My Vault is unavailable.');
      const nextAssets = Array.isArray(data?.assets) ? data.assets : [];
      setAssets(nextAssets);
      const requested = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('asset') : '';
      if (requested && nextAssets.some((asset: SpatialAsset) => asset.id === requested)) setSelectedId(requested);
      else setSelectedId(current => current && nextAssets.some((asset: SpatialAsset) => asset.id === current) ? current : null);
      setStatus(nextAssets.length ? `Spatial Vault synced · ${nextAssets.length} creation${nextAssets.length === 1 ? '' : 's'} loaded.` : 'Your spatial vault is ready. Create or import your first 3D asset.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'My Vault is unavailable.');
    } finally {
      setLoadingAssets(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) { setAssets([]); setWalletLinks([]); return; }
    loadAssets({ sync: true });
    loadWalletLinks(session.access_token);
  }, [session?.access_token, loadAssets, loadWalletLinks]);

  async function signInGoogle() {
    setAccountBusy(true);
    setStatus('');
    try {
      const statusResponse = await fetch('/api/account/status', { cache: 'no-store' });
      const providerStatus = await statusResponse.json().catch(() => ({}));
      if (!statusResponse.ok || !providerStatus?.supabaseConfigured) throw new Error('VoxelVault account sign-in is not configured yet.');
      if (providerStatus.googleProviderEnabled !== true) throw new Error('Google sign-in is not enabled for VoxelVault yet.');
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
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setAssets([]); setSelectedId(null); setWalletLinks([]); setStatus('Signed out. Your server library remains attached to your account.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not sign out.');
    } finally { setAccountBusy(false); }
  }

  async function connectWallet() {
    setWalletBusy(true);
    setStatus('Connecting MetaMask…');
    try {
      const connection = await connectSpatialWallet();
      walletProvider.current = connection.provider;
      setWalletAddress(connection.address);
      setWalletChainId(connection.chainIdDecimal);
      const balance = await readWalletBalance(connection.provider, connection.address);
      setWalletBalance(balance.eth);
      await loadWalletLinks();
      setStatus(`Wallet connected on ${spatialNetworkLabel(connection.chainId)}. VoxelVault has not requested any transaction.`);
    } catch (error: any) {
      if (error?.code === 'NO_WALLET_PROVIDER' && error?.deepLink) {
        window.location.href = error.deepLink;
        return;
      }
      setStatus(error instanceof Error ? error.message : 'Wallet connection failed.');
    } finally { setWalletBusy(false); }
  }

  async function verifyWallet() {
    if (!session?.access_token) { setStatus('Sign in to VoxelVault before linking a wallet.'); return; }
    setWalletBusy(true);
    try {
      let address = walletAddress;
      let chainId = walletChainId;
      let provider = walletProvider.current;
      if (!address || !provider || !chainId) {
        const connection = await connectSpatialWallet();
        provider = connection.provider;
        address = connection.address;
        chainId = connection.chainIdDecimal;
        walletProvider.current = provider;
        setWalletAddress(address);
        setWalletChainId(chainId);
      }
      const challengeResponse = await fetch('/api/wallet/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ walletAddress: address, chainId }),
      });
      const challenge = await challengeResponse.json().catch(() => ({}));
      if (!challengeResponse.ok) throw new Error(challenge?.error || 'Wallet verification challenge failed.');
      setStatus('MetaMask will ask for a message signature only. This does not spend ETH or send a transaction.');
      const signature = await signWalletLinkMessage(provider, address, challenge.message);
      const linkResponse = await fetch('/api/wallet/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ challengeId: challenge.challengeId, signature }),
      });
      const linked = await linkResponse.json().catch(() => ({}));
      if (!linkResponse.ok) throw new Error(linked?.error || 'Wallet ownership verification failed.');
      await loadWalletLinks(session.access_token);
      setStatus(`Wallet verified for this VoxelVault account · audit ${String(linked.auditHash || '').slice(0, 12)}…`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Wallet ownership verification failed.');
    } finally { setWalletBusy(false); }
  }

  const selectAsset = useCallback((assetId: string) => {
    setSelectedId(assetId);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('asset', assetId);
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    } catch {}
  }, []);

  function closeInspect() {
    setSelectedId(null);
    try { window.history.replaceState({}, '', '/vault/space'); } catch {}
  }

  async function downloadAsset(asset: SpatialAsset) {
    if (!session?.access_token) return;
    setActionBusy(true);
    setStatus('Authorizing your private GLB download…');
    try {
      const response = await fetch('/api/spatial-assets/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ assetId: asset.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) throw new Error(data?.error || 'Download unavailable.');
      setStatus('Download authorized.');
      window.location.assign(data.url);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Download unavailable.');
    } finally { setActionBusy(false); }
  }

  async function toggleFavorite(asset: SpatialAsset) {
    if (!session?.access_token) return;
    setActionBusy(true);
    try {
      const response = await fetch('/api/spatial-assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: asset.id, favorite: !asset.favorite }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Could not update favorite.');
      setAssets(current => current.map(item => item.id === asset.id ? { ...item, favorite: !item.favorite, auditHash: data.auditHash || item.auditHash } : item));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update favorite.');
    } finally { setActionBusy(false); }
  }

  if (!authReady) return <main className={styles.page}><div className={styles.shell}><div className={styles.loading}>INITIALIZING VOXELVAULT SPATIAL…</div></div></main>;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <a className={styles.brand} href="/">VOXEL<span>VAULT</span></a>
          <div className={styles.navActions}>
            <a href="/creator">CREATE</a>
            <a href="/vault">MY VAULT</a>
            <a href="/vault-store">FOUNDRY</a>
            {session?.user && <button type="button" onClick={signOut} disabled={accountBusy}>SIGN OUT</button>}
          </div>
        </nav>

        <header className={styles.hero}>
          <div>
            <div className={styles.eyebrow}><i /> YOUR CREATIONS · ONE SPATIAL VAULT</div>
            <h1>Walk into<br/><em>your wallet.</em></h1>
            <p>Create, inspect, download and mint 3D assets without turning VoxelVault into a custodial wallet. Your account holds the library; MetaMask holds the keys.</p>
          </div>
          <div className={styles.heroAside}>3D ROOM · PRIVATE LIBRARY · VERIFIED WALLET LINKS · SERVER-VERIFIED MINT STATE · TAMPER-EVIDENT AUDIT CHAIN</div>
        </header>

        {!session?.user ? (
          <section className={styles.login}>
            <b>Enter your VoxelVault.</b>
            <p>Sign in to load the account-bound creation library. Connecting a blockchain wallet is optional and always non-custodial.</p>
            <button type="button" onClick={signInGoogle} disabled={accountBusy}>{accountBusy ? 'CONNECTING…' : 'CONTINUE WITH GOOGLE'}</button>
          </section>
        ) : (
          <>
            {loadingAssets ? <div className={styles.loading}>SYNCING CREATIONS · VERIFYING MINT STATE · BUILDING ROOM…</div> : (
              <>
                <SpatialVaultWorld assets={assets} selectedId={selectedId} mode={mode} onSelect={selectAsset} />
                <SpatialWalletUI
                  assets={assets}
                  accountName={userLabel(session.user)}
                  walletAddress={walletAddress}
                  chainLabel={spatialNetworkLabel(walletChainId)}
                  balanceEth={walletBalance}
                  walletVerified={walletVerified}
                  walletBusy={walletBusy}
                  mode={mode}
                  onModeChange={setMode}
                  onConnectWallet={connectWallet}
                  onVerifyWallet={verifyWallet}
                />
                {!assets.length && <section className={styles.empty}><div><h2>Your vault is empty.</h2><p>Create a VoxelPop asset or import a GLB. It will appear here as a pedestal you can inspect in 3D.</p><a href="/creator">CREATE YOUR FIRST ASSET →</a></div></section>}
                <SpatialInspectPanel
                  asset={selectedAsset}
                  busy={actionBusy}
                  accessToken={session.access_token}
                  walletAddress={walletAddress}
                  walletVerified={walletVerified}
                  onClose={closeInspect}
                  onDownload={downloadAsset}
                  onToggleFavorite={toggleFavorite}
                  onMintComplete={() => loadAssets({ sync: false })}
                />
              </>
            )}
          </>
        )}

        {status && <div className={styles.status} role="status" aria-live="polite">{status}</div>}
        <footer className={styles.footer}>
          <span>VOXELVAULT ACCOUNT INVENTORY ≠ PRIVATE-KEY CUSTODY · ALL SPENDING REQUIRES WALLET CONFIRMATION</span>
          <a href="/">← VOXELVAULT HOME</a>
        </footer>
      </div>
    </main>
  );
}
