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
  const [message, setMessage] = useState('Opening your finished voxel…');
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
      if (!response.ok || !prepared?.ready || !prepared?.signature) {
        throw new Error(prepared?.error || 'This finished voxel could not be prepared for minting.');
      }

      setBusy('mint');
      setMessage('Confirm the VoxelFlip mint in your wallet. This is the only blockchain transaction in this step.');
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
  if (!authReady) return <main className="page"><section className="shell"><div className="mark">V</div><h1>Opening mint…</h1><p className="status">{message}</p><style jsx>{styles}</style></section></main>;

  return <main className="page"><section className="shell">
    <nav><Link href="/property">← CREATE</Link><span>VOXELPOP · MINT</span><Link href="/vault/property-drafts">VAULT</Link></nav>

    {invalid ? <section className="notice"><b>Open Mint from a finished VoxelPop voxel.</b><Link href="/property">Create a voxel</Link></section> : <>
      <header>
        <div className="paid">✓ 3D VOXEL PHOTO APPROVED · MOVABLE 3D VOXEL READY</div>
        <h1>{minted ? 'Mint complete.' : 'Mint your voxel.'}</h1>
        <p>{minted ? 'Your finished digital voxel is verified on Base.' : 'Your voxel is already saved in Vault. Minting is optional.'}</p>
      </header>

      <div className="viewer"><MeshyModelViewer modelUrl={modelUrl}/><span>{minted ? `VOXELFLIP #${minted.tokenId}` : 'FINAL 3D VOXEL'}</span></div>

      {minted ? <section className="done">
        <div className="doneMark">✓</div>
        <b>VoxelFlip #{minted.tokenId}</b>
        <span>Verified owner · {short(minted.owner)}</span>
        <div className="links">{minted.openSeaUrl ? <a href={minted.openSeaUrl} target="_blank" rel="noreferrer">View on OpenSea ↗</a> : null}{minted.explorerUrl ? <a href={minted.explorerUrl} target="_blank" rel="noreferrer">View transaction ↗</a> : null}<Link href="/vault/property-drafts">Open Vault</Link></div>
      </section> : <section className="actions">
        {!session?.user ? <button className="primary" type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening Google…' : 'Sign in to Mint'}</button> : <button className="primary" type="button" onClick={mint} disabled={Boolean(busy)}>{busy === 'wallet' ? 'Connecting wallet…' : busy === 'prepare' ? 'Checking voxel…' : busy === 'mint' ? 'Confirm in wallet…' : busy === 'verify' ? 'Verifying on Base…' : 'Mint Now'}</button>}
        <Link className="later" href="/vault/property-drafts">Mint Later</Link>
        <small>Optional minting · no wallet is required to keep the voxel in Vault.</small>
      </section>}

      {wallet && !minted ? <p className="wallet">Wallet · {short(wallet)}</p> : null}
      <p className="status" role="status">{message}</p>

      <details className="details"><summary>Mint details</summary><div className="facts"><div><small>NETWORK</small><b>Base</b></div><div><small>MODEL</small><b>Photo-approved voxel</b></div><div><small>MESHY</small><b>Not used</b></div><div><small>PHYSICAL PROPERTY</small><b>No rights transferred</b></div></div><p>Your wallet approves the transaction itself; Voxel Vault does not auto-sign or auto-spend. The one-time voucher blocks a duplicate mint of the same finished voxel. The original property photo is not placed in NFT metadata.</p></details>
      <p className="truth">The NFT represents the finished digital VoxelPop voxel only. It is not the deed, title, equity, rent, occupancy, investment rights, or ownership of the physical property.</p>
    </>}
    <style jsx>{styles}</style>
  </section></main>;
}

