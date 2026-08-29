'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../../../lib/supabase-browser';
import { loadAccountPropertyDrafts } from '../../../../../lib/property-drafts-account';
import { readPropertyDrafts } from '../../../../../lib/property-drafts';
import { connectVoxelFlipWallet, mintVoxelFlip } from '../../../../../lib/voxelflip';

function clean(value) { return String(value || '').trim(); }
function findDraft(items, id) { return (Array.isArray(items) ? items : []).find((item) => String(item?.id || '') === id) || null; }

export default function MintReviewedPropertyVoxelPage() {
  const params = useParams();
  const draftId = decodeURIComponent(String(params?.draftId || ''));
  const [session, setSession] = useState(null);
  const [draft, setDraft] = useState(null);
  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('Opening your reviewed voxel…');
  const [wallet, setWallet] = useState('');
  const [mint, setMint] = useState(null);
  const clientRef = useRef(null);

  const taskId = clean(draft?.voxelpop?.modelTaskId);
  const modelUrl = clean(draft?.voxelpop?.modelUrl);
  const mintReady = Boolean(taskId.startsWith('local-v1:') && modelUrl);
  const shortWallet = useMemo(() => wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : '', [wallet]);

  useEffect(() => {
    let active = true;
    let subscription = null;

    async function apply(next) {
      if (!active) return;
      setSession(next || null);
      if (!next?.user) {
        setState('signed-out');
        setMessage('Sign in to mint the exact voxel saved in your Vault.');
        return;
      }
      setState('loading');
      try {
        const local = findDraft(readPropertyDrafts(), draftId);
        let account = null;
        try {
          const items = await loadAccountPropertyDrafts(clientRef.current, next.user);
          account = findDraft(items, draftId);
        } catch {}
        if (!active) return;
        const found = account || local;
        setDraft(found);
        setState(found ? 'ready' : 'missing');
        setMessage(found
          ? 'Review the saved voxel, connect your wallet, then mint only if you want the digital NFT.'
          : 'This saved property could not be found in your Vault.');
      } catch (error) {
        if (!active) return;
        setState('error');
        setMessage(String(error?.message || error || 'Your saved voxel could not be loaded.'));
      }
    }

    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      await apply(data.session);
      const auth = client.auth.onAuthStateChange((_event, next) => { apply(next); });
      subscription = auth.data.subscription;
    }).catch((error) => {
      if (!active) return;
      setState('error');
      setMessage(String(error?.message || error || 'Sign-in is unavailable.'));
    });

    return () => { active = false; subscription?.unsubscribe?.(); };
  }, [draftId]);

  async function signIn() {
    setState('busy');
    setMessage('Opening Google sign-in…');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
      if (error) throw error;
    } catch (error) {
      setState('signed-out');
      setMessage(String(error?.message || error || 'Sign-in could not start.'));
    }
  }

  async function mintVoxel() {
    if (!session?.access_token || !draft || !mintReady || state === 'busy') return;
    setState('busy');
    setMessage('Connecting your wallet. Nothing mints until you approve the wallet transaction.');
    try {
      const connected = await connectVoxelFlipWallet();
      setWallet(connected.address);
      setMessage('Preparing the exact reviewed voxel for your wallet…');
      const response = await fetch('/api/property-local-voxel/nft/prepare', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ draftId: draft.id, wallet: connected.address }),
      });
      const prepared = await response.json().catch(() => ({}));
      if (!response.ok || !prepared?.ready || !prepared?.metadataUrl || !prepared?.voucherId || !prepared?.signature) {
        throw new Error(prepared?.error || 'This reviewed voxel could not be prepared for minting.');
      }

      setMessage('Ready to mint. Approve the Base transaction in your wallet to create the NFT.');
      const result = await mintVoxelFlip({
        metadataUrl: prepared.metadataUrl,
        voucherId: prepared.voucherId,
        signature: prepared.signature,
      });
      setMint(result);
      setState('minted');
      setMessage('Mint confirmed. This NFT is the digital voxel you reviewed; it does not represent the deed or physical-property rights.');
    } catch (error) {
      setState('ready');
      const text = String(error?.message || error || 'Minting did not complete.');
      setMessage(text.includes('user rejected') || text.includes('ACTION_REJECTED') ? 'Mint canceled in your wallet. Nothing was minted.' : text);
    }
  }

  return <main className="mintPage">
    <section className="mintShell">
      <nav><Link href={`/vault/property-drafts/${encodeURIComponent(draftId)}`}>← Back to voxel</Link><Link href="/vault/property-drafts">My Vault</Link></nav>
      <p className="eyebrow">STEP 5 · OPTIONAL MINT</p>
      <h1>Mint the voxel<br/><em>you already reviewed.</em></h1>
      <p className="lead">The order is intentional: first see the 3D picture, then build and inspect the movable 3D voxel, then save it. Minting comes last and only happens after your wallet approval.</p>

      {state === 'loading' ? <section className="panel"><b>Loading reviewed voxel…</b></section> : null}
      {state === 'signed-out' ? <section className="panel"><b>Sign in first</b><span>Your saved voxel is account-bound.</span><button type="button" onClick={signIn}>Continue with Google</button></section> : null}
      {state === 'missing' || state === 'error' ? <section className="panel"><b>Voxel unavailable</b><span>{message}</span><Link className="secondary" href="/property">Create a property voxel</Link></section> : null}

      {draft ? <>
        <section className="assetCard">
          <div className="modelFrame">
            {modelUrl ? <iframe title="Reviewed VoxelPop model" src={modelUrl} /> : <div className="modelMissing">3D model not available</div>}
          </div>
          <div className="assetCopy">
            <small>REVIEWED DIGITAL ASSET</small>
            <h2>{draft.label || 'VoxelPop Property'}</h2>
            <p>{mintReady ? 'Exact saved local voxel is ready for optional NFT minting.' : 'Finish the reviewed 3D voxel before minting.'}</p>
            {wallet ? <div className="wallet">Wallet · {shortWallet}</div> : null}
          </div>
        </section>

        {!mint ? <section className="mintAction">
          <div><b>Mint as VoxelFlip NFT</b><span>Uses the reviewed 3D model. Your wallet shows the Base network transaction and gas before anything is signed.</span></div>
          <button type="button" onClick={mintVoxel} disabled={!mintReady || state === 'busy'}>{state === 'busy' ? 'Preparing…' : 'Connect wallet & Mint'}</button>
        </section> : null}

        {mint ? <section className="success">
          <div className="check">✓</div>
          <div><b>NFT minted</b><span>Token {mint.tokenId || 'confirmed'} · {mint.owner ? `${mint.owner.slice(0, 6)}…${mint.owner.slice(-4)}` : 'your wallet'}</span></div>
          {mint.openSeaUrl ? <a href={mint.openSeaUrl} target="_blank" rel="noreferrer">View NFT ↗</a> : mint.explorerUrl ? <a href={mint.explorerUrl} target="_blank" rel="noreferrer">View transaction ↗</a> : null}
        </section> : null}
      </> : null}

      <p className="status" role="status">{message}</p>
      <p className="truth"><b>Digital NFT only.</b> Minting this VoxelPop records the digital voxel in your wallet. It does not transfer the physical house or land, deed/title, equity, occupancy, rent, investment rights, or guaranteed value.</p>
    </section>
    <style jsx>{`
      .mintPage{min-height:100vh;background:radial-gradient(circle at 12% 8%,#efffb6 0,transparent 24%),radial-gradient(circle at 90% 16%,#eee5ff 0,transparent 25%),linear-gradient(180deg,#fffdf8,#fff8ed);color:#191421;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:0 14px calc(42px + env(safe-area-inset-bottom))}.mintShell{width:min(820px,100%);margin:auto}.mintShell nav{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:12px}.mintShell nav a{color:#6340d5;text-decoration:none;font-size:12px;font-weight:900}.eyebrow{margin:26px 0 10px;color:#6d3bf1;font-size:11px;font-weight:1000;letter-spacing:.15em}.mintShell h1{font-size:clamp(45px,8vw,72px);line-height:.92;letter-spacing:-.06em;margin:0}.mintShell h1 em{font-style:normal;color:#7138f5}.lead{font-size:16px;line-height:1.55;color:#766e7b;max-width:700px;margin:20px 0 30px}.panel,.assetCard,.mintAction,.success{border:1px solid #e3dce8;background:#ffffffdd;border-radius:28px}.panel{padding:24px;display:grid;gap:10px}.panel b{font-size:20px}.panel span{color:#766e7b}.panel button,.secondary,.mintAction button{min-height:52px;border:0;border-radius:17px;padding:0 18px;background:#7138f5;color:white;font-weight:1000;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.assetCard{overflow:hidden;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(230px,.9fr)}.modelFrame{min-height:330px;background:#1d1424;display:grid;place-items:center;overflow:hidden}.modelFrame iframe{width:100%;height:330px;border:0;background:#1d1424}.modelMissing{color:#d8cddd;font-size:12px}.assetCopy{padding:26px;display:grid;align-content:center;gap:8px}.assetCopy small{color:#6d3bf1;font-size:9px;font-weight:1000;letter-spacing:.14em}.assetCopy h2{font-size:31px;line-height:1;letter-spacing:-.04em;margin:0}.assetCopy p{color:#766e7b;line-height:1.5;margin:4px 0}.wallet{display:inline-flex;margin-top:6px;padding:8px 10px;border-radius:999px;background:#f0eaff;color:#5c3eb6;font-size:10px;font-weight:900}.mintAction{margin-top:14px;padding:20px;display:flex;align-items:center;justify-content:space-between;gap:20px}.mintAction div{display:grid;gap:5px}.mintAction b{font-size:18px}.mintAction span{color:#766e7b;font-size:12px;line-height:1.45}.mintAction button{background:#c9ff54;color:#263700;box-shadow:0 5px 0 #a3cf3f}.mintAction button:disabled{opacity:.55;cursor:not-allowed}.success{margin-top:14px;padding:18px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;background:#f5ffe2}.check{width:44px;height:44px;border-radius:15px;background:#c9ff54;display:grid;place-items:center;font-size:22px;font-weight:1000}.success div:nth-child(2){display:grid;gap:3px}.success span{font-size:11px;color:#657054}.success a{color:#5731c4;font-size:11px;font-weight:1000;text-decoration:none}.status{margin:16px 2px 0;color:#6e6672;font-size:12px;line-height:1.5}.truth{margin:18px 0 0;padding:16px 18px;border-radius:20px;background:#211730;color:#dcd2e2;font-size:11px;line-height:1.55}.truth b{color:#c9ff54}@media(max-width:650px){.assetCard{grid-template-columns:1fr}.modelFrame,.modelFrame iframe{min-height:280px;height:280px}.mintAction{align-items:stretch;flex-direction:column}.mintAction button{width:100%}.success{grid-template-columns:auto 1fr}.success a{grid-column:1/-1;text-align:center;padding:10px}.mintShell h1{font-size:50px}}
    `}</style>
  </main>;
}
