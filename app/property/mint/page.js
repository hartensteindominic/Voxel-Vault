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
  const [params, setParams] = useState({ draftId: '', taskId: '', name: 'VoxelPop Property' });
  const [wallet, setWallet] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Opening your finished property voxel…');
  const [minted, setMinted] = useState(null);
  const clientRef = useRef(null);

  const modelUrl = useMemo(() => params.taskId?.startsWith('local-v1:')
    ? `/api/property-local-voxel?taskId=${encodeURIComponent(params.taskId)}`
    : '', [params.taskId]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const next = {
      draftId: clean(query.get('draftId')),
      taskId: clean(query.get('taskId')),
      name: clean(query.get('name')) || 'VoxelPop Property',
    };
    setParams(next);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(next.draftId, next.taskId)) || 'null');
      if (saved?.verified && saved?.tokenId) {
        setMinted(saved);
        setWallet(saved.owner || '');
        setMessage(`VoxelFlip #${saved.tokenId} is already verified for this finished voxel.`);
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
      setMessage('Checking this exact finished voxel and its one-time Base mint voucher…');
      const response = await fetch('/api/property-voxel-nft/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ draftId: params.draftId, taskId: params.taskId, wallet: connected.address, name: params.name }),
      });
      const prepared = await response.json().catch(() => ({}));
      if (!response.ok || !prepared?.ready || !prepared?.signature) {
        throw new Error(prepared?.error || 'This finished voxel could not be prepared for minting.');
      }

      setBusy('mint');
      setMessage('Confirm the VoxelFlip mint in your wallet. This is the only blockchain transaction in this step.');
      const result = await mintVoxelFlip({ metadataUrl: prepared.metadataUrl, voucherId: prepared.voucherId, signature: prepared.signature });
      if (!result?.tokenId || !result?.hash) throw new Error('The wallet transaction completed, but the token ID could not be read.');

      setBusy('verify');
      setMessage(`VoxelFlip #${result.tokenId} was submitted. Verifying ownership and metadata on Base…`);
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
      if (!confirm.ok || !verified?.verified) {
        throw new Error(verified?.error || `VoxelFlip #${result.tokenId} was submitted, but Base verification is not complete. Do not mint it again.`);
      }
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

  const invalid = !params.draftId || !params.taskId?.startsWith('local-v1:');
  if (!authReady) return <main className="page"><section className="shell"><div className="mark">V</div><h1>Opening mint…</h1><p>{message}</p><style jsx>{styles}</style></section></main>;

  return <main className="page"><section className="shell">
    <nav><Link href="/property">← PROPERTY</Link><span>VOXELPOP · FINAL STEP</span><Link href="/vault">VAULT</Link></nav>
    <header><small>3D PREVIEW ✓ · VOXEL ✓ · MINT</small><h1>Mint the voxel.<br/><em>Not the house.</em></h1><p>The NFT is the finished digital VoxelPop model you just created. It is not the deed, title, equity, rent rights, or ownership of the physical property.</p></header>

    {invalid ? <section className="notice"><b>Open Mint from a finished property voxel.</b><Link href="/property">Create a property voxel</Link></section> : <>
      <div className="viewer"><MeshyModelViewer modelUrl={modelUrl}/><span>FINAL LOCAL 3D VOXEL</span></div>
      <section className="facts">
        <div><small>MODEL</small><b>Photo-approved local voxel</b></div>
        <div><small>NETWORK</small><b>Base</b></div>
        <div><small>MESHY</small><b>Not used</b></div>
        <div><small>REAL PROPERTY</small><b>No rights transferred</b></div>
      </section>

      {!session?.user ? <button className="primary" type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening Google…' : 'Sign in to mint'}</button> : minted ? <section className="done">
        <div className="doneMark">✓</div>
        <b>VoxelFlip #{minted.tokenId}</b>
        <span>Verified owner · {short(minted.owner)}</span>
        <div className="links">{minted.openSeaUrl ? <a href={minted.openSeaUrl} target="_blank" rel="noreferrer">View on OpenSea ↗</a> : null}{minted.explorerUrl ? <a href={minted.explorerUrl} target="_blank" rel="noreferrer">View transaction ↗</a> : null}<Link href="/vault">Open Vault</Link></div>
      </section> : <button className="primary" type="button" onClick={mint} disabled={Boolean(busy)}>{busy === 'wallet' ? 'Connecting wallet…' : busy === 'prepare' ? 'Checking voxel…' : busy === 'mint' ? 'Confirm in wallet…' : busy === 'verify' ? 'Verifying on Base…' : 'Connect wallet + Mint digital voxel'}</button>}
      {wallet && !minted ? <p className="wallet">Wallet · {short(wallet)}</p> : null}
      <p className="status" role="status">{message}</p>
      <p className="truth">Your wallet approves the Base transaction itself; Voxel Vault does not auto-sign or auto-spend. The one-time voucher prevents a second mint of this same finished local voxel. The original property photo is not placed in NFT metadata.</p>
    </>}
    <style jsx>{styles}</style>
  </section></main>;
}