const styles = `
:global(body){margin:0;background:#fffaf2;color:#281b12;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}.page{min-height:100vh;padding:12px 12px calc(108px + env(safe-area-inset-bottom));background:radial-gradient(circle at 10% 7%,rgba(255,224,166,.42),transparent 28%),radial-gradient(circle at 91% 9%,rgba(113,56,245,.13),transparent 29%),radial-gradient(circle at 50% 94%,rgba(201,255,84,.18),transparent 27%),#fffaf2}.shell{width:min(680px,100%);margin:auto;text-align:center}nav{height:48px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 3px;font-size:8px;font-weight:1000;letter-spacing:.11em;color:#8c8179}nav a{color:#6b4db2;text-decoration:none;padding:8px}header{margin:30px auto 16px}.paid{display:inline-flex;padding:7px 10px;border:1px solid #cce99b;border-radius:999px;background:#f5ffe4;color:#527025;font-size:8px;font-weight:1000;letter-spacing:.09em}header h1{font-size:clamp(38px,8vw,54px);line-height:.95;letter-spacing:-.055em;margin:14px 0 9px}header p{margin:0 auto;color:#786e67;font-size:13px;line-height:1.5}.viewer{position:relative;width:100%;height:min(62vh,560px);min-height:390px;overflow:hidden;border:1px solid #e4dacf;border-radius:30px;background:#21172c;box-shadow:0 22px 54px rgba(70,47,87,.14)}.viewer>div{height:100%!important;min-height:100%!important}.viewer :global(.viewerShell){position:absolute!important;inset:0!important;min-height:100%!important;border-radius:0!important}.viewer>span{position:absolute;z-index:7;left:13px;top:13px;padding:8px 10px;border:1px solid rgba(255,255,255,.56);border-radius:999px;background:rgba(32,23,39,.76);color:#fff;font-size:7px;font-weight:1000;letter-spacing:.09em;backdrop-filter:blur(10px)}.actions{display:grid;gap:10px;margin-top:14px;padding:16px;border:1px solid #e7ded4;border-radius:24px;background:rgba(255,255,255,.94);box-shadow:0 14px 34px rgba(74,52,88,.07)}.primary,.later{width:100%;min-height:59px;border-radius:19px;display:flex;align-items:center;justify-content:center;font:950 17px inherit;text-decoration:none}.primary{border:0;background:linear-gradient(180deg,#7d43ff,#6730ec);color:#fff;box-shadow:0 6px 0 #5120d0,0 14px 27px rgba(113,56,245,.17);cursor:pointer}.primary:disabled{opacity:.55;box-shadow:none}.later{border:1px solid #ddd2eb;background:#fff;color:#6846b7;box-shadow:0 8px 20px rgba(76,54,91,.06)}.actions small{color:#938a83;font-size:9px;line-height:1.45}.status{min-height:18px;margin:13px auto 0;max-width:590px;color:#6f655e;font-size:10.5px;font-weight:700;line-height:1.5}.wallet{margin:12px 0 0;font-size:8px;color:#8c8179}.details{margin-top:13px;border:1px solid #e7ded4;border-radius:18px;background:rgba(255,255,255,.72);text-align:left;overflow:hidden}.details summary{cursor:pointer;padding:13px 15px;color:#716569;font-size:9px;font-weight:1000;letter-spacing:.06em;list-style:none}.details summary::-webkit-details-marker{display:none}.details[open] summary{border-bottom:1px solid #eee5dc}.details>p{margin:0;padding:12px 15px 15px;color:#8c8179;font-size:8px;line-height:1.55}.facts{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:12px}.facts div{padding:10px;border:1px solid #eee5dc;border-radius:13px;background:#fff}.facts small{display:block;color:#9a8e85;font-size:6.5px;font-weight:1000;letter-spacing:.07em}.facts b{display:block;margin-top:4px;font-size:8.5px;line-height:1.3}.truth{max-width:610px;margin:12px auto;color:#9c938c;font-size:8px;line-height:1.55}.done{display:grid;gap:9px;margin-top:14px;padding:20px;border:1px solid #d8edac;border-radius:24px;background:#f7ffe8}.doneMark,.mark{width:56px;height:56px;margin:auto;border-radius:18px;background:#c9ff54;color:#456318;display:grid;place-items:center;font-size:26px;font-weight:1000;box-shadow:0 6px 0 #aada35}.done>b{font-size:20px}.done>span{font-size:10px;color:#6f7b59}.links{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}.links a{min-height:48px;display:grid;place-items:center;border:1px solid #dfd7e4;border-radius:14px;background:#fff;color:#614fa2;text-decoration:none;font-size:9px;font-weight:950}.links a:last-child{grid-column:1/-1;background:#21172c;color:#fff;border:0}.notice{margin-top:70px;display:grid;gap:13px;padding:28px;border:1px dashed #d9ccff;border-radius:25px;background:#fff}.notice a{padding:14px;border-radius:14px;background:#7138f5;color:#fff;text-decoration:none;font-weight:900}@media(max-width:620px){.page{padding:8px 9px calc(102px + env(safe-area-inset-bottom))}header{margin-top:22px}.viewer{height:54vh;min-height:360px;border-radius:25px}.actions{padding:14px;border-radius:21px}.primary,.later{min-height:56px;border-radius:18px;font-size:16px}.facts{grid-template-columns:1fr 1fr}.links{grid-template-columns:1fr}.links a:last-child{grid-column:auto}}@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}`;