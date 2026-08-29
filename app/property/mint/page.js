'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import MeshyModelViewer from '../../vault/earth/MeshyModelViewer';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { connectVoxelFlipWallet, mintVoxelFlip } from '../../../lib/voxelflip';

const DRAFT_RE = /^[a-zA-Z0-9._:-]+$/;
const TASK_RE = /^local-v1:[a-f0-9]{48}$/i;

export default function MintPropertyVoxelPage() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [draftId, setDraftId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [busy, setBusy] = useState(false);
  const [wallet, setWallet] = useState('');
  const [mint, setMint] = useState(null);
  const [message, setMessage] = useState('Opening your reviewed voxel…');
  const clientRef = useRef(null);

  const validAsset = DRAFT_RE.test(draftId) && TASK_RE.test(taskId);
  const modelUrl = validAsset ? `/api/property-local-voxel?taskId=${encodeURIComponent(taskId)}` : '';
  const shortWallet = useMemo(() => wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : '', [wallet]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setDraftId(String(params.get('draftId') || '').trim());
      setTaskId(String(params.get('taskId') || '').trim());
    }

    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      setSession(data.session || null);
      setAuthReady(true);
      setMessage(data.session?.user ? 'Inspect the voxel again. Mint only if this is the digital object you want in your wallet.' : 'Sign in to mint your reviewed voxel.');
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
        setMessage(next?.user ? 'Inspect the voxel again. Mint only if this is the digital object you want in your wallet.' : 'Sign in to mint your reviewed voxel.');
      });
      subscription = auth.data.subscription;
    }).catch((error) => {
      if (!active) return;
      setAuthReady(true);
      setMessage(String(error?.message || error || 'Sign-in is unavailable.'));
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  async function signIn() {
    setBusy(true);
    setMessage('Opening Google sign-in…');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
      if (error) throw error;
    } catch (error) {
      setBusy(false);
      setMessage(String(error?.message || error || 'Sign-in could not start.'));
    }
  }

  async function mintVoxel() {
    if (!session?.access_token || !validAsset || busy || mint) return;
    setBusy(true);
    setMessage('Connecting your wallet. Nothing mints until you approve the Base transaction.');
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
        body: JSON.stringify({ draftId, taskId, wallet: connected.address, label: 'VoxelPop Property' }),
      });
      const prepared = await response.json().catch(() => ({}));
      if (!response.ok || !prepared?.ready || !prepared?.metadataUrl || !prepared?.voucherId || !prepared?.signature) {
        throw new Error(prepared?.error || 'This reviewed voxel could not be prepared for minting.');
      }

      setMessage('Ready. Approve the Base transaction in your wallet to mint this exact voxel.');
      const result = await mintVoxelFlip({ metadataUrl: prepared.metadataUrl, voucherId: prepared.voucherId, signature: prepared.signature });
      setMint(result);
      setMessage('Mint confirmed. The NFT is this reviewed digital voxel. It does not represent the physical property or deed.');
    } catch (error) {
      const text = String(error?.message || error || 'Minting did not complete.');
      setMessage(text.includes('user rejected') || text.includes('ACTION_REJECTED') ? 'Mint canceled in your wallet. Nothing was minted.' : text);
    } finally {
      setBusy(false);
    }
  }

  return <main className="page">
    <section className="shell">
      <nav><button type="button" onClick={() => history.back()}>← Back to voxel</button><Link href="/vault">Vault</Link></nav>
      <p className="eyebrow">STEP 5 · OPTIONAL MINT</p>
      <h1>See the voxel.<br/><em>Then mint it.</em></h1>
      <p className="lead">This screen is intentionally last. The photo has already become the 3D picture, you chose to build the voxel, and now you can inspect that exact movable voxel again before any wallet transaction.</p>

      {!validAsset ? <section className="notice"><b>Reviewed voxel link missing</b><span>Return to the property creator and finish the 3D voxel first.</span><Link href="/property">Open property creator</Link></section> : null}
      {validAsset ? <section className="asset">
        <div className="viewer"><MeshyModelViewer modelUrl={modelUrl}/></div>
        <div className="copy"><small>EXACT REVIEWED VOXEL</small><b>VoxelPop Property</b><span>Drag the model and make sure this is the one you want to mint.</span>{wallet ? <i>Wallet · {shortWallet}</i> : null}</div>
      </section> : null}

      {validAsset && authReady && !session?.user ? <section className="action"><div><b>Sign in first</b><span>The mint voucher must match the same Voxel Vault account that created this voxel.</span></div><button type="button" onClick={signIn} disabled={busy}>{busy ? 'Opening…' : 'Continue with Google'}</button></section> : null}

      {validAsset && session?.user && !mint ? <section className="action"><div><b>Mint this 3D voxel</b><span>Wallet connection happens only now. You will see the Base transaction and gas before approving it.</span></div><button type="button" onClick={mintVoxel} disabled={busy}>{busy ? 'Preparing…' : 'Connect wallet & Mint'}</button></section> : null}

      {mint ? <section className="success"><div className="check">✓</div><div><b>NFT minted</b><span>Token {mint.tokenId || 'confirmed'} · Base</span></div>{mint.openSeaUrl ? <a href={mint.openSeaUrl} target="_blank" rel="noreferrer">View NFT ↗</a> : mint.explorerUrl ? <a href={mint.explorerUrl} target="_blank" rel="noreferrer">View transaction ↗</a> : null}</section> : null}

      <p className="status" role="status">{message}</p>
      <div className="after"><button type="button" onClick={() => history.back()}>Back to voxel / optional map</button><Link href="/vault">Open Vault</Link></div>
      <p className="truth"><b>Digital NFT only.</b> Minting records this reviewed VoxelPop voxel in your wallet. It does not transfer the physical house or land, deed/title, equity, occupancy, rent, investment rights, or guaranteed value.</p>
    </section>
    <style jsx>{`
      .page{min-height:100vh;background:radial-gradient(circle at 12% 8%,#efffb6 0,transparent 24%),radial-gradient(circle at 90% 16%,#eee5ff 0,transparent 25%),linear-gradient(180deg,#fffdf8,#fff8ed);color:#191421;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:0 14px calc(42px + env(safe-area-inset-bottom))}.shell{width:min(820px,100%);margin:auto}.shell nav{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:12px}.shell nav a,.shell nav button{border:0;background:transparent;color:#6340d5;text-decoration:none;font:inherit;font-size:12px;font-weight:900;cursor:pointer}.eyebrow{margin:26px 0 10px;color:#6d3bf1;font-size:11px;font-weight:1000;letter-spacing:.15em}.shell h1{font-size:clamp(45px,8vw,72px);line-height:.92;letter-spacing:-.06em;margin:0}.shell h1 em{font-style:normal;color:#7138f5}.lead{font-size:16px;line-height:1.55;color:#766e7b;max-width:700px;margin:20px 0 30px}.notice,.asset,.action,.success{border:1px solid #e3dce8;background:#ffffffdd;border-radius:28px}.notice{padding:24px;display:grid;gap:10px}.notice b{font-size:20px}.notice span{color:#766e7b}.notice a{min-height:50px;border-radius:16px;background:#7138f5;color:white;text-decoration:none;display:grid;place-items:center;font-weight:1000}.asset{overflow:hidden;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(230px,.9fr)}.viewer{min-height:330px;background:#1d1424;overflow:hidden}.viewer :global(.viewerShell){min-height:330px;border-radius:0}.copy{padding:26px;display:grid;align-content:center;gap:8px}.copy small{color:#6d3bf1;font-size:9px;font-weight:1000;letter-spacing:.14em}.copy b{font-size:30px;line-height:1;letter-spacing:-.04em}.copy span{color:#766e7b;font-size:13px;line-height:1.5}.copy i{font-style:normal;display:inline-flex;margin-top:6px;padding:8px 10px;border-radius:999px;background:#f0eaff;color:#5c3eb6;font-size:10px;font-weight:900}.action{margin-top:14px;padding:20px;display:flex;align-items:center;justify-content:space-between;gap:20px}.action div{display:grid;gap:5px}.action b{font-size:18px}.action span{color:#766e7b;font-size:12px;line-height:1.45}.action button{min-height:52px;border:0;border-radius:17px;padding:0 18px;background:#c9ff54;color:#263700;font-weight:1000;box-shadow:0 5px 0 #a3cf3f;cursor:pointer}.action button:disabled{opacity:.55}.success{margin-top:14px;padding:18px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;background:#f5ffe2}.check{width:44px;height:44px;border-radius:15px;background:#c9ff54;display:grid;place-items:center;font-size:22px;font-weight:1000}.success div:nth-child(2){display:grid;gap:3px}.success span{font-size:11px;color:#657054}.success a{color:#5731c4;font-size:11px;font-weight:1000;text-decoration:none}.status{margin:16px 2px 0;color:#6e6672;font-size:12px;line-height:1.5}.after{margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.after button,.after a{min-height:48px;border:1px solid #e3dce8;border-radius:15px;background:#fff;color:#6142c9;text-decoration:none;display:grid;place-items:center;font:inherit;font-size:10px;font-weight:1000;cursor:pointer}.truth{margin:18px 0 0;padding:16px 18px;border-radius:20px;background:#211730;color:#dcd2e2;font-size:11px;line-height:1.55}.truth b{color:#c9ff54}@media(max-width:650px){.asset{grid-template-columns:1fr}.viewer,.viewer :global(.viewerShell){min-height:280px}.action{align-items:stretch;flex-direction:column}.action button{width:100%}.success{grid-template-columns:auto 1fr}.success a{grid-column:1/-1;text-align:center;padding:10px}.after{grid-template-columns:1fr}.shell h1{font-size:50px}}
    `}</style>
  </main>;
}
