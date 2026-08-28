'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useWalletIdentity } from '../components/WalletIdentity';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { mergeVoxelRecords, readLocalVoxelRecords, summarizeVoxel, syncLocalVoxelsToAccount } from '../../lib/voxelpop-account';
import { buildVaultManifest, summarizeVaultManifest } from '../../lib/vault/manifest';
import UnifiedVaultCanvas from './UnifiedVaultCanvas';

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
  } catch {
    return null;
  }
}

async function loadOwned(address) {
  if (!window.ethereum || !CONTRACT) return { mode: 'not-configured', items: [] };
  const { BrowserProvider, Contract } = await import('ethers');
  const provider = new BrowserProvider(window.ethereum);
  const contract = new Contract(CONTRACT, NFT_ABI, provider);
  const logs = await contract.queryFilter(contract.filters.Transfer(null, address));
  const ids = [...new Set(logs.map((log) => log.args?.tokenId?.toString()).filter(Boolean))];
  const items = [];

  for (const tokenId of ids.slice(-100)) {
    try {
      const owner = await contract.ownerOf(tokenId);
      if (owner.toLowerCase() !== address.toLowerCase()) continue;
      let tokenUri = '';
      try { tokenUri = await contract.tokenURI(tokenId); } catch {}
      items.push({ tokenId, tokenUri, metadata: await readMetadata(tokenUri), contract: CONTRACT });
    } catch {}
  }

  return { mode: 'on-chain', items: items.reverse() };
}

function readLocalVoxelsWithMints() {
  const records = readLocalVoxelRecords();
  if (typeof window === 'undefined') return records;
  return records.map((record) => {
    if (record.payload?.mint?.tokenId) return record;
    try {
      const mint = JSON.parse(window.localStorage.getItem(`voxelflip:mint:${record.sessionId}`) || 'null');
      if (!mint?.tokenId) return record;
      const updatedAt = new Date().toISOString();
      const payload = { ...record.payload, mint, updatedAt };
      try { window.localStorage.setItem(`voxelpop:${record.sessionId}`, JSON.stringify(payload)); } catch {}
      return { ...record, payload, updatedAt };
    } catch {
      return record;
    }
  });
}

function userName(user) {
  return String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Google account');
}

function googleReturnUrl() {
  return new URL('/vault?auth=google', window.location.origin).toString();
}

function positivePositions(snapshot) {
  return (Array.isArray(snapshot?.portfolio) ? snapshot.portfolio : []).filter((position) => Number(position?.amount || 0) > 0);
}