const styles = `
:global(body){margin:0;background:#fffaf0;color:#281a10;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:18px 14px calc(52px + env(safe-area-inset-bottom));background:radial-gradient(circle at 10% 8%,#fff0cc,transparent 28%),radial-gradient(circle at 90% 10%,#eee5ff,transparent 29%),radial-gradient(circle at 50% 96%,#efffc8,transparent 26%),#fffaf0}.shell{width:min(700px,100%);margin:auto;text-align:center}nav{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:8px;font-weight:950;letter-spacing:.12em;color:#8b7f76}nav a{color:#684db4;text-decoration:none}header{margin:50px auto 24px}header small{color:#7138f5;font-weight:1000;letter-spacing:.14em;font-size:9px}header h1{font-size:clamp(44px,10vw,72px);line-height:.9;letter-spacing:-.06em;margin:11px 0 16px}header h1 em{font-style:normal;color:#7138f5}header p{max-width:600px;margin:auto;color:#7f736b;font-size:13px;line-height:1.6}.viewer{position:relative;width:100%;height:470px;overflow:hidden;border-radius:38px;background:#21172c;border:1px solid #e3d9cf;box-shadow:0 24px 58px rgba(80,50,25,.18)}.viewer>div{height:100%!important;min-height:100%!important}.viewer :global(.viewerShell){position:absolute!important;inset:0!important;min-height:100%!important;border-radius:0!important}.viewer>span{position:absolute;z-index:7;top:17px;left:17px;padding:9px 12px;border-radius:999px;background:rgba(28,19,13,.76);color:#fff;font-size:8px;font-weight:950;letter-spacing:.1em}.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.facts div{padding:13px 10px;border:1px solid #e7ded3;border-radius:16px;background:#fff;text-align:left}.facts small{display:block;color:#95887d;font-size:7px;font-weight:950;letter-spacing:.08em}.facts b{display:block;margin-top:5px;font-size:9px;line-height:1.35}.primary{width:100%;min-height:66px;border:0;border-radius:23px;background:linear-gradient(180deg,#7d42ff,#6630e9);color:#fff;box-shadow:0 9px 0 #4d1bc5,0 18px 32px rgba(116,72,244,.21);font:1000 18px inherit;cursor:pointer}.primary:disabled{opacity:.58;box-shadow:none}.status{min-height:22px;margin:18px auto 0;max-width:600px;color:#6f645c;font-size:12px;font-weight:750;line-height:1.5}.wallet{font-size:9px;color:#85796f}.truth{max-width:620px;margin:13px auto;color:#9e948c;font-size:8.5px;line-height:1.6}.done{display:grid;gap:10px;padding:22px;border:1px solid #d9ecb2;border-radius:28px;background:#f7ffe8}.doneMark,.mark{width:64px;height:64px;margin:auto;border-radius:21px;background:#c9ff54;color:#456318;display:grid;place-items:center;font-size:29px;font-weight:1000;box-shadow:0 8px 0 #aada35}.done>b{font-size:22px}.done>span{font-size:11px;color:#6f7b59}.links{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:5px}.links a{min-height:48px;display:grid;place-items:center;border-radius:15px;background:#fff;border:1px solid #dfd7e4;color:#614fa2;text-decoration:none;font-size:9px;font-weight:950}.links a:last-child{grid-column:1/-1;background:#21172c;color:#fff}.notice{display:grid;gap:13px;padding:30px;border:1px dashed #d9ccff;border-radius:28px;background:#fff}.notice a{padding:14px;border-radius:14px;background:#7138f5;color:#fff;text-decoration:none;font-weight:900}@media(max-width:620px){.page{padding:12px 10px calc(40px + env(safe-area-inset-bottom))}header{margin-top:42px}.viewer{height:410px;border-radius:30px}.facts{grid-template-columns:1fr 1fr}.links{grid-template-columns:1fr}.links a:last-child{grid-column:auto}.primary{min-height:61px;border-radius:20px;font-size:17px}}`;
