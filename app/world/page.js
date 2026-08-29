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
    <header><Link href="/">V</Link><div><Link href="/property">ADD PROPERTY</Link><Link href="/vault/property-drafts">VAULT</Link></div></header>
    <section className="head"><small>PUBLIC 3D WORLD</small><h1>Everyone's properties.<br/><em>One globe.</em></h1><p>{message}</p></section>

    <section className="globe">
      <PlanetStreamGlobe listings={items} selectedId={selectedId} onSelect={setSelectedId} atlasBuildings={[]} simpleMode />
      {!items.length ? <div className="empty"><b>NO SHARED PROPERTIES YET</b><Link href="/property">ADD THE FIRST PROPERTY →</Link></div> : null}
    </section>

    {selected ? <section className="selected">
      <div className="model">{reference ? <GeoReferenceModel reference={reference} authoritativeTwin={null} viewMode="orbit" resetKey={0}/> : <div className="land"><i/><span>LAND / PARCEL 3D</span></div>}</div>
      <div className="info"><small>SHARED BY {selected.handle ? `@${selected.handle}` : selected.owner}</small><h2>{selected.label || '3D Property'}</h2><div className="badges"><span>{selected.minted ? 'MINTED' : '3D'}</span><span>{selected.rightsVerified ? 'RIGHTS VERIFIED' : 'MODEL ONLY'}</span></div><p>Tap another voxel house on the globe to open its 3D property. Public World shows only properties their users chose to share.</p><Link href="/property">+ ADD YOUR PROPERTY</Link></div>
    </section> : null}

    <p className="truth">World is a public spatial gallery. A visible voxel property or NFT does not by itself prove deed/title, a fractional investment, rent rights, or legal ownership.</p>

    <style jsx>{`
      :global(body){margin:0;background:#06100e;color:#f5f8f6;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:12px clamp(10px,3vw,32px) 80px;background:radial-gradient(circle at 50% 2%,rgba(83,173,220,.12),transparent 28%),#06100e}header{height:48px;display:flex;align-items:center;justify-content:space-between}header>a{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:#f5f8f6;color:#06100e;text-decoration:none;font-weight:1000}header div{display:flex;gap:6px}header div a{padding:10px;color:#9aaba4;text-decoration:none;font-size:7px;font-weight:950;letter-spacing:.1em}.head{max-width:1180px;margin:35px auto 14px}.head small{color:#79efbc;font-size:7px;font-weight:950;letter-spacing:.14em}.head h1{margin:8px 0;font-size:clamp(42px,7vw,82px);line-height:.88;letter-spacing:-.065em}.head h1 em{font-style:normal;color:#78958a}.head p{margin:0;color:#73857e;font-size:9px}.globe{position:relative;max-width:1180px;height:min(66vh,680px);min-height:460px;margin:0 auto;border:1px solid rgba(255,255,255,.08);border-radius:28px;overflow:hidden;background:#081317}.empty{position:absolute;z-index:5;left:50%;bottom:26px;transform:translateX(-50%);display:grid;gap:8px;text-align:center;padding:14px 18px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(4,10,12,.78);backdrop-filter:blur(14px)}.empty b{font-size:8px;letter-spacing:.11em}.empty a{color:#79efbc;text-decoration:none;font-size:7px;font-weight:950}.selected{max-width:1180px;margin:10px auto 0;display:grid;grid-template-columns:1.25fr .75fr;gap:10px}.model{position:relative;min-height:380px;border:1px solid rgba(255,255,255,.08);border-radius:24px;overflow:hidden;background:#0a0e0d}.info{padding:20px;border:1px solid rgba(255,255,255,.08);border-radius:24px;background:rgba(255,255,255,.025)}.info small{color:#79efbc;font-size:7px;font-weight:950;letter-spacing:.12em}.info h2{font-size:38px;letter-spacing:-.05em;margin:8px 0 12px}.badges{display:flex;gap:6px;flex-wrap:wrap}.badges span{padding:7px 9px;border:1px solid rgba(121,239,188,.18);border-radius:999px;color:#a8ddc9;font-size:6px;font-weight:950;letter-spacing:.08em}.info p{color:#76877f;font-size:9px;line-height:1.6;margin:18px 0}.info>a{display:grid;place-items:center;min-height:48px;border-radius:14px;background:#79efbc;color:#06100e;text-decoration:none;font-size:8px;font-weight:1000;letter-spacing:.09em}.land{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:18px;background:radial-gradient(circle at 50% 44%,rgba(121,239,188,.09),transparent 32%)}.land i{width:190px;height:130px;border:2px solid rgba(121,239,188,.38);background:rgba(121,239,188,.05);transform:perspective(420px) rotateX(62deg) rotateZ(-9deg);border-radius:18px}.land span{font-size:8px;font-weight:950;letter-spacing:.12em;color:#7f948c}.truth{max-width:1180px;margin:12px auto 0;color:#50615b;font-size:7px;line-height:1.5}@media(max-width:760px){.head{margin-top:24px}.head h1{font-size:50px}.globe{height:58vh;min-height:430px;border-radius:22px}.selected{grid-template-columns:1fr}.model{min-height:42vh}.info{padding:15px}.info h2{font-size:30px}}@media(max-width:520px){.page{padding:10px 10px calc(76px + env(safe-area-inset-bottom))}.head h1{font-size:44px}.globe{height:56vh;min-height:400px}.model{min-height:360px}}
    `}</style>
  </main>;
}
