'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { deletePropertyDraft, readPropertyDrafts } from '../../../lib/property-drafts';
import { deletePropertyDraftFromAccount, syncLocalPropertyDraftsToAccount } from '../../../lib/property-drafts-account';

function clean(value) { return String(value || '').trim(); }
function mintHref(draft) {
  const draftId = clean(draft?.voxelpop?.creationDraftId);
  const taskId = clean(draft?.visual?.modelTaskId || draft?.voxelpop?.modelTaskId);
  const modelUrl = clean(draft?.visual?.modelUrl || draft?.voxelpop?.modelUrl);
  if (!draftId || !taskId || !modelUrl) return '';
  const name = clean(draft?.label) || 'VoxelPop Property';
  return `/property/mint?draftId=${encodeURIComponent(draftId)}&taskId=${encodeURIComponent(taskId)}&name=${encodeURIComponent(name)}&modelUrl=${encodeURIComponent(modelUrl)}`;
}

export default function PropertyDraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [session, setSession] = useState(null);
  const [note, setNote] = useState('Your finished house voxels live here.');
  const [busy, setBusy] = useState('');
  const clientRef = useRef(null);

  function refresh() { setDrafts(readPropertyDrafts()); }

  useEffect(() => {
    let active = true;
    let subscription = null;
    refresh();
    async function apply(client, nextSession) {
      if (!active) return;
      setSession(nextSession || null);
      if (!nextSession?.user) { refresh(); return; }
      try {
        const merged = await syncLocalPropertyDraftsToAccount(client, nextSession.user);
        if (active) setDrafts(merged);
      } catch (error) {
        if (active) setNote(String(error?.message || error || 'Account sync is unavailable. Your local inventory still works.'));
      }
    }
    getSupabaseBrowserAsync().then(async (client) => {
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      await apply(client, data.session || null);
      const auth = client.auth.onAuthStateChange((_event, next) => apply(client, next));
      subscription = auth.data.subscription;
    }).catch(() => {});
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  async function signIn() {
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: new URL('/vault/property-drafts', window.location.origin).toString() } });
      if (error) throw error;
    } catch (error) { setNote(String(error?.message || error || 'Could not sign in.')); }
  }

  async function remove(draft) {
    if (!draft?.id || busy) return;
    setBusy(draft.id);
    deletePropertyDraft(draft.id);
    refresh();
    if (session?.user) {
      try {
        const client = clientRef.current || await getSupabaseBrowserAsync();
        clientRef.current = client;
        await deletePropertyDraftFromAccount(client, session.user, draft.id);
      } catch (error) {
        setNote(`Removed on this device. Account cleanup needs attention: ${String(error?.message || error)}`);
      }
    }
    setBusy('');
  }

  return <main className="page">
    <header><Link className="mark" href="/">V</Link><nav><Link href="/property">Create</Link></nav></header>

    <section className="hero">
      <small>VOXEL VAULT · INVENTORY</small>
      <h1>Your voxels.</h1>
      <p>{note}</p>
      {!session?.user ? <button type="button" onClick={signIn}>Sync with Google</button> : null}
      <Link className="create" href="/property">+ Create another house</Link>
    </section>

    {drafts.length ? <section className="grid">{drafts.map((draft) => {
      const preview = clean(draft?.visual?.thumbnailUrl);
      const modelUrl = clean(draft?.visual?.modelUrl || draft?.voxelpop?.modelUrl);
      const taskId = clean(draft?.visual?.modelTaskId || draft?.voxelpop?.modelTaskId);
      const canOpen = Boolean(modelUrl && taskId);
      const directMint = mintHref(draft);
      const minted = Boolean(draft?.blockchain?.minted);
      const address = clean(draft?.voxelpop?.propertyAddress || draft?.world?.address);
      return <article key={draft.id}>
        <div className="visual">
          {preview ? <img src={preview} alt={draft.label || 'House voxel preview'}/> : <div className="cube" aria-hidden="true"><i/><i/><i/></div>}
          <span>{minted ? 'MINTED' : '3D VOXEL'}</span>
        </div>
        <div className="body">
          <small>{minted ? 'MINTED · SAVED' : directMint ? 'SAVED · MINT OPTIONAL' : 'SAVED'}</small>
          <h2>{draft.label || 'VoxelPop House'}</h2>
          {address ? <p>{address}</p> : null}
          <div className="actions">
            {canOpen ? <Link href={`/vault/property-drafts/${encodeURIComponent(draft.id)}`}>Open 3D</Link> : null}
            {directMint && !minted ? <Link className="mint" href={directMint}>Mint voxel</Link> : null}
            <button type="button" onClick={() => remove(draft)} disabled={busy === draft.id}>{busy === draft.id ? 'Removing…' : 'Remove'}</button>
          </div>
        </div>
      </article>;
    })}</section> : <section className="empty">
      <div className="cube" aria-hidden="true"><i/><i/><i/></div>
      <b>No house voxels yet.</b>
      <span>Photo → confirm address → voxel image → 3D voxel → keep or mint.</span>
      <Link href="/property">Create first voxel</Link>
    </section>}

    <p className="truth">These are digital collectibles. Saving or minting a voxel does not transfer deed, title, occupancy, rent, equity, or other rights in the physical property.</p>
    <style jsx>{`
      :global(body){margin:0;background:#fffaf2;color:#211810;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}.page{min-height:100vh;padding:10px clamp(10px,3vw,28px) calc(90px + env(safe-area-inset-bottom));background:radial-gradient(circle at 92% 7%,rgba(113,56,245,.12),transparent 28%),radial-gradient(circle at 7% 88%,rgba(201,255,84,.18),transparent 28%),#fffaf2}header{max-width:900px;height:54px;margin:auto;display:flex;align-items:center;justify-content:space-between}.mark{width:40px;height:40px;border-radius:13px;background:#7138f5;color:#fff;text-decoration:none;display:grid;place-items:center;font-weight:1000;box-shadow:0 5px 0 #5120d0}nav a{padding:10px 14px;border:1px solid #e1dbe7;border-radius:999px;background:#fff;color:#5d4a85;text-decoration:none;font-size:10px;font-weight:950}.hero{max-width:900px;margin:42px auto 22px;text-align:center}.hero small{color:#7138f5;font-size:9px;font-weight:1000;letter-spacing:.13em}.hero h1{margin:12px 0 8px;font-size:clamp(50px,9vw,78px);line-height:.92;letter-spacing:-.06em}.hero p{margin:0 auto 14px;color:#7b727c;font-size:12px}.hero>button{margin:0 0 10px;border:1px solid #ddd6e5;border-radius:999px;background:#fff;color:#65566e;padding:10px 14px;font:900 10px inherit}.create{width:min(420px,100%);min-height:55px;margin:8px auto 0;border-radius:17px;background:#7138f5;color:#fff;text-decoration:none;display:grid;place-items:center;font-size:13px;font-weight:1000;box-shadow:0 6px 0 #5120d0}.grid{max-width:900px;margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px}.grid article{overflow:hidden;border:1px solid #e5dfe7;border-radius:24px;background:#fff;box-shadow:0 14px 38px rgba(70,48,88,.07)}.visual{height:230px;position:relative;display:grid;place-items:center;overflow:hidden;background:#21172c}.visual>img{width:100%;height:100%;object-fit:cover;display:block}.visual>span{position:absolute;left:12px;top:12px;padding:7px 9px;border-radius:999px;background:#c9ff54;color:#314b0b;font-size:7px;font-weight:1000;letter-spacing:.08em}.body{padding:16px}.body>small{color:#7138f5;font-size:7.5px;font-weight:1000;letter-spacing:.09em}.body h2{margin:6px 0 4px;font-size:22px;letter-spacing:-.04em}.body p{margin:0 0 12px;color:#817782;font-size:9px;line-height:1.4}.actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.actions a,.actions button{min-height:45px;border:1px solid #e2dbe6;border-radius:13px;background:#fff;color:#5f5566;text-decoration:none;display:grid;place-items:center;font:900 8px inherit;cursor:pointer}.actions a:first-child{background:#7138f5;color:#fff;border:0}.actions .mint{background:#21172c;color:#fff;border:0}.actions button{grid-column:1/-1;color:#9a8e97}.actions button:disabled{opacity:.5}.empty{max-width:680px;margin:28px auto;padding:38px 22px;border:1px solid #e5dfe7;border-radius:27px;background:#fff;display:grid;justify-items:center;gap:10px;text-align:center}.empty b{font-size:23px}.empty span{color:#7b727c;font-size:12px}.empty a{margin-top:7px;padding:14px 17px;border-radius:15px;background:#7138f5;color:#fff;text-decoration:none;font-size:11px;font-weight:1000;box-shadow:0 6px 0 #5120d0}.cube{position:relative;width:64px;height:64px;border-radius:13px;background:#c9ff54;box-shadow:0 7px 0 #aada35;transform:rotate(8deg)}.cube i{position:absolute;width:14px;height:14px;background:#7138f5}.cube i:nth-child(1){left:10px;top:10px}.cube i:nth-child(2){right:10px;top:10px}.cube i:nth-child(3){left:25px;bottom:10px}.truth{max-width:900px;margin:15px auto;color:#9b929b;font-size:8px;line-height:1.5;text-align:center}.page a:focus-visible,.page button:focus-visible{outline:3px solid rgba(113,56,245,.24);outline-offset:3px}@media(max-width:560px){.hero{margin-top:30px}.grid{grid-template-columns:1fr}.visual{height:220px}}
    `}</style>
  </main>;
}
