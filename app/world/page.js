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
  const [message, setMessage] = useState('Opening World…');
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
          ? mine.length ? `${mine.length} saved in My World · ${shared.length} shared publicly.` : 'Your map is ready for your first saved voxel.'
          : shared.length ? `${shared.length} property voxel${shared.length === 1 ? '' : 's'} shared publicly.` : 'Public World is new. Create a voxel to start filling the map.');
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
    <section className="head">
      <small>{signedIn ? 'MY WORLD + PUBLIC WORLD' : 'VOXEL WORLD'}</small>
      <h1>{signedIn ? <>Your world.<br/><em>Your voxels.</em></> : <>See voxels<br/><em>in their places.</em></>}</h1>
      <p role="status">{message}</p>
    </section>

    <section className="globe" aria-label="Voxel World map">
      <PlanetStreamGlobe listings={items} selectedId={selectedId} onSelect={setSelectedId} atlasBuildings={[]} simpleMode />
      {!items.length ? <div className="empty">
        <div className="emptyTop"><span className="emptyIcon">◎</span><div><small>WHAT WORLD BECOMES</small><b>{signedIn ? 'Your finished voxels, placed in context.' : 'A map of finished VoxelPop creations.'}</b></div></div>
        <p>World starts after creation—not before it. Build a voxel, optionally add its address, then keep it private in My World or share it later.</p>
        <div className="emptySteps" aria-label="World onboarding steps"><span><i>1</i><b>CREATE</b><small>Finish the voxel</small></span><span><i>2</i><b>PLACE</b><small>Add an address</small></span><span><i>3</i><b>KEEP / SHARE</b><small>You stay in control</small></span></div>
        <div className="emptyActions"><Link className="primary" href="/property">Create my voxel →</Link>{signedIn ? <Link href="/vault">Open my Vault</Link> : <Link href="/demo">Try 3D demo</Link>}</div>
      </div> : null}
      {signedIn && items.length ? <div className="legend"><span><i className="mine"/>Mine</span><span><i/>Public</span></div> : null}
    </section>

    {selected ? <section className="selected">
      <div className="model">{selected.modelUrl ? <MeshyModelViewer modelUrl={selected.modelUrl}/> : reference ? <GeoReferenceModel reference={reference} authoritativeTwin={null} viewMode="orbit" resetKey={0}/> : <div className="land"><i/><span>LOCATION / PARCEL REFERENCE</span></div>}</div>
      <div className="info">
        <small>{selected.mine ? 'MY WORLD' : `SHARED BY ${selected.handle ? `@${selected.handle}` : selected.owner}`}</small>
        <h2>{selected.label || '3D property reference'}</h2>
        <div className="badges"><span>{selected.purchasedDigitalCollectible ? 'COLLECTED' : selected.minted ? 'MINTED' : '3D READY'}</span><span>{selected.mine && selected.private ? 'PRIVATE' : 'WORLD'}</span><span>{selected.rightsVerified ? 'RIGHTS VERIFIED' : 'DIGITAL MODEL'}</span></div>
        <p>{selected.mine ? 'This is your saved digital voxel at its map location. Keep it private or share it separately when you choose.' : 'This member chose to share this digital property model on Public World.'}</p>
        <Link href={selected.mine ? '/vault' : '/property'}>{selected.mine ? 'OPEN IN VAULT →' : 'CREATE MY OWN →'}</Link>
      </div>
    </section> : null}

    <p className="truth">World is map context for digital models. Public World uses privacy-rounded coordinates. A map marker, payment, voxel, or NFT does not prove deed/title, fractional ownership, rent, occupancy, or other legal real-property rights.</p>

    <style jsx>{`
      :global(body){margin:0;background:#fffaf0;color:#201522;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:8px clamp(10px,3vw,28px) 18px;background:radial-gradient(circle at 6% 20%,#efffb65c 0,transparent 25%),radial-gradient(circle at 94% 7%,#eee5ff 0,transparent 27%),#fffaf0}.head{max-width:900px;margin:42px auto 20px;text-align:center}.head small{color:#7041ed;font-size:10px;font-weight:1000;letter-spacing:.14em}.head h1{margin:9px 0 10px;font-size:clamp(43px,7vw,68px);line-height:.91;letter-spacing:-.06em}.head h1 em{font-style:normal;color:#7138f5}.head p{margin:0;color:#655e68;font-size:13px}.globe{position:relative;max-width:980px;height:min(60vh,590px);min-height:410px;margin:0 auto;border:1px solid #493b55;border-radius:27px;overflow:hidden;background:#21162c;box-shadow:0 20px 52px #5b3d761b}.empty{position:absolute;z-index:5;left:50%;bottom:16px;transform:translateX(-50%);width:min(610px,calc(100% - 28px));display:grid;gap:12px;text-align:left;padding:17px;border:1px solid #ded7e7;border-radius:21px;background:#fffdf8f2;color:#171221;backdrop-filter:blur(18px);box-shadow:0 12px 35px #0002;box-sizing:border-box}.emptyTop{display:flex;align-items:center;gap:11px}.emptyIcon{width:43px;height:43px;flex:0 0 auto;display:grid;place-items:center;border-radius:13px;background:#eee7ff;color:#6331db;font-weight:1000}.emptyTop>div{display:grid;gap:3px}.emptyTop small{font-size:9px;color:#6d42cf;font-weight:1000;letter-spacing:.1em}.emptyTop b{font-size:15px}.empty p{margin:0;color:#675f6a;font-size:11px;line-height:1.5}.emptySteps{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.emptySteps span{min-width:0;padding:10px;border:1px solid #e5dde8;border-radius:14px;background:#fff;display:grid;gap:2px}.emptySteps i{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:#f0e9ff;color:#6a39d7;font-size:10px;font-style:normal;font-weight:1000}.emptySteps b{font-size:9px;letter-spacing:.05em}.emptySteps small{color:#77707a;font-size:9px}.emptyActions{display:grid;grid-template-columns:1.2fr .8fr;gap:7px}.emptyActions a{min-height:45px;border:1px solid #e0d8e4;border-radius:13px;background:#fff;color:#655b69;text-decoration:none;display:grid;place-items:center;font-size:10px;font-weight:1000}.emptyActions .primary{background:#7138f5;color:#fff;border-color:#7138f5;box-shadow:0 4px 0 #4d1bc5}.legend{position:absolute;z-index:6;left:13px;bottom:12px;display:flex;gap:8px;padding:8px 10px;border-radius:999px;background:#ffffffdf;color:#544b59;font-size:9px;font-weight:950}.legend span{display:flex;align-items:center;gap:5px}.legend i{width:8px;height:8px;border-radius:50%;background:#fff}.legend i.mine{background:#7138f5}.selected{max-width:980px;margin:12px auto 0;display:grid;grid-template-columns:1.25fr .75fr;gap:12px}.model{position:relative;min-height:340px;border:1px solid #493b55;border-radius:23px;overflow:hidden;background:#21162c}.model :global(.viewerShell){position:absolute!important;inset:0!important;min-height:100%!important;border-radius:0!important}.info{padding:19px;border:1px solid #e4dfea;border-radius:23px;background:#ffffffd9;box-shadow:0 14px 38px #6f51a10d}.info small{color:#7041ed;font-size:10px;font-weight:950;letter-spacing:.1em}.info h2{font-size:30px;letter-spacing:-.05em;margin:7px 0 11px}.badges{display:flex;gap:6px;flex-wrap:wrap}.badges span{padding:6px 9px;border-radius:999px;background:#eee8ff;color:#6337ce;font-size:9px;font-weight:950}.badges span:first-child{background:#7138f5;color:#fff}.info p{color:#68616b;font-size:11.5px;line-height:1.52;margin:15px 0}.info>a{display:grid;place-items:center;min-height:46px;border-radius:14px;background:#7138f5;color:#fff;text-decoration:none;font-size:10px;font-weight:1000;box-shadow:0 5px 0 #4d1bc5}.land{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:15px;background:radial-gradient(circle at 50% 44%,#c9ff5418,transparent 32%)}.land i{width:180px;height:120px;border:2px solid #c9ff54;background:#c9ff5410;transform:perspective(420px) rotateX(62deg) rotateZ(-9deg);border-radius:16px}.land span{font-size:10px;font-weight:950;letter-spacing:.1em;color:#c8bdd1}.truth{max-width:980px;margin:12px auto 0;color:#746c77;font-size:10px;line-height:1.55}@media(max-width:760px){.head{margin-top:30px}.head h1{font-size:47px}.globe{height:56vh;min-height:430px;border-radius:23px}.selected{grid-template-columns:1fr}.model{min-height:36vh}.info{padding:16px}.info h2{font-size:28px}.empty{width:min(560px,calc(100% - 20px));bottom:10px}}@media(max-width:520px){.page{padding:6px 8px 14px}.head{margin-top:25px}.head h1{font-size:43px}.head p{font-size:12px}.globe{height:58vh;min-height:500px}.model{min-height:320px}.empty{padding:13px;gap:9px}.emptySteps{grid-template-columns:1fr}.emptySteps span{grid-template-columns:auto 1fr;align-items:center;column-gap:7px}.emptySteps small{grid-column:2}.emptyActions{grid-template-columns:1fr}.truth{font-size:9.5px}}
    `}</style>
  </main>;
}
