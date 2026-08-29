'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import PlanetStreamGlobe from '../../vault/earth/PlanetStreamGlobe';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { loadAccountPropertyDrafts } from '../../../lib/property-drafts-account';

export default function MyWorldPage() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [note, setNote] = useState('Loading your private World…');
  const clientRef = useRef(null);

  const listings = useMemo(() => drafts.map((draft) => ({
    id: draft.id,
    kind: 'community-property',
    label: draft.label || 'My VoxelPop property',
    latitude: Number(draft?.location?.latitude),
    longitude: Number(draft?.location?.longitude),
    geometry: draft.geometry || null,
    geometryKind: draft.geometryKind || 'private-property',
    fidelity: draft.fidelity || 'saved-digital-property',
    minted: draft?.blockchain?.minted === true,
    rightsVerified: false,
  })).filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)), [drafts]);

  const selected = drafts.find((draft) => draft.id === selectedId) || drafts[0] || null;

  useEffect(() => {
    let active = true;
    let subscription = null;
    async function load(client, nextSession) {
      if (!active) return;
      setSession(nextSession || null);
      setAuthReady(true);
      if (!nextSession?.user) {
        setDrafts([]);
        setNote('Sign in to see your private World.');
        return;
      }
      try {
        const cloud = await loadAccountPropertyDrafts(client, nextSession.user);
        if (!active) return;
        setDrafts(cloud);
        setSelectedId((current) => current || cloud[0]?.id || '');
        setNote(cloud.length ? `${cloud.length} saved voxel ${cloud.length === 1 ? 'property' : 'properties'} in your private World.` : 'Your private World is empty. Create your first property.');
      } catch (error) {
        if (active) setNote(String(error?.message || error || 'Your private World could not be loaded.'));
      }
    }
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      await load(client, data.session || null);
      const auth = client.auth.onAuthStateChange((_event, next) => load(client, next));
      subscription = auth.data.subscription;
    }).catch(() => {
      if (active) {
        setAuthReady(true);
        setNote('Sign-in setup is unavailable on this deployment.');
      }
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  async function signIn() {
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
      if (error) throw error;
    } catch (error) { setNote(String(error?.message || error || 'Could not sign in.')); }
  }

  return <main className="page">
    <header><Link href="/">V</Link><nav><Link href="/property">Create</Link><Link href="/vault/property-drafts">Vault</Link><Link href="/world">Public World</Link></nav></header>
    <section className="hero"><small>✦ VOXELPOP · MY WORLD ✦</small><h1>My World.</h1><p>{note}</p></section>

    {!authReady ? <section className="panel"><b>Checking your account…</b></section> : !session?.user ? <section className="panel"><div className="mark">V</div><h2>Sign in first.</h2><p>Your private World only loads the property drafts saved to your account.</p><button onClick={signIn}>CONTINUE WITH GOOGLE</button></section> : <>
      <section className="globe"><PlanetStreamGlobe listings={listings} selectedId={selected?.id || ''} onSelect={(id) => setSelectedId(id)} simpleMode/><span>PRIVATE · ONLY YOU</span></section>
      {selected ? <section className="selected"><div><small>{selected?.commerce?.status === 'paid' ? 'COLLECTED DIGITAL VOXEL' : 'SAVED PROPERTY'}</small><h2>{selected.label || 'VoxelPop property'}</h2><p>{selected?.commerce?.status === 'paid' ? 'Purchased and saved in your Voxel Vault.' : 'Saved in your private account collection.'}</p></div><div className="actions"><Link href={`/vault/property-drafts/${encodeURIComponent(selected.id)}`}>Open 3D</Link><Link href="/vault/properties/claim">Mint later</Link></div></section> : <section className="panel"><div className="mark">+</div><h2>Start your World.</h2><p>Upload one photo. VoxelPop will build the 3D, turn it into a voxel, preview it here, then let you buy and save it.</p><Link className="create" href="/property">CREATE PROPERTY</Link></section>}
      <div className="bottom"><Link href="/property">+ Create Another</Link><Link href="/vault/property-drafts">Open Vault</Link></div>
    </>}

    <p className="truth">My World is a private digital map of your saved VoxelPop property models. A map marker, purchase or NFT does not itself transfer deed/title, rent, occupancy, investment or other rights in physical property. Public sharing is a separate opt-in.</p>
    <style jsx>{`
      :global(body){margin:0;background:#fffaf0;color:#21172b;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:12px 12px calc(70px + env(safe-area-inset-bottom));background:radial-gradient(circle at 8% 8%,#fff1cf 0,transparent 29%),radial-gradient(circle at 92% 12%,#eee5ff 0,transparent 28%),radial-gradient(circle at 50% 86%,#efffc8 0,transparent 24%),#fffaf0}header{max-width:900px;height:54px;margin:auto;display:flex;align-items:center;justify-content:space-between}header>a{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:#7138f5;color:#fff;text-decoration:none;font-weight:1000;box-shadow:0 6px 0 #4d1bc5}nav{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}nav a{padding:9px 11px;border-radius:999px;background:#ffffffd8;border:1px solid #e1d8ea;color:#62576d;text-decoration:none;font-size:9px;font-weight:950}.hero{max-width:900px;margin:38px auto 20px;text-align:center}.hero small{color:#7138f5;font-size:10px;font-weight:1000;letter-spacing:.15em}.hero h1{margin:12px 0 7px;font-size:clamp(54px,11vw,82px);letter-spacing:-.07em;line-height:.88}.hero p{margin:0;color:#7c7182;font-size:13px}.globe{position:relative;max-width:900px;height:min(64vh,570px);margin:auto;overflow:hidden;border-radius:38px;background:#0b1820;border:1px solid #d9d0e0;box-shadow:0 25px 65px rgba(50,28,72,.15)}.globe>div{height:100%!important}.globe>span{position:absolute;left:16px;top:16px;z-index:6;padding:8px 11px;border-radius:999px;background:#c9ff54;color:#304900;font-size:8px;font-weight:1000;letter-spacing:.1em}.selected,.panel{max-width:900px;margin:14px auto 0;padding:19px;border-radius:28px;background:#ffffffdf;border:1px solid #e6dded;box-shadow:0 16px 42px rgba(75,48,91,.08)}.selected{display:flex;justify-content:space-between;align-items:center;gap:14px;text-align:left}.selected small{color:#7138f5;font-size:8px;font-weight:1000;letter-spacing:.1em}.selected h2{margin:5px 0 5px;font-size:24px;letter-spacing:-.04em}.selected p,.panel p{margin:0;color:#827787;font-size:11px;line-height:1.5}.actions{display:flex;gap:7px}.actions a,.bottom a,.panel button,.panel .create{min-height:44px;padding:0 14px;border:0;border-radius:14px;display:grid;place-items:center;text-decoration:none;font-size:9px;font-weight:1000;cursor:pointer}.actions a:first-child,.panel button,.panel .create{background:#7138f5;color:#fff;box-shadow:0 6px 0 #4d1bc5}.actions a:last-child{background:#171221;color:#fff}.panel{text-align:center;display:grid;justify-items:center;gap:10px;padding:34px 20px}.panel h2{margin:0;font-size:28px}.mark{width:58px;height:58px;border-radius:20px;background:#c9ff54;color:#466500;display:grid;place-items:center;font-size:28px;font-weight:1000;box-shadow:0 7px 0 #aada35}.bottom{max-width:540px;margin:15px auto 0;display:grid;grid-template-columns:1fr 1fr;gap:9px}.bottom a:first-child{background:#7138f5;color:#fff;box-shadow:0 6px 0 #4d1bc5}.bottom a:last-child{background:#c9ff54;color:#314900;box-shadow:0 6px 0 #aada35}.truth{max-width:860px;margin:16px auto 0;text-align:center;color:#a197a6;font-size:8.5px;line-height:1.55}@media(max-width:620px){.page{padding:8px 9px calc(64px + env(safe-area-inset-bottom))}.hero{margin-top:28px}.hero h1{font-size:57px}.globe{height:480px;border-radius:30px}.selected{display:grid;border-radius:24px}.actions{display:grid;grid-template-columns:1fr 1fr}.bottom{grid-template-columns:1fr}.bottom a{min-height:50px}nav a{font-size:8px;padding:8px 9px}}
    `}</style>
  </main>;
}
