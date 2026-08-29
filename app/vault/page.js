'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWalletIdentity } from '../components/WalletIdentity';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { mergeVoxelRecords, readLocalVoxelRecords, summarizeVoxel, syncLocalVoxelsToAccount } from '../../lib/voxelpop-account';
import styles from './vault-home.module.css';

const NFT_ABI = [
  'event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];
const CONTRACT = process.env.NEXT_PUBLIC_VOXEL_NFT_ADDRESS || '';

function mediaUrl(uri) {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  if (uri.startsWith('ar://')) return `https://arweave.net/${uri.slice(5)}`;
  return uri;
}

async function readMetadata(uri) {
  const url = mediaUrl(uri);
  if (!url) return null;
  if (url.startsWith('data:application/json')) {
    try { return JSON.parse(decodeURIComponent(url.split(',')[1])); } catch { return null; }
  }
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

async function loadOwnedWallet(address) {
  if (!window.ethereum || !CONTRACT) return { mode: 'not-configured', items: [] };
  const { BrowserProvider, Contract } = await import('ethers');
  const provider = new BrowserProvider(window.ethereum);
  const contract = new Contract(CONTRACT, NFT_ABI, provider);
  const logs = await contract.queryFilter(contract.filters.Transfer(null, address));
  const ids = [...new Set(logs.map((log) => log.args?.tokenId?.toString()).filter(Boolean))];
  const items = [];
  for (const tokenId of ids.slice(-60)) {
    try {
      const owner = await contract.ownerOf(tokenId);
      if (owner.toLowerCase() !== address.toLowerCase()) continue;
      let tokenUri = '';
      try { tokenUri = await contract.tokenURI(tokenId); } catch {}
      items.push({ tokenId, tokenUri, metadata: await readMetadata(tokenUri) });
    } catch {}
  }
  return { mode: 'on-chain', items: items.reverse() };
}

function readLocalVoxelsWithMints() {
  return readLocalVoxelRecords().map((record) => {
    if (record.payload?.mint?.tokenId || typeof window === 'undefined') return record;
    try {
      const mint = JSON.parse(window.localStorage.getItem(`voxelflip:mint:${record.sessionId}`) || 'null');
      if (!mint?.tokenId) return record;
      const updatedAt = new Date().toISOString();
      const payload = { ...record.payload, mint, updatedAt };
      window.localStorage.setItem(`voxelpop:${record.sessionId}`, JSON.stringify(payload));
      return { ...record, payload, updatedAt };
    } catch { return record; }
  });
}

function userName(user) {
  return String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Google account');
}

export default function VaultPage() {
  const { address, connected, connect } = useWalletIdentity();
  const [session, setSession] = useState(null);
  const [voxelRecords, setVoxelRecords] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [purchaseMode, setPurchaseMode] = useState('idle');
  const [walletState, setWalletState] = useState({ mode: 'idle', items: [] });
  const [accountStatus, setAccountStatus] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountSynced, setAccountSynced] = useState(false);
  const clientRef = useRef(null);

  const myVoxels = useMemo(() => voxelRecords.map(summarizeVoxel).filter((voxel) => voxel.image), [voxelRecords]);
  const shortWallet = useMemo(() => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '', [address]);

  async function loadPurchases(accessToken) {
    if (!accessToken) { setPurchases([]); setPurchaseMode('signed-out'); return; }
    setPurchaseMode('loading');
    try {
      const response = await fetch('/api/digital-estates/mine', { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Bought properties could not be loaded.');
      setPurchases(Array.isArray(data.owned) ? data.owned : []);
      setPurchaseMode('ready');
    } catch (error) {
      setPurchaseMode('error');
      setAccountStatus(String(error?.message || error || 'Bought properties could not be loaded.'));
    }
  }

  async function refreshWallet() {
    if (!address) { setWalletState({ mode: 'idle', items: [] }); return; }
    setWalletState({ mode: 'loading', items: [] });
    try { setWalletState(await loadOwnedWallet(address)); }
    catch { setWalletState({ mode: 'error', items: [] }); }
  }

  useEffect(() => { refreshWallet(); }, [address]);

  useEffect(() => {
    let active = true;
    let subscription = null;
    setVoxelRecords(readLocalVoxelsWithMints());

    async function apply(client, next) {
      if (!active) return;
      setSession(next || null);
      const local = readLocalVoxelsWithMints();
      if (!next?.user) {
        setAccountSynced(false);
        setVoxelRecords((current) => mergeVoxelRecords(current, local));
        setPurchases([]);
        setPurchaseMode('signed-out');
        return;
      }
      setAccountBusy(true);
      loadPurchases(next.access_token || '');
      try {
        const cloud = await syncLocalVoxelsToAccount(client, next.user);
        if (!active) return;
        setVoxelRecords(mergeVoxelRecords(cloud, readLocalVoxelsWithMints()));
        setAccountSynced(true);
        setAccountStatus(`Vault synced for ${userName(next.user)}.`);
        if (new URLSearchParams(window.location.search).get('auth') === 'google') window.history.replaceState({}, '', '/vault');
      } catch (error) {
        if (active) {
          setAccountSynced(false);
          setAccountStatus(String(error?.message || error || 'Signed in, but Creator Gallery sync needs attention.'));
        }
      } finally { if (active) setAccountBusy(false); }
    }

    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      await apply(client, data.session || null);
      const auth = client.auth.onAuthStateChange((_event, next) => apply(client, next));
      subscription = auth.data.subscription;
    }).catch((error) => {
      if (active) setAccountStatus(String(error?.message || error || 'Account sync is unavailable.'));
    });

    const refresh = async () => {
      const local = readLocalVoxelsWithMints();
      setVoxelRecords((current) => mergeVoxelRecords(current, local));
      if (session?.access_token) loadPurchases(session.access_token);
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('voxel-vault:creation-updated', refresh);
    return () => {
      active = false;
      subscription?.unsubscribe?.();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('voxel-vault:creation-updated', refresh);
    };
  }, []);

  async function signInGoogle() {
    setAccountBusy(true);
    setAccountStatus('Opening secure sign-in…');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: new URL('/vault?auth=google', window.location.origin).toString() } });
      if (error) throw error;
    } catch (error) {
      setAccountStatus(String(error?.message || error || 'Could not start sign-in.'));
      setAccountBusy(false);
    }
  }

  async function signOutGoogle() {
    setAccountBusy(true);
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setSession(null);
      setPurchases([]);
      setVoxelRecords(readLocalVoxelsWithMints());
      setAccountSynced(false);
      setAccountStatus('Signed out. Creations saved on this device remain visible here.');
    } catch (error) { setAccountStatus(String(error?.message || error)); }
    finally { setAccountBusy(false); }
  }

  return <main className={styles.page}>
    <section className={styles.shell}>
      <header className={styles.top}>
        <Link className={styles.brand} href="/"><span className={styles.brandMark}>V</span>Voxel Vault</Link>
        <nav className={styles.nav}><Link href="/property">Create</Link><Link href="/world">World</Link><Link href="/more">More</Link></nav>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>MY VAULT · SIMPLE ON PURPOSE</p>
        <h1>Your stuff.<br/><em>Actually organized.</em></h1>
        <p className={styles.heroCopy}>Start with what you bought and what you created. Purchased properties can become 3D voxel creations. Wallet, investment, and legal-property tools stay available without taking over the whole Vault.</p>
        <div className={styles.heroActions}><Link className={styles.primary} href="/vault/estates/mine">Bought property → 3D voxel</Link><Link className={styles.lime} href="/property">Create from my own photo</Link></div>
      </section>

      <section className={styles.summary} aria-label="Vault summary">
        <div className={styles.stat}><small>BOUGHT</small><strong>{session?.user && purchaseMode === 'ready' ? purchases.length : '—'}</strong><span>{session?.user ? 'Digital Estates' : 'Sign in to see'}</span></div>
        <div className={styles.stat}><small>CREATIONS</small><strong>{myVoxels.length}</strong><span>{accountSynced ? 'Google + this device' : 'This device'}</span></div>
        <div className={styles.stat}><small>PROPERTY VOXELS</small><strong>3D</strong><span>Photo creations</span></div>
        <div className={styles.stat}><small>WALLET</small><strong>{connected && walletState.mode === 'on-chain' ? walletState.items.length : '—'}</strong><span>{connected ? shortWallet : 'Optional'}</span></div>
      </section>

      <section className={styles.section} id="bought">
        <div className={styles.sectionHead}><div><small>01 · BOUGHT PROPERTIES</small><h2>Buy it. Then make it.</h2></div><p>A secured Digital Estate purchase is not supposed to stop at a receipt. Open one you bought and turn that purchased design into an interactive 3D voxel creation with no second creation charge.</p></div>
        {!session?.user ? <div className={styles.empty}><b>Sign in to see what you bought.</b><p>Purchased Digital Estates are account-bound, so Voxel Vault checks your signed-in identity before showing them or allowing voxel creation.</p><div className={styles.emptyActions}><button className={`${styles.button} ${styles.buttonPrimary}`} onClick={signInGoogle} disabled={accountBusy}>{accountBusy ? 'Opening…' : 'Continue with Google'}</button></div></div> : null}
        {session?.user && purchaseMode === 'loading' ? <div className={styles.status}>Loading your secured purchases…</div> : null}
        {session?.user && purchaseMode === 'ready' && purchases.length ? <div className={styles.grid}>{purchases.map((item) => <article className={styles.card} key={item.estate.id}>
          <div className={styles.estateVisual} style={{'--accent':item.estate.accent,'--terrain':item.estate.terrain,'--structure':item.estate.structure,'--roof':item.estate.roof}}><div className={styles.estateLand}/><div className={styles.estateHouse}><i className={styles.estateWindow}/><i className={styles.estateWindow}/><i className={styles.estateWindow}/></div><span className={styles.badge}>✓ BOUGHT</span></div>
          <div className={styles.cardBody}><small>{item.estate.locationLabel}</small><h3>{item.estate.name}</h3><p>{item.estate.summary}</p><Link className={styles.cardAction} href={`/vault/estates/mine/${encodeURIComponent(item.estate.id)}/voxel`}>Create my 3D voxel →</Link></div>
        </article>)}</div> : null}
        {session?.user && purchaseMode === 'ready' && !purchases.length ? <div className={styles.empty}><b>No bought Digital Estates yet.</b><p>When a secured purchase exists on this account, it will appear here with a direct 3D voxel button.</p><div className={styles.emptyActions}><Link className={styles.smallLink} href="/vault/earth">Explore properties</Link><Link className={styles.smallLink} href="/vault/estates/mine">Open bought properties</Link></div></div> : null}
      </section>

      <section className={styles.section} id="creations">
        <div className={styles.sectionHead}><div><small>02 · MY CREATIONS</small><h2>Everything you made.</h2></div><p>Photo-to-voxel creations and voxels made from purchased Digital Estate designs live in the same gallery instead of separate confusing places.</p></div>
        <div className={styles.accountRow}>
          {session?.user ? <><span className={styles.pill}>✓ {accountSynced ? 'GOOGLE SYNCED' : 'SIGNED IN'} · {userName(session.user)}</span><button className={styles.button} onClick={signOutGoogle} disabled={accountBusy}>Sign out</button></> : <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={signInGoogle} disabled={accountBusy}>Sync with Google</button>}
          <Link className={styles.smallLink} href="/property">+ Create property voxel</Link><Link className={styles.smallLink} href="/studio">+ Create another asset</Link>
        </div>
        {accountStatus ? <p className={styles.status}>{accountStatus}</p> : null}
        {myVoxels.length ? <div className={styles.grid}>{myVoxels.map((voxel) => {
          const minted = voxel.mint?.tokenId ? voxel.mint : null;
          const fromPurchase = voxel.source?.kind === 'digital-estate-purchase';
          const href = voxel.source?.href || (minted ? `/voxelflip/mint?session_id=${encodeURIComponent(voxel.sessionId)}` : `/pack/success?session_id=${encodeURIComponent(voxel.sessionId)}`);
          return <article className={styles.card} key={voxel.sessionId}><img className={styles.image} src={voxel.image} alt={voxel.name.replaceAll('-', ' ')} loading="lazy"/><div className={styles.cardBody}><small>{fromPurchase ? 'BOUGHT PROPERTY → VOXEL' : minted ? `MINTED · #${minted.tokenId}` : voxel.meshStatus === 'ready' ? '3D CREATION' : 'PAID CREATION'}</small><h3>{voxel.name.replaceAll('-', ' ')}</h3><p>{fromPurchase ? 'Created from a secured Digital Estate purchase.' : 'Your saved VoxelPop creation.'}</p><Link className={`${styles.cardAction} ${fromPurchase ? styles.cardActionSecondary : ''}`} href={href}>{fromPurchase ? 'Open 3D voxel →' : 'Open creation →'}</Link></div></article>;
        })}</div> : <div className={styles.empty}><b>Your creation gallery is empty.</b><p>Create from your own property photo, or open a Digital Estate you bought and turn it into a voxel.</p><div className={styles.emptyActions}><Link className={styles.smallLink} href="/property">Create from photo</Link><Link className={styles.smallLink} href="/vault/estates/mine">Use one I bought</Link></div></div>}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><small>03 · PROPERTY + WORLD</small><h2>Keep the property tools obvious.</h2></div><p>Your saved photo-based property voxels, map placement, and World view are separate from legal title and separate from optional NFT minting.</p></div>
        <div className={styles.shortcutGrid}>
          <Link className={styles.shortcut} href="/vault/property-drafts"><span>◇</span><b>My property voxels</b><p>Open saved 3D property creations, share them to World, or continue to optional verification/minting.</p></Link>
          <Link className={styles.shortcut} href="/world"><span>◎</span><b>My World</b><p>See the property voxels you placed on the map without confusing map placement with ownership.</p></Link>
          <Link className={styles.shortcut} href="/property"><span>+</span><b>Create another</b><p>Photo → $4.99 → recognizable 3D preview → 3D voxel → optional mint.</p></Link>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><small>04 · WALLET · OPTIONAL</small><h2>Blockchain when you want it.</h2></div><p>Your Vault works without a wallet. Connect only if you want to verify and display Voxel Vault collectibles currently owned by that wallet.</p></div>
        <div className={styles.walletWrap}>
          <div className={styles.walletPanel}><h3>{connected ? `Connected · ${shortWallet}` : 'Wallet not connected'}</h3><p>{connected ? 'Voxel Vault checks the configured NFT contract before showing a token as owned.' : 'Creating, buying a Digital Estate, making its voxel, and saving creations do not require a crypto wallet.'}</p><div className={styles.emptyActions}>{!connected ? <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={connect}>Connect wallet · optional</button> : <button className={styles.button} onClick={refreshWallet}>Refresh ownership</button>}<Link className={styles.smallLink} href="/room">Open My Room</Link></div></div>
          <div>{walletState.mode === 'loading' ? <p className={styles.status}>Checking wallet ownership…</p> : null}{connected && walletState.mode === 'not-configured' ? <p className={styles.status}>The Voxel Vault collection contract is not configured here, so the Vault will not invent wallet-owned items.</p> : null}{connected && walletState.mode === 'on-chain' && !walletState.items.length ? <div className={styles.empty}><b>No verified collectibles found.</b><p>Only tokens the configured contract reports as owned by this wallet appear here.</p></div> : null}{walletState.mode === 'on-chain' && walletState.items.length ? <div className={styles.walletCards}>{walletState.items.slice(0,6).map((item) => { const metadata=item.metadata||{}; const image=mediaUrl(metadata.image||metadata.image_url||''); return <article className={styles.walletCard} key={item.tokenId}>{image ? <img src={image} alt={metadata.name||`Voxel #${item.tokenId}`}/> : null}<b>{metadata.name||`Voxel #${item.tokenId}`}</b><span>Owner verified · token #{item.tokenId}</span></article>; })}</div> : null}</div>
        </div>
      </section>

      <section className={styles.advanced}><div><h3>Money + legal property are advanced, not the main Vault.</h3><p>Provider-backed investments, real-property verification, and owner tools still exist, but they stay clearly separated from ordinary digital creations.</p></div><div className={styles.advancedLinks}><Link href="/real-estate/reits">Investments</Link><Link href="/real-estate">Real property</Link><Link href="/more">All tools</Link></div></section>
      <p className={styles.truth}><b>One Vault, different kinds of truth.</b> A purchased Digital Estate, a 3D voxel, an NFT, a map marker, a security position, and a recorded deed are not interchangeable. Voxel Vault keeps the creative experience connected without pretending the legal rights are the same.</p>
    </section>
  </main>;
}
