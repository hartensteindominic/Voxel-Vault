'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { deletePropertyDraft, exportPropertyDraft, readPropertyDrafts, setPropertyDraftWorldVisibility } from '../../../lib/property-drafts';
import { deletePropertyDraftFromAccount, savePropertyDraftToAccount, syncLocalPropertyDraftsToAccount } from '../../../lib/property-drafts-account';

export default function PropertyDraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [session, setSession] = useState(null);
  const [note, setNote] = useState('Your saved properties.');
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
        if (active) setNote(String(error?.message || error || 'Account sync is unavailable. Local Vault still works.'));
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

  async function toggleWorld(draft) {
    if (!session?.user) {
      setNote('Sign in once to share a property on World.');
      await signIn();
      return;
    }
    setBusy(draft.id);
    try {
      const next = setPropertyDraftWorldVisibility(draft.id, draft?.world?.public !== true);
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      await savePropertyDraftToAccount(client, session.user, next);
      refresh();
      setNote(next.world?.public ? 'Property is now visible on World.' : 'Property removed from World.');
    } catch (error) { setNote(String(error?.message || error)); }
    finally { setBusy(''); }
  }

  async function remove(id) {
    deletePropertyDraft(id);
    refresh();
    if (!session?.user) return;
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      await deletePropertyDraftFromAccount(client, session.user, id);
    } catch (error) { setNote(`Removed here. Account cleanup needs attention: ${String(error?.message || error)}`); }
  }

  return <main className="page">
    <header><Link href="/">V</Link><nav><Link href="/property">ADD</Link><Link href="/world">WORLD</Link></nav></header>
    <section className="hero"><small>YOUR VAULT</small><h1>Your properties.</h1><p>{note}</p>{!session?.user ? <button onClick={signIn}>SYNC WITH GOOGLE</button> : null}</section>

    {drafts.length ? <section className="grid">{drafts.map((draft) => <article key={draft.id}>
      <div className="visual"><div className="ground"/><div className={String(draft.geometryKind || '').includes('building') ? 'house' : 'land'}>{String(draft.geometryKind || '').includes('building') ? <><i/><i/></> : null}</div><span>{draft.world?.public ? 'WORLD' : draft.blockchain?.minted ? 'MINTED' : '3D'}</span></div>
      <div className="body"><small>{draft.blockchain?.minted ? 'MINTED PROPERTY' : '3D PROPERTY'}</small><h2>{draft.label || 'Saved property'}</h2>
        <div className="actions"><Link href={`/vault/property-drafts/${encodeURIComponent(draft.id)}`}>OPEN 3D</Link><button className={draft.world?.public ? 'active' : ''} onClick={() => toggleWorld(draft)} disabled={busy === draft.id}>{draft.world?.public ? 'ON WORLD' : 'WORLD'}</button><Link href="/vault/properties/claim">VERIFY + MINT</Link></div>
        <div className="more"><button onClick={() => exportPropertyDraft(draft)}>EXPORT</button><button onClick={() => remove(draft.id)}>REMOVE</button></div>
      </div>
    </article>)}</section> : <section className="empty"><b>NO PROPERTIES YET</b><span>Add one address. Voxel Vault will make the 3D draft first.</span><Link href="/property">+ ADD PROPERTY</Link></section>}

    <p className="truth">Vault holds the digital property model. Real ownership, fractional rights and title remain separate until verified by the actual provider/legal records.</p>
    <style jsx>{`
      :global(body){margin:0;background:#070909;color:#f5f8f6;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:12px clamp(10px,3vw,32px) 82px;background:radial-gradient(circle at 80% 3%,rgba(121,239,188,.1),transparent 27%),#070909}header{height:48px;display:flex;align-items:center;justify-content:space-between}header>a{width:34px;height:34px;border-radius:11px;background:#f5f8f6;color:#06100e;text-decoration:none;display:grid;place-items:center;font-weight:1000}nav{display:flex;gap:6px}nav a{padding:10px;color:#93a19c;text-decoration:none;font-size:7px;font-weight:950;letter-spacing:.1em}.hero{max-width:1100px;margin:48px auto 18px}.hero small{color:#79efbc;font-size:7px;font-weight:950;letter-spacing:.14em}.hero h1{font-size:clamp(48px,8vw,88px);line-height:.9;letter-spacing:-.065em;margin:8px 0}.hero p{color:#73817c;font-size:9px}.hero button{margin-top:8px;border:0;border-radius:11px;background:#16201c;color:#a8b6b0;padding:10px 12px;font-size:7px;font-weight:950;letter-spacing:.08em}.grid{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:9px}.grid article{overflow:hidden;border:1px solid rgba(255,255,255,.07);border-radius:22px;background:rgba(255,255,255,.022)}.visual{height:180px;position:relative;overflow:hidden;background:radial-gradient(circle at 50% 35%,rgba(121,239,188,.12),transparent 30%),#0b0f0e}.ground{position:absolute;left:11%;right:11%;bottom:17%;height:32%;border:1px solid rgba(121,239,188,.28);transform:perspective(340px) rotateX(62deg);border-radius:14px}.house{position:absolute;left:30%;right:30%;bottom:30%;height:38%;background:#cbd4d0}.house:before{content:'';position:absolute;left:-10%;right:-10%;top:-13%;height:18%;background:#34413c}.house i{position:absolute;bottom:18%;width:20%;height:34%;background:#79efbc}.house i:first-child{left:18%}.house i:last-child{right:18%}.land{position:absolute;left:24%;right:24%;bottom:25%;height:28%;border:2px solid #79efbc;transform:perspective(320px) rotateX(62deg);border-radius:12px;background:rgba(121,239,188,.08)}.visual span{position:absolute;top:12px;left:12px;padding:7px 9px;border-radius:999px;background:rgba(4,8,7,.72);border:1px solid rgba(255,255,255,.08);font-size:6px;font-weight:950;letter-spacing:.1em;color:#b8e6d4}.body{padding:16px}.body small{color:#66766f;font-size:6px;font-weight:950;letter-spacing:.1em}.body h2{font-size:22px;letter-spacing:-.04em;margin:5px 0 14px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}.actions a,.actions button{min-height:42px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:#131916;color:#b4c0bb;text-decoration:none;display:grid;place-items:center;font:inherit;font-size:6.5px;font-weight:950;letter-spacing:.08em;cursor:pointer}.actions a:first-child{background:#eef3f1;color:#07100c}.actions a:last-child{grid-column:1/-1}.actions .active{background:#79efbc;color:#06100e}.more{margin-top:7px;display:flex;gap:10px}.more button{border:0;background:none;color:#4f5e58;font-size:6px;font-weight:900;letter-spacing:.08em;padding:4px 0}.empty{max-width:720px;margin:60px auto;padding:26px;border:1px dashed rgba(121,239,188,.2);border-radius:20px;display:grid;gap:9px}.empty b{font-size:11px}.empty span{color:#6c7d76;font-size:9px}.empty a{justify-self:start;margin-top:5px;background:#79efbc;color:#06100e;text-decoration:none;border-radius:11px;padding:12px 14px;font-size:7px;font-weight:950;letter-spacing:.08em}.truth{max-width:1100px;margin:14px auto;color:#4d5c56;font-size:7px;line-height:1.5}@media(max-width:620px){.page{padding:10px 10px calc(78px + env(safe-area-inset-bottom))}.hero{margin-top:32px}.hero h1{font-size:54px}.grid{grid-template-columns:1fr}.visual{height:165px}}
    `}</style>
  </main>;
}
