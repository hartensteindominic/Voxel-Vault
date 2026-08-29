'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import GeoReferenceModel from '../geo/GeoReferenceModel';
import PlanetStreamGlobe from '../vault/earth/PlanetStreamGlobe';

function referenceFor(item) {
  if (!item?.geometry || !String(item?.geometryKind || '').includes('building')) return null;
  return {
    found: true,
    latitude: item.latitude,
    longitude: item.longitude,
    geometry: item.geometry,
    tags: { name: item.label || '3D Property' },
    height: null,
    matchStrategy: 'public_world_shared_property',
    source: { authority: 'Voxel Vault member-shared 3D draft', license: '', sourceUrl: '' },
    neighborhoodBuildings: [],
  };
}

export default function WorldPage() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('Loading the public 3D property world…');
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);
  const reference = useMemo(() => referenceFor(selected), [selected]);

  useEffect(() => {
    let active = true;
    fetch('/api/world-properties', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) throw new Error(data?.error || 'World is unavailable.');
        if (!active) return;
        const next = Array.isArray(data.items) ? data.items : [];
        setItems(next);
        setSelectedId(next[0]?.id || '');
        setMessage(next.length ? `${next.length} shared 3D propert${next.length === 1 ? 'y' : 'ies'} on World.` : 'No one has shared a property yet. Add the first one.');
      })
      .catch((error) => { if (active) setMessage(String(error?.message || error)); });
    return () => { active = false; };
  }, []);

  return <main className="page">
    <header><Link href="/">V</Link><div><Link href="/property">Add</Link><Link href="/vault/property-drafts">My Vault</Link></div></header>
    <section className="head"><small>✦ PUBLIC 3D WORLD ✦</small><h1>Everyone's properties.<br/><em>One little world.</em></h1><p>{message}</p></section>

    <section className="globe">
      <PlanetStreamGlobe listings={items} selectedId={selectedId} onSelect={setSelectedId} atlasBuildings={[]} simpleMode />
      {!items.length ? <div className="empty"><b>No shared properties yet.</b><Link href="/property">+ ADD THE FIRST PROPERTY</Link></div> : null}
    </section>

    {selected ? <section className="selected">
      <div className="model">{reference ? <GeoReferenceModel reference={reference} authoritativeTwin={null} viewMode="orbit" resetKey={0}/> : <div className="land"><i/><span>LAND / PARCEL 3D</span></div>}</div>
      <div className="info"><small>SHARED BY {selected.handle ? `@${selected.handle}` : selected.owner}</small><h2>{selected.label || '3D Property'}</h2><div className="badges"><span>{selected.minted ? 'MINTED' : '3D'}</span><span>{selected.rightsVerified ? 'RIGHTS VERIFIED' : 'MODEL ONLY'}</span></div><p>Tap a voxel house on the globe to open it.</p><Link href="/property">+ ADD YOUR PROPERTY</Link></div>
    </section> : null}

    <p className="truth">World is a public spatial gallery. A visible voxel property or NFT does not by itself prove deed/title, a fractional investment, rent rights, or legal ownership.</p>

    <style jsx>{`
      :global(body){margin:0;background:#fffaf0;color:#171221;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:14px clamp(12px,3vw,30px) calc(90px + env(safe-area-inset-bottom));background:radial-gradient(circle at 4% 22%,#efffb6 0,transparent 25%),radial-gradient(circle at 95% 8%,#eee5ff 0,transparent 26%),#fffaf0}header{max-width:980px;height:52px;margin:auto;display:flex;align-items:center;justify-content:space-between}header>a{width:40px;height:40px;display:grid;place-items:center;border-radius:13px;background:#7138f5;color:#fff;text-decoration:none;font-weight:1000;box-shadow:0 6px 0 #4d1bc5}header div{display:flex;gap:7px}header div a{padding:10px 13px;color:#51495a;text-decoration:none;font-size:11px;font-weight:900;border:1px solid #e1dbe7;border-radius:999px;background:#ffffffc9}.head{max-width:980px;margin:48px auto 22px;text-align:center}.head small{color:#7041ed;font-size:12px;font-weight:950;letter-spacing:.14em}.head h1{margin:14px 0 10px;font-size:clamp(48px,8vw,78px);line-height:.9;letter-spacing:-.06em}.head h1 em{font-style:normal;color:#7138f5}.head p{margin:0;color:#7a7280;font-size:14px}.globe{position:relative;max-width:980px;height:min(62vh,620px);min-height:430px;margin:0 auto;border:1px solid #493b55;border-radius:30px;overflow:hidden;background:#21162c;box-shadow:0 24px 60px #5b3d7620}.empty{position:absolute;z-index:5;left:50%;bottom:24px;transform:translateX(-50%);display:grid;gap:10px;text-align:center;padding:16px 19px;border:1px solid #ded7e7;border-radius:18px;background:#ffffffed;color:#171221;backdrop-filter:blur(14px);box-shadow:0 12px 35px #0002}.empty b{font-size:13px}.empty a{color:#7138f5;text-decoration:none;font-size:10px;font-weight:950}.selected{max-width:980px;margin:14px auto 0;display:grid;grid-template-columns:1.2fr .8fr;gap:14px}.model{position:relative;min-height:360px;border:1px solid #493b55;border-radius:26px;overflow:hidden;background:#21162c}.info{padding:22px;border:1px solid #e4dfea;border-radius:26px;background:#ffffffdb;box-shadow:0 16px 45px #6f51a10e}.info small{color:#7041ed;font-size:9px;font-weight:950;letter-spacing:.1em}.info h2{font-size:34px;letter-spacing:-.05em;margin:8px 0 13px}.badges{display:flex;gap:7px;flex-wrap:wrap}.badges span{padding:7px 10px;border-radius:999px;background:#eee8ff;color:#6337ce;font-size:8px;font-weight:950}.badges span:first-child{background:#c9ff54;color:#171221}.info p{color:#7a7280;font-size:12px;line-height:1.5;margin:18px 0}.info>a{display:grid;place-items:center;min-height:50px;border-radius:17px;background:#7138f5;color:#fff;text-decoration:none;font-size:11px;font-weight:1000;box-shadow:0 7px 0 #4d1bc5}.land{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:18px;background:radial-gradient(circle at 50% 44%,#c9ff5418,transparent 32%)}.land i{width:190px;height:130px;border:2px solid #c9ff54;background:#c9ff5410;transform:perspective(420px) rotateX(62deg) rotateZ(-9deg);border-radius:18px}.land span{font-size:10px;font-weight:950;letter-spacing:.1em;color:#c8bdd1}.truth{max-width:980px;margin:14px auto 0;color:#99909d;font-size:9px;line-height:1.5}@media(max-width:760px){.head{margin-top:34px}.head h1{font-size:52px}.globe{height:56vh;min-height:420px;border-radius:25px}.selected{grid-template-columns:1fr}.model{min-height:40vh}.info{padding:18px}.info h2{font-size:30px}}@media(max-width:520px){.page{padding:10px 10px calc(82px + env(safe-area-inset-bottom))}.head h1{font-size:47px}.globe{height:54vh;min-height:390px}.model{min-height:340px}}
    `}</style>
  </main>;
}
