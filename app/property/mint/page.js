'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import MeshyModelViewer from '../../vault/earth/MeshyModelViewer';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { connectVoxelFlipWallet, mintVoxelFlip } from '../../../lib/voxelflip';

function clean(value) { return String(value || '').trim(); }
function short(value) { const text = clean(value); return text ? `${text.slice(0, 7)}…${text.slice(-5)}` : ''; }
function errorText(error) { return String(error?.reason || error?.shortMessage || error?.message || error || 'Minting failed.'); }
function storageKey(draftId, taskId) { return `voxelpop:property-mint:${draftId}:${taskId}`; }

export default function PropertyVoxelMintPage() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [params, setParams] = useState({ draftId: '', taskId: '', name: 'VoxelPop Property', modelUrl: '' });
  const [wallet, setWallet] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Opening your finished voxel…');
  const [minted, setMinted] = useState(null);
  const clientRef = useRef(null);

  const modelUrl = useMemo(() => clean(params.modelUrl), [params.modelUrl]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const next = {
      draftId: clean(query.get('draftId')),
      taskId: clean(query.get('taskId')),
      name: clean(query.get('name')) || 'VoxelPop Property',
      modelUrl: clean(query.get('modelUrl')),
    };
    setParams(next);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(next.draftId, next.taskId)) || 'null');
      if (saved?.verified && saved?.tokenId) {
        setMinted(saved);
        setWallet(saved.owner || '');
        setMessage(`VoxelFlip #${saved.tokenId} is already verified for this voxel.`);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      if (!active) return;
      setSession(data.session || null);
      setAuthReady(true);
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
      });
      subscription = auth.data.subscription;
    }).catch(() => {
      if (active) {
        setAuthReady(true);
        setMessage('Sign-in setup is unavailable on this deployment.');
      }
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  async function signIn() {
    setBusy('signin');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
      if (error) throw error;
    } catch (error) {
      setBusy('');
      setMessage(errorText(error));
    }
  }

  async function mint() {
    if (!session?.access_token || !params.draftId || !params.taskId || !modelUrl || busy || minted) return;
    let connected = null;
    setBusy('wallet');
    setMessage('Connect the wallet that should own this digital voxel. Nothing is sent yet.');
    try {
      connected = await connectVoxelFlipWallet();
      setWallet(connected.address);
      setBusy('prepare');
      setMessage('Checking this finished voxel and its one-time Base mint voucher…');
      const response = await fetch('/api/property-voxel-nft/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ draftId: params.draftId, taskId: params.taskId, wallet: connected.address, name: params.name }),
      });
      const prepared = await response.json().catch(() => ({}));
      if (!response.ok || !prepared?.ready || !prepared?.signature) throw new Error(prepared?.error || 'This finished voxel could not be prepared for minting.');

      setBusy('mint');
      setMessage('Confirm the one-of-one mint in your wallet.');
      const result = await mintVoxelFlip({ metadataUrl: prepared.metadataUrl, voucherId: prepared.voucherId, signature: prepared.signature });
      if (!result?.tokenId || !result?.hash) throw new Error('The wallet transaction completed, but the token ID could not be read.');

      setBusy('verify');
      setMessage(`VoxelFlip #${result.tokenId} was submitted. Verifying it on Base…`);
      const confirm = await fetch('/api/property-voxel-nft/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          draftId: params.draftId,
          taskId: params.taskId,
          name: params.name,
          wallet: result.owner || connected.address,
          tokenId: result.tokenId,
          txHash: result.hash,
        }),
      });
      const verified = await confirm.json().catch(() => ({}));
      if (!confirm.ok || !verified?.verified) throw new Error(verified?.error || `VoxelFlip #${result.tokenId} was submitted, but verification is not complete. Do not mint it again.`);
      const finalResult = { ...result, ...verified, verified: true };
      setMinted(finalResult);
      setWallet(finalResult.owner || connected.address);
      try { localStorage.setItem(storageKey(params.draftId, params.taskId), JSON.stringify(finalResult)); } catch {}
      setMessage(`Done. VoxelFlip #${finalResult.tokenId} is verified and owned by ${short(finalResult.owner)}.`);
    } catch (error) {
      if (error?.code === 'NO_WALLET_PROVIDER' && error?.deepLink) {
        window.location.href = error.deepLink;
        return;
      }
      setMessage(errorText(error));
    } finally {
      setBusy('');
    }
  }

  const invalid = !params.draftId || !params.taskId || !modelUrl;
  if (!authReady) return <main className="page"><section className="shell"><div className="mark">V</div><h1>Opening mint…</h1><p className="status">{message}</p><style jsx>{styles}</style></section></main>;

  return <main className="page"><section className="shell">
    <nav><Link href="/property">← CREATE</Link><span>VOXELPOP · MINT</span><Link href="/vault/property-drafts">INVENTORY</Link></nav>

    {invalid ? <section className="notice"><b>Open Mint from a finished VoxelPop 3D voxel.</b><Link href="/property">Create a voxel</Link></section> : <>
      <header>
        <div className="ready">✓ 3D VOXEL SAVED · ONE MINT MAX</div>
        <h1>{minted ? 'Mint complete.' : 'Mint your voxel.'}</h1>
        <p>{minted ? 'Your digital voxel is verified on Base.' : 'It is already safe in your Voxel Vault inventory. Minting is optional.'}</p>
      </header>

      <div className="viewer"><MeshyModelViewer modelUrl={modelUrl}/><span>{minted ? `VOXELFLIP #${minted.tokenId}` : 'YOUR GENERATED 3D VOXEL'}</span></div>

      {minted ? <section className="done">
        <div className="doneMark">✓</div>
        <b>VoxelFlip #{minted.tokenId}</b>
        <span>Verified owner · {short(minted.owner)}</span>
        <div className="links">{minted.openSeaUrl ? <a href={minted.openSeaUrl} target="_blank" rel="noreferrer">OpenSea ↗</a> : null}{minted.explorerUrl ? <a href={minted.explorerUrl} target="_blank" rel="noreferrer">Transaction ↗</a> : null}<Link href="/vault/property-drafts">Open inventory</Link></div>
      </section> : <section className="actions">
        {!session?.user ? <button className="primary" type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening Google…' : 'Sign in to mint'}</button> : <button className="primary" type="button" onClick={mint} disabled={Boolean(busy)}>{busy === 'wallet' ? 'Connecting wallet…' : busy === 'prepare' ? 'Checking voxel…' : busy === 'mint' ? 'Confirm in wallet…' : busy === 'verify' ? 'Verifying…' : 'Mint this voxel'}</button>}
        <Link className="later" href="/vault/property-drafts">Keep in inventory</Link>
        <small>One property can mint only one VoxelPop NFT.</small>
      </section>}

      {wallet && !minted ? <p className="wallet">Wallet · {short(wallet)}</p> : null}
      <p className="status" role="status">{message}</p>
      <p className="truth">The NFT represents the finished digital VoxelPop voxel only. It is not the deed, title, equity, rent, occupancy, investment rights, or ownership of the physical property.</p>
    </>}
    <style jsx>{styles}</style>
  </section></main>;
}

