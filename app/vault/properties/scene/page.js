'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Contract } from 'ethers';
import { getSupabaseBrowserAsync } from '../../../../lib/supabase-browser';
import { getWallet, NFT_ABI, NFT_ADDRESS } from '../../../../lib/blockchain';
import { buildPropertySceneWalletMessage } from '../../../../lib/vault/property-scene.js';
import PropertySceneCanvas from './PropertySceneCanvas';

function googleReturnUrl() {
  return new URL('/vault/properties/scene?auth=google', window.location.origin).toString();
}

function short(value) {
  const text = String(value || '');
  return text ? `${text.slice(0, 8)}…${text.slice(-6)}` : '—';
}

function parseInlineMetadata(uri) {
  try {
    if (String(uri).startsWith('data:application/json;base64,')) {
      return JSON.parse(atob(String(uri).slice('data:application/json;base64,'.length)));
    }
    if (String(uri).startsWith('data:application/json,')) {
      return JSON.parse(decodeURIComponent(String(uri).slice('data:application/json,'.length)));
    }
  } catch {}
  return null;
}

async function metadataName(uri, tokenId) {
  const inline = parseInlineMetadata(uri);
  if (inline?.name) return String(inline.name);
  return `Voxel #${tokenId}`;
}

export default function PropertyScenePage() {
  const [session, setSession] = useState(null);
  const [authState, setAuthState] = useState('loading');
  const [sceneData, setSceneData] = useState(null);
  const [propertyId, setPropertyId] = useState('');
  const [ownedTokens, setOwnedTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [wallet, setWallet] = useState('');
  const [label, setLabel] = useState('');
  const [transform, setTransform] = useState({ x: 0, y: 0.65, z: 5.5, rotationY: 0, scale: 1 });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const clientRef = useRef(null);

  const selectedProperty = useMemo(
    () => sceneData?.properties?.find((property) => property.propertyIdentityId === propertyId) || null,
    [sceneData, propertyId]
  );
  const items = selectedProperty?.items || [];
  const selectedItem = items.find((item) => item.id === selectedItemId) || null;

  async function refresh(accessToken) {
    const token = String(accessToken || '').trim();
    if (!token) return;
    setBusy('refresh');
    try {
      const response = await fetch('/api/vault/property-scenes', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Property Scene could not be loaded.');
      setSceneData(data);
      if (!propertyId && data.properties?.[0]) setPropertyId(data.properties[0].propertyIdentityId);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Property Scene could not be loaded.');
    } finally {
      setBusy('');
    }
  }

  useEffect(() => {
    let active = true;
    let subscription = null;
    async function apply(next) {
      if (!active) return;
      setSession(next);
      if (!next?.user) {
        setAuthState('signed-out');
        setSceneData(null);
        return;
      }
      setAuthState('signed-in');
      await refresh(next.access_token || '');
      if (new URLSearchParams(window.location.search).get('auth') === 'google') {
        window.history.replaceState({}, '', '/vault/properties/scene');
      }
    }
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data, error } = await client.auth.getSession();
      if (error) {
        setAuthState('error');
        setMessage(error.message);
      } else {
        await apply(data.session);
      }
      const auth = client.auth.onAuthStateChange((_event, next) => { apply(next); });
      subscription = auth.data.subscription;
    }).catch((error) => {
      if (!active) return;
      setAuthState('error');
      setMessage(error instanceof Error ? error.message : 'Sign-in setup is incomplete.');
    });
    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  async function signIn() {
    setBusy('signin');
    setMessage('');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: googleReturnUrl() } });
      if (error) throw error;
    } catch (error) {
      setBusy('');
      setMessage(error instanceof Error ? error.message : 'Could not start sign-in.');
    }
  }

  async function loadOwnedVoxels() {
    setBusy('wallet');
    setMessage('Connecting wallet and reading your confirmed Voxel NFTs…');
    try {
      if (!sceneData?.voxelChain) throw new Error('Voxel NFT ownership verification is not configured yet.');
      if (!NFT_ADDRESS) throw new Error('Voxel NFT contract is not configured in this deployment.');
      const connected = await getWallet();
      setWallet(connected.address);
      const nft = new Contract(NFT_ADDRESS, NFT_ABI, connected.provider);
      const logs = await nft.queryFilter(nft.filters.Transfer(null, connected.address));
      const tokenIds = [...new Set(logs.map((log) => log.args?.tokenId?.toString()).filter(Boolean))].slice(-150).reverse();
      const owned = [];
      for (const tokenId of tokenIds) {
        try {
          const owner = await nft.ownerOf(tokenId);
          if (String(owner).toLowerCase() !== connected.address.toLowerCase()) continue;
          let tokenUri = '';
          try { tokenUri = String(await nft.tokenURI(tokenId) || ''); } catch {}
          owned.push({ tokenId, tokenUri, name: await metadataName(tokenUri, tokenId) });
        } catch {}
      }
      setOwnedTokens(owned);
      if (!selectedToken && owned[0]) setSelectedToken(owned[0].tokenId);
      setMessage(owned.length ? `Loaded ${owned.length} owned Voxel${owned.length === 1 ? '' : 's'}. Pick one and place it on the property.` : 'No confirmed Voxel NFTs were found in this wallet on the configured Voxel chain.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load wallet Voxels.');
    } finally {
      setBusy('');
    }
  }

  function editItem(item) {
    setSelectedItemId(item.id);
    setSelectedToken(String(item.nft_token_id));
    setWallet(item.owner_wallet || '');
    setLabel(item.display_label || '');
    setTransform({
      x: Number(item.position_x || 0),
      y: Number(item.position_y || 0),
      z: Number(item.position_z || 0),
      rotationY: Number(item.rotation_y || 0),
      scale: Number(item.scale || 1),
    });
  }

  function newPlacement(tokenId = selectedToken) {
    setSelectedItemId('');
    setSelectedToken(String(tokenId || ''));
    setLabel('');
    setTransform({ x: 0, y: 0.65, z: 5.5, rotationY: 0, scale: 1 });
  }

  async function savePlacement() {
    if (!session?.access_token || !propertyId || !selectedToken || busy) return;
    setBusy('save');
    setMessage('Verifying wallet ownership before saving this digital scene placement…');
    try {
      if (!sceneData?.voxelChain) throw new Error('Voxel chain configuration is unavailable.');
      const connected = await getWallet();
      setWallet(connected.address);
      const timestamp = Date.now();
      const action = selectedItem ? 'MOVE' : 'ATTACH';
      const walletMessage = buildPropertySceneWalletMessage({
        action,
        propertyIdentityId: propertyId,
        chainId: sceneData.voxelChain.chainId,
        contractAddress: sceneData.voxelChain.contractAddress,
        tokenId: selectedToken,
        transform,
        timestamp,
      });
      const signature = await connected.signer.signMessage(walletMessage);
      const response = await fetch('/api/vault/property-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          action: selectedItem ? 'move' : 'attach',
          propertyIdentityId: propertyId,
          tokenId: selectedToken,
          wallet: connected.address,
          signature,
          timestamp,
          displayLabel: label,
          transform,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'The Voxel could not be placed.');
      setMessage(selectedItem ? 'Voxel position saved. Digital scene updated; real-property appraisal and rights are unchanged.' : 'Voxel attached to the Property Scene. Its collectible value remains separate from the home appraisal.');
      await refresh(session.access_token);
      setSelectedItemId(data.item?.id || selectedItemId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The Voxel could not be placed.');
    } finally {
      setBusy('');
    }
  }

  async function removeItem(item) {
    if (!session?.access_token || !propertyId || busy) return;
    setBusy(`remove:${item.id}`);
    try {
      const response = await fetch('/api/vault/property-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'remove', propertyIdentityId: propertyId, sceneItemId: item.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'The Voxel could not be removed.');
      if (selectedItemId === item.id) newPlacement('');
      setMessage('Voxel removed from the digital scene. The NFT itself was not transferred or burned.');
      await refresh(session.access_token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The Voxel could not be removed.');
    } finally {
      setBusy('');
    }
  }

  function setAxis(key, value) {
    setTransform((current) => ({ ...current, [key]: Number(value) }));
  }

  if (authState === 'loading') return <Shell><State title="Loading Property Scene…" copy="Checking your verified property identity." /></Shell>;
  if (authState === 'error') return <Shell><State title="Property Scene unavailable" copy={message || 'Could not load sign-in state.'} /></Shell>;
  if (authState === 'signed-out') return <Shell><State title="Sign in to decorate your property" copy="Only the human-verified property controller can edit the canonical digital scene." action={<button onClick={signIn} disabled={Boolean(busy)} className="mt-5 rounded-full bg-white px-6 py-3 text-xs font-black text-black">SIGN IN WITH GOOGLE</button>} /></Shell>;

  return (
    <Shell>
      <header className="pb-10 pt-10 md:pb-14 md:pt-16">
        <div className="text-[10px] font-black tracking-[.22em] text-emerald-100/45">PROPERTY PASSPORT · DIGITAL SCENE LAYER</div>
        <h1 className="mt-4 text-5xl font-black leading-[.86] tracking-[-.07em] md:text-7xl">Make the property<br /><span className="text-[#9ff5df]">uniquely yours.</span></h1>
        <p className="mt-6 max-w-3xl text-sm leading-6 text-white/50 md:text-base">Attach Voxel Vault collectibles you actually own, then move, rotate and scale them around your verified property twin. This creates a separate digital collectible layer—it never changes the deed, appraisal or real rent rights.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/studio" className="rounded-full bg-white px-5 py-2.5 text-xs font-black text-black no-underline">CREATE A NEW VOXEL →</Link>
          <button onClick={loadOwnedVoxels} disabled={Boolean(busy)} className="rounded-full border border-emerald-100/20 bg-emerald-100/[.04] px-5 py-2.5 text-xs font-black text-emerald-100 disabled:opacity-40">{busy === 'wallet' ? 'LOADING…' : 'LOAD MY OWNED VOXELS'}</button>
        </div>
      </header>

      {message ? <div className="mb-5 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm leading-6 text-white/60">{message}</div> : null}

      {!sceneData?.properties?.length ? (
        <State title="No verified property yet" copy="Submit a Property Passport claim and complete human verification first. Digital scene editing unlocks only for the verified property controller." action={<Link href="/vault/properties/claim" className="mt-5 inline-block rounded-full border border-white/15 px-5 py-2.5 text-xs font-black text-white no-underline">OPEN PROPERTY CLAIM →</Link>} />
      ) : (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="text-[10px] font-black tracking-[.13em] text-white/35">VERIFIED PROPERTY
              <select value={propertyId} onChange={(event) => { setPropertyId(event.target.value); setSelectedItemId(''); }} className="mt-2 block w-full rounded-2xl border border-white/10 bg-[#0a0e0d] p-3 text-sm text-white outline-none">
                {sceneData.properties.map((property) => <option key={property.propertyIdentityId} value={property.propertyIdentityId}>{property.propertyLabel || 'Verified property'}{property.locality ? ` · ${property.locality}` : ''}</option>)}
              </select>
            </label>
            <div className="rounded-2xl border border-emerald-100/12 bg-emerald-100/[.03] px-4 py-3 text-xs text-emerald-100/65"><b>{items.length}</b> attached voxel{items.length === 1 ? '' : 's'} · digital layer only</div>
          </div>

          <PropertySceneCanvas items={items} selectedId={selectedItemId} />

          <section className="mt-5 grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
            <article className="rounded-[30px] border border-white/10 bg-white/[.025] p-6">
              <div className="flex items-center justify-between gap-3"><div className="text-[9px] font-black tracking-[.15em] text-white/35">MY OWNED VOXELS</div><span className="text-xs font-black text-white/50">{ownedTokens.length}</span></div>
              {!ownedTokens.length ? <p className="mt-4 text-xs leading-5 text-white/40">Connect MetaMask and load your owned Voxel NFTs. Only current on-chain ownership can be attached.</p> : null}
              <div className="mt-4 grid gap-2">
                {ownedTokens.slice(0, 40).map((token) => <button key={token.tokenId} onClick={() => newPlacement(token.tokenId)} className={`flex items-center justify-between rounded-2xl border p-3 text-left ${selectedToken === token.tokenId && !selectedItem ? 'border-emerald-100/30 bg-emerald-100/[.06]' : 'border-white/8 bg-black/15'}`}><span><b className="block text-sm">{token.name}</b><small className="text-white/35">Token #{token.tokenId}</small></span><span className="text-emerald-100">＋</span></button>)}
              </div>
              {wallet ? <div className="mt-4 text-[10px] text-white/30">Connected owner wallet: {short(wallet)}</div> : null}
            </article>

            <article className="rounded-[30px] border border-white/10 bg-white/[.025] p-6">
              <div className="flex items-center justify-between"><div><div className="text-[9px] font-black tracking-[.15em] text-white/35">SCENE PLACEMENT</div><h2 className="mt-2 text-2xl font-black">{selectedItem ? `Move Voxel #${selectedItem.nft_token_id}` : selectedToken ? `Place Voxel #${selectedToken}` : 'Choose a Voxel'}</h2></div>{selectedItem ? <button onClick={() => newPlacement('')} className="text-xs text-white/45">NEW</button> : null}</div>
              <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} placeholder="Optional scene label — e.g. Rooftop mascot" className="mt-5 w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/20" />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Slider label="LEFT / RIGHT" value={transform.x} min={-8} max={8} step={0.25} onChange={(value) => setAxis('x', value)} />
                <Slider label="FRONT / BACK" value={transform.z} min={-8} max={8} step={0.25} onChange={(value) => setAxis('z', value)} />
                <Slider label="HEIGHT" value={transform.y} min={0} max={9} step={0.25} onChange={(value) => setAxis('y', value)} />
                <Slider label="ROTATION" value={transform.rotationY} min={-3.1416} max={3.1416} step={0.1} onChange={(value) => setAxis('rotationY', value)} />
                <Slider label="SCALE" value={transform.scale} min={0.1} max={4} step={0.1} onChange={(value) => setAxis('scale', value)} />
              </div>
              <button onClick={savePlacement} disabled={!selectedToken || Boolean(busy)} className="mt-6 w-full rounded-2xl bg-[#9ff5df] px-5 py-3.5 text-xs font-black text-[#07100e] disabled:opacity-30">{busy === 'save' ? 'VERIFYING OWNERSHIP…' : selectedItem ? 'SAVE NEW POSITION' : 'ATTACH OWNED VOXEL'}</button>
              <p className="mt-3 text-[10px] leading-5 text-white/30">MetaMask signs the exact scene placement. The server then independently checks `ownerOf(tokenId)` before saving it.</p>
            </article>
          </section>

          {items.length ? <section className="mt-5 rounded-[30px] border border-white/10 bg-white/[.025] p-6"><div className="text-[9px] font-black tracking-[.15em] text-white/35">ATTACHED DIGITAL COLLECTION</div><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <div key={item.id} className={`rounded-2xl border p-4 ${selectedItemId === item.id ? 'border-emerald-100/30 bg-emerald-100/[.05]' : 'border-white/8 bg-black/15'}`}><button onClick={() => editItem(item)} className="w-full text-left"><b className="block text-sm">{item.display_label || `Voxel #${item.nft_token_id}`}</b><span className="mt-1 block text-[10px] text-white/35">Token #{item.nft_token_id} · ownership checked {item.ownership_verified_at ? new Date(item.ownership_verified_at).toLocaleDateString() : 'on attach'}</span></button><button onClick={() => removeItem(item)} disabled={Boolean(busy)} className="mt-3 text-[10px] font-black text-red-100/60 disabled:opacity-30">REMOVE FROM SCENE</button></div>)}</div></section> : null}

          <section className="mt-5 grid gap-3 md:grid-cols-3">
            <PolicyCard title="DIGITAL SCENE VALUE" value="MARKET-DRIVEN" copy="Owned voxels can make the digital scene rarer, more expressive and collectible. Future value displays must come from verifiable market data—not a typed-in number." />
            <PolicyCard title="REAL PROPERTY VALUE" value="SEPARATE" copy="The home or land keeps its normal appraisal/listing/comparable-sales value. Attached NFTs are never added to that figure." />
            <PolicyCard title="NFT OWNERSHIP" value="UNCHANGED" copy="Attaching a Voxel is a display reference. It does not transfer, lock or burn the NFT, so it can still be sold separately." />
          </section>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return <main className="min-h-screen bg-[#050706] px-4 py-5 text-white md:px-8 md:py-8"><section className="mx-auto max-w-7xl"><nav className="flex flex-wrap items-center justify-between gap-4"><Link href="/vault/properties" className="font-black text-white no-underline">Voxel Vault · Property Scene</Link><div className="flex gap-2 text-xs"><Link href="/vault/properties" className="rounded-full border border-white/10 px-4 py-2 text-white/60 no-underline">Property Passport</Link><Link href="/vault" className="rounded-full border border-white/10 px-4 py-2 text-white/60 no-underline">My Vault</Link></div></nav>{children}</section></main>;
}

function State({ title, copy, action = null }) {
  return <section className="mx-auto mt-[14vh] max-w-3xl rounded-[32px] border border-white/10 bg-white/[.025] p-8 text-center"><h1 className="text-3xl font-black">{title}</h1><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/45">{copy}</p>{action}</section>;
}

function Slider({ label, value, min, max, step, onChange }) {
  return <label className="text-[9px] font-black tracking-[.12em] text-white/35">{label}<div className="mt-2 flex items-center gap-3"><input className="w-full" type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.target.value)} /><span className="w-14 text-right text-xs font-bold text-white/65">{Number(value).toFixed(step < 0.2 ? 2 : 1)}</span></div></label>;
}

function PolicyCard({ title, value, copy }) {
  return <article className="rounded-[26px] border border-white/10 bg-white/[.025] p-5"><div className="text-[9px] font-black tracking-[.14em] text-white/30">{title}</div><div className="mt-2 text-xl font-black text-[#9ff5df]">{value}</div><p className="mt-3 text-xs leading-5 text-white/40">{copy}</p></article>;
}
