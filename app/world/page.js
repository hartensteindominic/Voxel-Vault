'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import GeoReferenceModel from '../geo/GeoReferenceModel';
import MeshyModelViewer from '../vault/earth/MeshyModelViewer';
import PlanetStreamGlobe from '../vault/earth/PlanetStreamGlobe';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';

function referenceFor(item) {
  if (!item?.geometry || !String(item?.geometryKind || '').includes('building')) return null;
  return {
    found: true,
    latitude: item.latitude,
    longitude: item.longitude,
    geometry: item.geometry,
    tags: { name: item.label || '3D property reference' },
    height: null,
    matchStrategy: item.mine ? 'private_my_world_property' : 'public_world_shared_property',
    source: { authority: item.mine ? 'Your saved Voxel Vault model' : 'Voxel Vault member-shared 3D model', license: '', sourceUrl: '' },
    neighborhoodBuildings: [],
  };
}

export default function WorldPage() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('Opening My World…');
  const [signedIn, setSignedIn] = useState(false);
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);
  const reference = useMemo(() => referenceFor(selected), [selected]);

  useEffect(() => {
    let active = true;
    let subscription = null;

    async function load(nextSession) {
      if (!active) return;
      setSignedIn(Boolean(nextSession?.user));
      try {
        const publicPromise = fetch('/api/world-properties', { cache: 'no-store' }).then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data?.ok) throw new Error(data?.error || 'Public World is unavailable.');
          return Array.isArray(data.items) ? data.items : [];
        });
        const minePromise = nextSession?.access_token
          ? fetch('/api/world-properties/mine', { cache: 'no-store', headers: { Authorization: `Bearer ${nextSession.access_token}` } }).then(async (response) => {
              const data = await response.json().catch(() => ({}));
              if (!response.ok || !data?.ok) return [];
              return Array.isArray(data.items) ? data.items : [];
            })
          : Promise.resolve([]);
        const [shared, mine] = await Promise.all([publicPromise, minePromise]);
        if (!active) return;
        const merged = new Map(shared.map((item) => [item.id, item]));
        mine.forEach((item) => merged.set(item.id, item));
        const next = Array.from(merged.values());
        setItems(next);
        setSelectedId((current) => next.some((item) => item.id === current) ? current : (mine[0]?.id || next[0]?.id || ''));
        setMessage(nextSession?.user
          ? `${mine.length} in My World · ${shared.length} shared publicly.`
          : shared.length ? `${shared.length} property voxel${shared.length === 1 ? '' : 's'} shared publicly. Sign in to see your private Vault items too.` : 'No public property voxels yet. Sign in and create the first one.');
      } catch (error) {
        if (active) setMessage(String(error?.message || error || 'World is unavailable.'));
      }
    }

    getSupabaseBrowserAsync().then(async (client) => {
      const { data } = await client.auth.getSession();
      await load(data.session || null);
      const auth = client.auth.onAuthStateChange((_event, next) => load(next));
      subscription = auth.data.subscription;
    }).catch(() => load(null));
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  return <main className="page">
    <header><Link href="/">V</Link><div><Link href="/property">Create</Link><Link href="/vault/property-drafts">My Vault</Link></div></header>
    <section className="head"><small>✦ {signedIn ? 'MY WORLD + PUBLIC WORLD' : 'PUBLIC VOXEL WORLD'} ✦</small><h1>{signedIn ? <>Your voxels.<br/><em>One little world.</em></> : <>Everyone’s voxels.<br/><em>One little world.</em></>}</h1><p>{message}</p></section>

    <section className="globe">
      <PlanetStreamGlobe listings={items} selectedId={selectedId} onSelect={setSelectedId} atlasBuildings={[]} simpleMode />
      {!items.length ? <div className="empty"><b>Your world is waiting.</b><Link href="/property">+ CREATE A PROPERTY VOXEL</Link></div> : null}
      {signedIn ? <div className="legend"><span><i className="mine"/>My World</span><span><i/>Public</span></div> : null}
    </section>

    {selected ? <section className="selected">
      <div className="model">{selected.modelUrl ? <MeshyModelViewer modelUrl={selected.modelUrl}/> : reference ? <GeoReferenceModel reference={reference} authoritativeTwin={null} viewMode="orbit" resetKey={0}/> : <div className="land"><i/><span>LOCATION / PARCEL REFERENCE</span></div>}</div>
      <div className="info"><small>{selected.mine ? 'MY WORLD' : `SHARED BY ${selected.handle ? `@${selected.handle}` : selected.owner}`}</small><h2>{selected.label || '3D property reference'}</h2><div className="badges"><span>{selected.purchasedDigitalCollectible ? 'COLLECTED' : selected.minted ? 'MINTED' : '3D'}</span><span>{selected.mine && selected.private ? 'PRIVATE' : 'WORLD'}</span><span>{selected.rightsVerified ? 'RIGHTS VERIFIED' : 'MODEL ONLY'}</span></div><p>{selected.mine ? 'This saved digital model is visible to you here even when it is not shared publicly.' : 'This member chose to share this digital property model on Public World.'}</p><Link href={selected.mine ? '/vault/property-drafts' : '/property'}>{selected.mine ? 'OPEN MY VAULT' : '+ CREATE A VOXEL'}</Link></div>
    </section> : null}

    <p className="truth">My World can show your private account-synced digital models at their saved locations. Public World only shows models people explicitly choose to share, with privacy-rounded coordinates. A map marker, payment, voxel, or NFT does not prove deed/title, fractional ownership, rent, occupancy, or other legal real-property rights.</p>

    <style jsx>{`
      :global(body){margin:0;background:#fffaf0;color:#171221;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:14px clamp(12px,3vw,30px) calc(90px + env(safe-area-inset-bottom));background:radial-gradient(circle at 4% 22%,#efffb6 0,transparent 25%),radial-gradient(circle at 95% 8%,#eee5ff 0,transparent 26%),#fffaf0}header{max-width:980px;height:52px;margin:auto;display:flex;align-items:center;justify-content:space-between}header>a{width:40px;height:40px;display:grid;place-items:center;border-radius:13px;background:#7138f5;color:#fff;text-decoration:none;font-weight:1000;box-shadow:0 6px 0 #4d1bc5}header div{display:flex;gap:7px}header div a{padding:10px 13px;color:#51495a;text-decoration:none;font-size:11px;font-weight:900;border:1px solid #e1dbe7;border-radius:999px;background:#ffffffc9}.head{max-width:980px;margin:48px auto 22px;text-align:center}.head small{color:#7041ed;font-size:12px;font-weight:950;letter-spacing:.14em}.head h1{margin:14px 0 10px;font-size:clamp(48px,8vw,78px);line-height:.9;letter-spacing:-.06em}.head h1 em{font-style:normal;color:#7138f5}.head p{margin:0;color:#7a7280;font-size:14px}.globe{position:relative;max-width:980px;height:min(62vh,620px);min-height:430px;margin:0 auto;border:1px solid #493b55;border-radius:30px;overflow:hidden;background:#21162c;box-shadow:0 24px 60px #5b3d7620}.empty{position:absolute;z-index:5;left:50%;bottom:24px;transform:translateX(-50%);display:grid;gap:10px;text-align:center;padding:16px 19px;border:1px solid #ded7e7;border-radius:18px;background:#ffffffed;color:#171221;backdrop-filter:blur(14px);box-shadow:0 12px 35px #0002}.empty b{font-size:13px}.empty a{color:#7138f5;text-decoration:none;font-size:10px;font-weight:950}.legend{position:absolute;z-index:6;left:16px;bottom:14px;display:flex;gap:8px;padding:8px 10px;border-radius:999px;background:#ffffffdf;color:#544b59;font-size:8px;font-weight:950}.legend span{display:flex;align-items:center;gap:5px}.legend i{width:8px;height:8px;border-radius:50%;background:#fff}.legend i.mine{background:#c9ff54}.selected{max-width:980px;margin:14px auto 0;display:grid;grid-template-columns:1.2fr .8fr;gap:14px}.model{position:relative;min-height:360px;border:1px solid #493b55;border-radius:26px;overflow:hidden;background:#21162c}.model :global(.viewerShell){position:absolute!important;inset:0!important;min-height:100%!important;border-radius:0!important}.info{padding:22px;border:1px solid #e4dfea;border-radius:26px;background:#ffffffdb;box-shadow:0 16px 45px #6f51a10e}.info small{color:#7041ed;font-size:9px;font-weight:950;letter-spacing:.1em}.info h2{font-size:34px;letter-spacing:-.05em;margin:8px 0 13px}.badges{display:flex;gap:7px;flex-wrap:wrap}.badges span{padding:7px 10px;border-radius:999px;background:#eee8ff;color:#6337ce;font-size:8px;font-weight:950}.badges span:first-child{background:#c9ff54;color:#171221}.info p{color:#7a7280;font-size:12px;line-height:1.5;margin:18px 0}.info>a{display:grid;place-items:center;min-height:50px;border-radius:17px;background:#7138f5;color:#fff;text-decoration:none;font-size:11px;font-weight:1000;box-shadow:0 7px 0 #4d1bc5}.land{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:18px;background:radial-gradient(circle at 50% 44%,#c9ff5418,transparent 32%)}.land i{width:190px;height:130px;border:2px solid #c9ff54;background:#c9ff5410;transform:perspective(420px) rotateX(62deg) rotateZ(-9deg);border-radius:18px}.land span{font-size:10px;font-weight:950;letter-spacing:.1em;color:#c8bdd1}.truth{max-width:980px;margin:14px auto 0;color:#99909d;font-size:9px;line-height:1.5}@media(max-width:760px){.head{margin-top:34px}.head h1{font-size:52px}.globe{height:56vh;min-height:420px;border-radius:25px}.selected{grid-template-columns:1fr}.model{min-height:40vh}.info{padding:18px}.info h2{font-size:30px}}@media(max-width:520px){.page{padding:10px 10px calc(82px + env(safe-area-inset-bottom))}.head h1{font-size:47px}.globe{height:54vh;min-height:390px}.model{min-height:340px}}
    `}</style>
  </main>;
}
