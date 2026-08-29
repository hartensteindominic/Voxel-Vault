'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { deletePropertyDraft, exportPropertyDraft, readPropertyDrafts, setPropertyDraftWorldVisibility } from '../../../lib/property-drafts';
import { deletePropertyDraftFromAccount, savePropertyDraftToAccount, syncLocalPropertyDraftsToAccount } from '../../../lib/property-drafts-account';

function dollars(cents) {
  if (!Number(cents)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents) / 100);
}

export default function PropertyDraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [session, setSession] = useState(null);
  const [note, setNote] = useState('Your collected and saved voxel properties.');
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
      setNote('Sign in once to publish a property on public World.');
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
      setNote(next.world?.public ? 'Property is now visible on public World.' : 'Property is private in My World only.');
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
    <header><Link href="/">V</Link><nav><Link href="/property">Create</Link><Link href="/world">World</Link></nav></header>
    <section className="hero"><small>✦ YOUR VOXEL VAULT ✦</small><h1>Your collection.</h1><p>{note}</p>{!session?.user ? <button onClick={signIn}>SYNC WITH GOOGLE</button> : null}<div className="hub"><Link className="create" href="/property">+ Create Another</Link><Link className="world" href="/world">View My World</Link></div></section>

    {drafts.length ? <section className="grid">{drafts.map((draft) => {
      const collected = draft?.commerce?.kind === 'property_voxel_collectible' && draft?.commerce?.status === 'paid';
      const preview = draft?.visual?.thumbnailUrl || null;
      return <article key={draft.id}>
        <div className="visual">{preview ? <img src={preview} alt={draft.label || 'Voxel property preview'}/> : <><div className="ground"/><div className={String(draft.geometryKind || '').includes('building') ? 'house' : 'land'}>{String(draft.geometryKind || '').includes('building') ? <><i/><i/></> : null}</div></>}<span>{collected ? 'COLLECTED' : draft.world?.public ? 'WORLD' : draft.blockchain?.minted ? 'MINTED' : '3D'}</span></div>
        <div className="body"><small>{collected ? 'OWNED DIGITAL VOXEL' : draft.blockchain?.minted ? 'MINTED PROPERTY MODEL' : 'SAVED 3D PROPERTY'}</small><h2>{draft.label || 'Saved property'}</h2>{collected ? <div className="paid"><b>{draft.commerce?.priceLabel || 'VoxelPop Property'}</b><strong>{dollars(draft.commerce?.priceCents)}</strong></div> : null}
          <div className="actions"><Link href={`/vault/property-drafts/${encodeURIComponent(draft.id)}`}>OPEN 3D</Link><button className={draft.world?.public ? 'active' : ''} onClick={() => toggleWorld(draft)} disabled={busy === draft.id}>{draft.world?.public ? 'PUBLIC WORLD' : 'SHARE TO WORLD'}</button><Link href="/vault/properties/claim">{collected ? 'MINT TO WALLET · OPTIONAL' : 'VERIFY + MINT'}</Link></div>
          <div className="more"><button onClick={() => exportPropertyDraft(draft)}>EXPORT</button><button onClick={() => remove(draft.id)}>REMOVE</button></div>
        </div>
      </article>;
    })}</section> : <section className="empty"><div className="cube"><i/><i/><i/></div><b>No voxel properties yet.</b><span>Add one photo and VoxelPop will guide it through 3D, World preview and collection.</span><Link href="/property">+ CREATE FIRST PROPERTY</Link></section>}

    <p className="truth">Vault is your digital inventory. A collected voxel, payment, World marker or NFT does not itself transfer deed/title, rent, fractional investment, occupancy or other rights in the physical property. Optional minting stays downstream of property verification.</p>
    <style jsx>{`
      :global(body){margin:0;background:#fffaf0;color:#171221;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:14px clamp(12px,3vw,30px) calc(90px + env(safe-area-inset-bottom));background:radial-gradient(circle at 4% 22%,#efffb6 0,transparent 25%),radial-gradient(circle at 95% 8%,#eee5ff 0,transparent 26%),#fffaf0}header{max-width:920px;height:52px;margin:auto;display:flex;align-items:center;justify-content:space-between}header>a{width:40px;height:40px;border-radius:13px;background:#7138f5;color:#fff;text-decoration:none;display:grid;place-items:center;font-weight:1000;box-shadow:0 6px 0 #4d1bc5}nav{display:flex;gap:7px}nav a{padding:10px 13px;color:#51495a;text-decoration:none;font-size:11px;font-weight:900;border:1px solid #e1dbe7;border-radius:999px;background:#ffffffc9}.hero{max-width:920px;margin:48px auto 24px;text-align:center}.hero small{color:#7041ed;font-size:12px;font-weight:950;letter-spacing:.14em}.hero h1{font-size:clamp(52px,9vw,82px);line-height:.9;letter-spacing:-.06em;margin:14px 0 8px}.hero p{color:#7a7280;font-size:14px;margin:0}.hero>button{margin-top:14px;border:1px solid #ddd6e5;border-radius:999px;background:#fff;color:#5d5565;padding:11px 15px;font-size:10px;font-weight:950}.hub{max-width:540px;margin:20px auto 0;display:grid;grid-template-columns:1fr 1fr;gap:10px}.hub a{min-height:54px;border-radius:18px;display:grid;place-items:center;text-decoration:none;font-size:12px;font-weight:1000}.hub .create{background:#7138f5;color:#fff;box-shadow:0 7px 0 #4d1bc5}.hub .world{background:#c9ff54;color:#263d00;box-shadow:0 7px 0 #aee43c}.grid{max-width:920px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px}.grid article{overflow:hidden;border:1px solid #e4dfea;border-radius:26px;background:#ffffffdb;box-shadow:0 16px 45px #6f51a10e}.visual{height:210px;position:relative;overflow:hidden;background:radial-gradient(circle at 50% 35%,#c9ff5424,transparent 30%),#21162c}.visual>img{width:100%;height:100%;object-fit:cover;display:block}.ground{position:absolute;left:11%;right:11%;bottom:17%;height:32%;border:1px solid #8c79a0;transform:perspective(340px) rotateX(62deg);border-radius:14px}.house{position:absolute;left:30%;right:30%;bottom:30%;height:38%;background:#fff}.house:before{content:'';position:absolute;left:-10%;right:-10%;top:-13%;height:18%;background:#7138f5}.house i{position:absolute;bottom:18%;width:20%;height:34%;background:#c9ff54}.house i:first-child{left:18%}.house i:last-child{right:18%}.land{position:absolute;left:24%;right:24%;bottom:25%;height:28%;border:2px solid #c9ff54;transform:perspective(320px) rotateX(62deg);border-radius:12px;background:#c9ff5412}.visual span{position:absolute;top:13px;left:13px;padding:7px 10px;border-radius:999px;background:#c9ff54;color:#263d00;font-size:8px;font-weight:950;letter-spacing:.08em}.body{padding:18px}.body small{color:#7041ed;font-size:8px;font-weight:950;letter-spacing:.1em}.body h2{font-size:23px;letter-spacing:-.04em;margin:6px 0 12px}.paid{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 13px;padding:10px 11px;border-radius:13px;background:#f3ffe1;color:#50672d}.paid b{font-size:9px}.paid strong{font-size:15px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.actions a,.actions button{min-height:44px;border:1px solid #ddd6e5;border-radius:14px;background:#fff;color:#5e5666;text-decoration:none;display:grid;place-items:center;font:inherit;font-size:8px;font-weight:950;cursor:pointer;text-align:center;padding:5px}.actions a:first-child{background:#7138f5;color:#fff;border:0}.actions a:last-child{grid-column:1/-1;background:#171221;color:#fff;border:0}.actions .active{background:#c9ff54;color:#171221;border:0}.more{margin-top:9px;display:flex;gap:12px}.more button{border:0;background:none;color:#a098a3;font-size:8px;font-weight:900;padding:4px 0}.empty{max-width:700px;margin:30px auto;padding:42px 24px;border:1px solid #e4dfea;border-radius:30px;background:#ffffffd7;display:grid;justify-items:center;gap:10px;text-align:center}.empty b{font-size:24px}.empty span{color:#7a7280;font-size:14px}.empty a{margin-top:8px;background:#7138f5;color:#fff;text-decoration:none;border-radius:18px;padding:15px 18px;font-size:12px;font-weight:950;box-shadow:0 7px 0 #4d1bc5}.cube{position:relative;width:66px;height:66px;transform:rotate(30deg) skewY(-8deg);background:#c9ff54;border-radius:10px;box-shadow:0 8px 0 #aee43c}.cube i{position:absolute;background:#7138f5}.cube i:nth-child(1){width:15px;height:15px;left:9px;top:11px}.cube i:nth-child(2){width:15px;height:15px;right:9px;top:11px}.cube i:nth-child(3){width:15px;height:15px;left:25px;bottom:9px}.truth{max-width:920px;margin:16px auto;color:#99909d;font-size:9px;line-height:1.5}@media(max-width:620px){.page{padding:10px 10px calc(82px + env(safe-area-inset-bottom))}.hero{margin-top:34px}.hero h1{font-size:55px}.hub{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.visual{height:210px}.actions a,.actions button{min-height:47px}}
    `}</style>
  </main>;
}