export default function VaultPage() {
  const { address, connected, connect } = useWalletIdentity();
  const [walletState, setWalletState] = useState({ mode: 'idle', items: [] });
  const [walletError, setWalletError] = useState('');
  const [voxelRecords, setVoxelRecords] = useState([]);
  const [session, setSession] = useState(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountStatus, setAccountStatus] = useState('');
  const [accountSynced, setAccountSynced] = useState(false);
  const accountClient = useRef(null);
  const [reitState, setReitState] = useState({ mode: 'loading', snapshot: null, error: '' });

  const shortWallet = useMemo(() => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '', [address]);
  const myVoxels = useMemo(() => voxelRecords.map(summarizeVoxel).filter((voxel) => voxel.image), [voxelRecords]);
  const reitPositions = useMemo(() => positivePositions(reitState.snapshot), [reitState.snapshot]);

  const manifest = useMemo(() => buildVaultManifest({
    creations: myVoxels,
    collectibles: walletState.items,
    reitPositions,
    creatorSource: accountSynced ? 'google-synced' : 'browser-library',
    walletAddress: address,
    provider: reitState.snapshot?.provider || 'Dinari',
    providerEnvironment: reitState.snapshot?.environment || 'sandbox',
  }), [myVoxels, walletState.items, reitPositions, accountSynced, address, reitState.snapshot?.provider, reitState.snapshot?.environment]);
  const summary = useMemo(() => summarizeVaultManifest(manifest), [manifest]);

  async function refreshWallet() {
    if (!address) {
      setWalletState({ mode: 'idle', items: [] });
      return;
    }
    setWalletError('');
    setWalletState({ mode: 'loading', items: [] });
    try {
      setWalletState(await loadOwned(address));
    } catch (error) {
      setWalletError(error?.message || 'Could not read your on-chain collection.');
      setWalletState({ mode: 'error', items: [] });
    }
  }

  async function refreshReits() {
    setReitState((current) => ({ ...current, mode: 'loading', error: '' }));
    try {
      const response = await fetch('/api/digital-reits', { cache: 'no-store' });
      const snapshot = await response.json();
      if (!response.ok) throw new Error(snapshot?.error || 'Could not read the Digital REIT provider snapshot.');
      setReitState({ mode: 'ready', snapshot, error: '' });
    } catch (error) {
      setReitState({ mode: 'error', snapshot: null, error: error?.message || 'Could not read the Digital REIT provider snapshot.' });
    }
  }

  useEffect(() => {
    setVoxelRecords(readLocalVoxelsWithMints());
    refreshReits();
  }, []);

  useEffect(() => {
    refreshWallet();
  }, [address]);

  useEffect(() => {
    const refresh = () => refreshWallet();
    window.addEventListener('voxel-vault:transaction-confirmed', refresh);
    window.addEventListener('voxel-vault:wallet-updated', refresh);
    return () => {
      window.removeEventListener('voxel-vault:transaction-confirmed', refresh);
      window.removeEventListener('voxel-vault:wallet-updated', refresh);
    };
  }, [address]);

  useEffect(() => {
    let active = true;
    let subscription = null;

    async function apply(client, next) {
      if (!active) return;
      setSession(next);
      const local = readLocalVoxelsWithMints();
      if (!next?.user) {
        setAccountSynced(false);
        setVoxelRecords((current) => mergeVoxelRecords(current, local));
        return;
      }

      setAccountBusy(true);
      try {
        const cloud = await syncLocalVoxelsToAccount(client, next.user);
        if (!active) return;
        setVoxelRecords(mergeVoxelRecords(cloud, readLocalVoxelsWithMints()));
        setAccountSynced(true);
        setAccountStatus(`Creator Gallery synced for ${userName(next.user)}.`);
        if (new URLSearchParams(window.location.search).get('auth') === 'google') {
          window.history.replaceState({}, '', '/vault#creator-gallery');
        }
      } catch (error) {
        if (active) {
          setAccountSynced(false);
          setAccountStatus(error instanceof Error ? error.message : 'Google connected, but Creator Gallery could not sync.');
        }
      } finally {
        if (active) setAccountBusy(false);
      }
    }

    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      accountClient.current = client;
      const { data, error } = await client.auth.getSession();
      if (error && active) setAccountStatus(error.message);
      else await apply(client, data.session);
      const auth = client.auth.onAuthStateChange((_event, next) => { apply(client, next); });
      subscription = auth.data.subscription;
    }).catch((error) => {
      if (active) setAccountStatus(error instanceof Error ? error.message : 'Google account setup is incomplete.');
    });

    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const refresh = async () => {
      const local = readLocalVoxelsWithMints();
      setVoxelRecords((current) => mergeVoxelRecords(current, local));
      if (session?.user && accountClient.current) {
        try {
          const cloud = await syncLocalVoxelsToAccount(accountClient.current, session.user);
          setVoxelRecords(mergeVoxelRecords(cloud, readLocalVoxelsWithMints()));
          setAccountSynced(true);
        } catch {}
      }
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [session?.user?.id]);

  async function signInGoogle() {
    setAccountStatus('');
    setAccountBusy(true);
    try {
      const statusResponse = await fetch('/api/account/status', { cache: 'no-store' });
      const status = await statusResponse.json().catch(() => ({}));
      if (!statusResponse.ok || !status?.supabaseConfigured) throw new Error('Google sign-in still needs the Voxel Vault Supabase public configuration.');
      if (status.googleProviderEnabled !== true) throw new Error('Google sign-in is connected to Supabase, but the Google provider is not enabled yet.');
      const client = accountClient.current || await getSupabaseBrowserAsync();
      accountClient.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: googleReturnUrl() } });
      if (error) throw error;
    } catch (error) {
      setAccountStatus(error instanceof Error ? error.message : 'Could not start Google sign-in.');
      setAccountBusy(false);
    }
  }

  async function signOutGoogle() {
    setAccountBusy(true);
    try {
      const client = accountClient.current || await getSupabaseBrowserAsync();
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setSession(null);
      setAccountSynced(false);
      setVoxelRecords(readLocalVoxelsWithMints());
      setAccountStatus('Signed out of Google. Browser-local creations are still visible on this device.');
    } catch (error) {
      setAccountStatus(error instanceof Error ? error.message : 'Could not sign out.');
    } finally {
      setAccountBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#05060c] text-white px-4 py-5 md:px-8 md:py-8">
      <section className="max-w-7xl mx-auto">
        <nav className="flex items-center justify-between gap-4 flex-wrap">
          <Link href="/" className="flex items-center gap-2 no-underline text-white font-black tracking-[-.03em]">
            <span className="w-9 h-9 rounded-xl bg-white text-black grid place-items-center">V</span>
            Voxel Vault
          </Link>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Link href="/studio" className="rounded-full border border-white/10 px-4 py-2 text-white/75 no-underline">Create 3D</Link>
            <Link href="/real-estate/reits" className="rounded-full border border-white/10 px-4 py-2 text-white/75 no-underline">Digital REITs</Link>
            <Link href="/real-estate" className="rounded-full border border-white/10 px-4 py-2 text-white/75 no-underline">Real Property</Link>
          </div>
        </nav>

        <header className="pt-16 pb-9 md:pt-24 md:pb-12 max-w-5xl">
          <div className="text-[10px] tracking-[.28em] font-black text-white/45">MY VAULT · ONE SPATIAL ASSET HOME</div>
          <h1 className="text-5xl md:text-8xl font-black tracking-[-.075em] leading-[.86] mt-4">Everything you can prove,<br /><span className="text-white/45">in one Vault.</span></h1>
          <p className="text-base md:text-lg text-white/55 leading-7 max-w-3xl mt-7">
            Your Creator Gallery, wallet-verified collectibles and provider-reported Digital REIT positions now share one spatial home—without pretending those asset types are legally the same thing.
          </p>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <TruthStat label="CREATOR GALLERY" value={summary.creations} note={accountSynced ? 'Google-synced + browser' : 'This browser'} />
          <TruthStat label="WALLET COLLECTION" value={connected ? summary.collectibles : '—'} note={connected ? `${shortWallet} · ownerOf checked` : 'Wallet optional'} />
          <TruthStat label="DIGITAL REITS" value={reitState.mode === 'ready' ? summary.digitalReits : '—'} note={reitState.snapshot?.credentialsConfigured ? `${reitState.snapshot.provider} ${String(reitState.snapshot.environment || '').toUpperCase()} account` : 'Provider pilot'} />
          <TruthStat label="DIRECT PROPERTY" value="LOCKED" note="No deed claim in My Vault" />
        </section>

        <UnifiedVaultCanvas entries={manifest} />

        <section className="mt-5 grid md:grid-cols-3 gap-3">
          <TruthCard title="Creator asset" copy="A paid/3D/minted creation from VoxelPop. It can be yours as a digital asset without being a financial security or property interest." />
          <TruthCard title="Digital REIT / dShare" copy="A security position returned by the configured provider account. It is not ownership of a specific house or recorded deed." />
          <TruthCard title="Direct property" copy="The property wing stays locked until holder identity, legal entity rights, title, compliance and verified property-interest records can be bound correctly." />
        </section>

        <section id="creator-gallery" className="mt-20 scroll-mt-8">
          <SectionHeading eyebrow="WING 01 · CREATOR GALLERY" title="Things you made." copy="This wing reads the same My Voxels library used by Studio. Google sync extends that library across devices; it does not create a second asset database." />
          <div className="flex items-center gap-3 flex-wrap mb-6">
            {session?.user ? (
              <>
                <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-4 py-2 text-xs font-bold">GOOGLE SYNCED · {userName(session.user)}</span>
                <button onClick={signOutGoogle} disabled={accountBusy} className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/70 disabled:opacity-40">Sign out</button>
              </>
            ) : (
              <button onClick={signInGoogle} disabled={accountBusy} className="rounded-full bg-white text-black px-5 py-2.5 text-xs font-black disabled:opacity-40">{accountBusy ? 'CONNECTING…' : 'SYNC CREATOR GALLERY WITH GOOGLE'}</button>
            )}
            <Link href="/studio" className="rounded-full border border-white/10 px-4 py-2.5 text-xs text-white/75 no-underline">Create another voxel →</Link>
          </div>
          {accountStatus ? <div className="mb-5 rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-xs text-white/65">{accountStatus}</div> : null}
          {myVoxels.length ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {myVoxels.map((voxel) => {
                const minted = voxel.mint?.tokenId ? voxel.mint : null;
                const ready = voxel.meshStatus === 'ready';
                const href = minted ? `/voxelflip/mint?session_id=${encodeURIComponent(voxel.sessionId)}` : `/pack/success?session_id=${encodeURIComponent(voxel.sessionId)}`;
                return (
                  <article key={voxel.sessionId} className="overflow-hidden rounded-3xl border border-violet-300/15 bg-violet-300/[.035]">
                    <img src={voxel.image} alt={voxel.name.replaceAll('-', ' ')} className="w-full aspect-square object-cover bg-black/30" loading="lazy" />
                    <div className="p-4">
                      <div className="text-[9px] tracking-[.15em] font-black text-violet-200/60">{minted ? `MINTED · #${minted.tokenId}` : ready ? '3D CREATION' : 'PAID CREATION'}</div>
                      <h3 className="font-bold text-lg mt-1 capitalize">{voxel.name.replaceAll('-', ' ')}</h3>
                      <Link href={href} className="inline-flex mt-4 rounded-full bg-white text-black px-4 py-2 text-xs font-black no-underline">Open asset →</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="✦" title="Your Creator Gallery is ready." copy="Paid VoxelPop creations from this browser—or your Google-synced account after sign-in—will appear here." href="/studio" action="Create a 3D asset" />
          )}
        </section>

        <section id="wallet-collection" className="mt-20 scroll-mt-8">
          <SectionHeading eyebrow="WING 02 · WALLET COLLECTION" title="Things your wallet can prove." copy="This wing is optional. Voxel Vault checks the configured NFT contract and calls ownerOf before showing a collectible as wallet-owned." />
          <div className="flex items-center gap-3 flex-wrap mb-6">
            {!connected ? (
              <button onClick={connect} className="rounded-full bg-cyan-200 text-slate-950 px-5 py-2.5 text-xs font-black">CONNECT COLLECTION WALLET</button>
            ) : (
              <>
                <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-2 text-xs font-bold">CONNECTED · {shortWallet}</span>
                <button onClick={refreshWallet} className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/70">Refresh ownership</button>
              </>
            )}
          </div>
          {walletError ? <div role="alert" className="mb-5 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100">{walletError}</div> : null}
          {walletState.mode === 'loading' ? <LoadingGrid /> : null}
          {walletState.mode === 'not-configured' ? <EmptyState icon="◇" title="On-chain collection contract is not configured." copy="Voxel Vault will not substitute demos for wallet ownership." /> : null}
          {!connected ? <EmptyState icon="◇" title="Wallet connection is optional." copy="Connect only if you want the Vault to verify and display collectibles held by that wallet. Your Creator Gallery does not depend on this." /> : null}
          {walletState.mode === 'on-chain' && !walletState.items.length ? <EmptyState icon="◇" title="No verified Voxel Vault collectibles found." copy="A collectible appears here only after the configured contract reports this connected wallet as its current owner." href="/marketplace" action="Explore Voxel Vault" /> : null}
          {walletState.mode === 'on-chain' && walletState.items.length ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {walletState.items.map((item) => {
                const metadata = item.metadata || {};
                const image = mediaUrl(metadata.image || metadata.image_url || metadata.imageUrl || '');
                const model = mediaUrl(metadata.animation_url || metadata.model_url || metadata.modelUrl || '');
                return (
                  <article key={item.tokenId} className="overflow-hidden rounded-3xl border border-cyan-200/15 bg-cyan-200/[.035]">
                    <div className="aspect-square bg-black/40 relative overflow-hidden">
                      {image ? <img src={image} alt={metadata.name || `Digital twin #${item.tokenId}`} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full grid place-items-center text-6xl">◇</div>}
                      {model ? <a href={model} target="_blank" rel="noreferrer" className="absolute bottom-3 right-3 rounded-full bg-black/75 border border-white/15 px-3 py-2 text-xs backdrop-blur no-underline text-white">3D ↗</a> : null}
                    </div>
                    <div className="p-5">
                      <div className="text-[9px] tracking-[.16em] font-black text-cyan-100/55">ON-CHAIN OWNER VERIFIED</div>
                      <h3 className="text-xl font-bold mt-2">{metadata.name || `Voxel #${item.tokenId}`}</h3>
                      <p className="text-sm text-white/45 mt-1">Token #{item.tokenId}</p>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Link href={`/room?tokenId=${encodeURIComponent(item.tokenId)}`} className="rounded-full bg-white text-black px-4 py-2 text-xs font-black no-underline">Place in Room</Link>
                        {item.tokenUri ? <a href={mediaUrl(item.tokenUri)} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/70 no-underline">Metadata ↗</a> : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>

        <section id="digital-reits" className="mt-20 scroll-mt-8">
          <SectionHeading eyebrow="WING 03 · DIGITAL REIT DISTRICT" title="Provider-reported real-estate exposure." copy="This pilot wing deliberately shows only positive positions returned by the configured Dinari account. The configured provider account is not yet bound to every Voxel Vault login, so the UI says exactly which account source it is showing instead of calling the position yours by assumption." />
          <div className="flex items-center gap-3 flex-wrap mb-6">
            <span className="rounded-full border border-lime-200/20 bg-lime-200/10 px-4 py-2 text-xs font-bold">{reitState.snapshot?.provider || 'DINARI'} · {String(reitState.snapshot?.environment || 'sandbox').toUpperCase()} · CONFIGURED PROVIDER ACCOUNT</span>
            <button onClick={refreshReits} disabled={reitState.mode === 'loading'} className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/70 disabled:opacity-40">{reitState.mode === 'loading' ? 'REFRESHING…' : 'Refresh provider'}</button>
            <Link href="/real-estate/reits" className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/70 no-underline">Open Digital REIT Vault →</Link>
          </div>
          {reitState.error ? <div role="alert" className="mb-5 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100">{reitState.error}</div> : null}
          {reitState.mode === 'loading' ? <LoadingGrid /> : null}
          {reitState.mode === 'ready' && reitPositions.length ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {reitPositions.map((position, index) => (
                <article key={position.stockId || `${position.symbol}-${index}`} className="rounded-3xl border border-lime-200/15 bg-lime-200/[.035] p-5">
                  <div className="text-[9px] tracking-[.16em] font-black text-lime-100/55">PROVIDER POSITION REPORTED</div>
                  <div className="text-4xl font-black tracking-[-.06em] mt-3">{String(position.symbol || 'REIT').toUpperCase()}</div>
                  <div className="text-sm text-white/45 mt-1 truncate">{position.name || 'Tokenized real-estate security'}</div>
                  <div className="mt-6 rounded-2xl bg-black/25 p-4">
                    <div className="text-[9px] tracking-[.14em] font-black text-white/35">POSITION</div>
                    <div className="text-xl font-bold mt-1">{Number(position.amount || 0).toFixed(6)} units</div>
                  </div>
                  <p className="text-[11px] leading-5 text-white/40 mt-4">Security position · not a deed · not direct ownership of a specific property.</p>
                </article>
              ))}
            </div>
          ) : null}
          {reitState.mode === 'ready' && !reitPositions.length ? (
            <EmptyState icon="▥" title="No provider-reported Digital REIT position is currently held." copy={reitState.snapshot?.credentialsConfigured ? 'The provider connection is available, but Voxel Vault will not light up a building until the configured account reports a positive position.' : 'Connect the Dinari sandbox through the protected owner workflow first. Voxel Vault does not invent provider holdings.'} href="/real-estate/reits" action="Open Digital REIT Vault" />
          ) : null}
        </section>

        <section id="direct-property" className="mt-20 mb-16 scroll-mt-8">
          <SectionHeading eyebrow="WING 04 · DIRECT PROPERTY" title="Locked until the legal rights are real." copy="A house-shaped object is not enough. This wing will only admit a direct-property interest after Voxel Vault can bind the verified legal/property structure to an eligible holder without confusing a Property Passport with the deed." />
          <div className="rounded-[32px] border border-amber-200/15 bg-amber-200/[.035] p-7 md:p-10 grid lg:grid-cols-[1.1fr_.9fr] gap-8 items-center">
            <div>
              <div className="text-[10px] tracking-[.16em] font-black text-amber-100/55">FAIL-CLOSED PROPERTY GATE</div>
              <h3 className="text-3xl md:text-5xl font-black tracking-[-.055em] mt-3">No deed-linked position is being claimed here yet.</h3>
              <p className="text-white/50 leading-7 mt-5 max-w-2xl">The direct-property sequence remains: recorded deed → property entity → executed legal rights → eligible holder → permissioned blockchain record → Property Passport / spatial twin. The visual asset comes after the legal truth, not before it.</p>
              <div className="flex gap-2 flex-wrap mt-6">
                <Link href="/real-estate" className="rounded-full bg-white text-black px-5 py-2.5 text-xs font-black no-underline">Explore Real Property pilot</Link>
                <Link href="/real-estate/launch" className="rounded-full border border-white/10 px-5 py-2.5 text-xs text-white/70 no-underline">View production gates</Link>
              </div>
            </div>
            <div className="grid gap-2 text-xs">
              {['Recorded title / closing verified','Property entity + agreements executed','KYC / eligibility and transfer rules satisfied','Accounting / custody / distribution operations approved','Holder-specific legal interest bound','Only then: spatial Property Passport appears as linked'].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3.5">
                  <span className="w-7 h-7 rounded-full border border-amber-100/20 grid place-items-center font-black text-amber-100/60">{index + 1}</span>
                  <span className="text-white/60">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 pt-7 pb-8 flex justify-between gap-6 flex-wrap text-[11px] leading-5 text-white/35">
          <div><b className="text-white/60">Voxel Vault · My Vault</b><br />One interface, separate legal/source truth for every asset class.</div>
          <div className="max-w-xl">Digital REIT availability and eligibility are provider-controlled. Direct-property investing, automatic acquisition/reinvestment and mainnet property-token issuance remain outside this unified display until their production gates are satisfied.</div>
        </footer>
      </section>
    </main>
  );
}

function TruthStat({ label, value, note }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[.035] p-4 md:p-5"><div className="text-[9px] tracking-[.15em] font-black text-white/35">{label}</div><div className="text-2xl md:text-3xl font-black tracking-[-.05em] mt-2">{value}</div><div className="text-[10px] text-white/35 mt-1 truncate">{note}</div></div>;
}

function TruthCard({ title, copy }) {
  return <article className="rounded-3xl border border-white/10 bg-white/[.025] p-5"><div className="text-sm font-black">{title}</div><p className="text-xs leading-5 text-white/45 mt-2">{copy}</p></article>;
}

function SectionHeading({ eyebrow, title, copy }) {
  return <div className="grid lg:grid-cols-[1fr_.8fr] gap-5 items-end mb-7"><div><div className="text-[10px] tracking-[.18em] font-black text-white/35">{eyebrow}</div><h2 className="text-4xl md:text-6xl font-black tracking-[-.065em] leading-[.92] mt-3">{title}</h2></div><p className="text-sm leading-6 text-white/45 lg:pb-1">{copy}</p></div>;
}

function EmptyState({ icon, title, copy, href, action }) {
  return <div className="rounded-[28px] border border-dashed border-white/15 bg-white/[.02] p-8 text-center"><div className="text-4xl text-white/45">{icon}</div><h3 className="text-xl font-bold mt-3">{title}</h3><p className="text-sm leading-6 text-white/45 max-w-xl mx-auto mt-2">{copy}</p>{href && action ? <Link href={href} className="inline-flex mt-5 rounded-full bg-white text-black px-5 py-2.5 text-xs font-black no-underline">{action}</Link> : null}</div>;
}

function LoadingGrid() {
  return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map((item) => <div key={item} className="h-56 rounded-3xl bg-white/[.04] animate-pulse" />)}</div>;
}