const styles = `
:global(body){margin:0;background:#fffaf2;color:#281b12;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}.page{min-height:100vh;padding:10px 12px calc(92px + env(safe-area-inset-bottom));background:radial-gradient(circle at 90% 8%,rgba(113,56,245,.12),transparent 30%),radial-gradient(circle at 10% 88%,rgba(201,255,84,.18),transparent 28%),#fffaf2}.shell{width:min(680px,100%);margin:auto;text-align:center}nav{height:48px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:8px;font-weight:1000;letter-spacing:.1em;color:#8c8179}nav a{color:#6b4db2;text-decoration:none;padding:8px}header{margin:26px auto 14px}.ready{display:inline-flex;padding:7px 10px;border:1px solid #cce99b;border-radius:999px;background:#f5ffe4;color:#527025;font-size:8px;font-weight:1000;letter-spacing:.08em}header h1{font-size:clamp(39px,8vw,56px);line-height:.94;letter-spacing:-.055em;margin:14px 0 8px}header p{max-width:520px;margin:0 auto;color:#786e67;font-size:12px;line-height:1.5}.viewer{position:relative;width:100%;height:min(58vh,520px);min-height:350px;overflow:hidden;border:1px solid #e4dacf;border-radius:26px;background:#21172c;box-shadow:0 20px 48px rgba(70,47,87,.13)}.viewer>div{height:100%!important;min-height:100%!important}.viewer :global(.viewerShell){position:absolute!important;inset:0!important;min-height:100%!important;border-radius:0!important}.viewer>span{position:absolute;z-index:7;left:12px;top:12px;padding:8px 10px;border:1px solid rgba(255,255,255,.5);border-radius:999px;background:rgba(32,23,39,.76);color:#fff;font-size:7px;font-weight:1000;letter-spacing:.08em;backdrop-filter:blur(10px)}.actions{display:grid;gap:9px;margin-top:12px;padding:14px;border:1px solid #e7ded4;border-radius:21px;background:#fff}.primary,.later{width:100%;min-height:57px;border-radius:17px;display:flex;align-items:center;justify-content:center;font:950 16px inherit;text-decoration:none}.primary{border:0;background:#7138f5;color:#fff;box-shadow:0 6px 0 #5120d0;cursor:pointer}.primary:disabled{opacity:.5;box-shadow:none}.later{border:1px solid #ddd2eb;background:#fff;color:#6846b7}.actions small{color:#938a83;font-size:9px}.status{min-height:18px;margin:12px auto 0;max-width:590px;color:#6f655e;font-size:10px;font-weight:700;line-height:1.5}.wallet{margin:10px 0 0;font-size:8px;color:#8c8179}.truth{max-width:610px;margin:11px auto;color:#9c938c;font-size:8px;line-height:1.55}.done{display:grid;gap:9px;margin-top:12px;padding:19px;border:1px solid #d8edac;border-radius:21px;background:#f7ffe8}.doneMark,.mark{width:54px;height:54px;margin:auto;border-radius:17px;background:#c9ff54;color:#456318;display:grid;place-items:center;font-size:25px;font-weight:1000;box-shadow:0 6px 0 #aada35}.done>b{font-size:20px}.done>span{font-size:10px;color:#6f7b59}.links{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:3px}.links a{min-height:47px;display:grid;place-items:center;border:1px solid #dfd7e4;border-radius:13px;background:#fff;color:#614fa2;text-decoration:none;font-size:9px;font-weight:950}.links a:last-child{grid-column:1/-1;background:#21172c;color:#fff;border:0}.notice{margin-top:70px;display:grid;gap:14px;padding:28px;border:1px solid #e6ddd5;border-radius:22px;background:#fff}.notice b{font-size:20px}.notice a{color:#7138f5;font-weight:900}.mark{margin-top:70px}.shell>.mark+h1{font-size:36px;letter-spacing:-.04em}.page button:focus-visible,.page a:focus-visible{outline:3px solid rgba(113,56,245,.24);outline-offset:3px}@media(max-width:520px){.page{padding:8px 8px calc(78px + env(safe-area-inset-bottom))}.viewer{min-height:330px;border-radius:21px}.links{grid-template-columns:1fr}.links a:last-child{grid-column:auto}}
`;
