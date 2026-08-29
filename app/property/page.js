'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import GeoReferenceModel from '../geo/GeoReferenceModel';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { buildPropertyDraft, readPropertyDraft, savePropertyDraft, setPropertyDraftWorldVisibility } from '../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../lib/property-drafts-account';

function clean(value) { return String(value || '').trim(); }
function money(listing) {
  const cents = Number(listing?.marketValueCents);
  if (!Number.isFinite(cents)) return 'PRICE AT SOURCE';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: listing?.currency || 'USD', maximumFractionDigits: 0 }).format(cents / 100); }
  catch { return `$${Math.round(cents / 100).toLocaleString()}`; }
}
function distanceMeters(aLat, aLng, bLat, bLng) {
  const values = [aLat, aLng, bLat, bLng].map(Number);
  if (values.some((value) => !Number.isFinite(value))) return Infinity;
  const [lat1, lng1, lat2, lng2] = values.map((value) => value * Math.PI / 180);
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function referenceFor(building) {
  if (!building?.geometry) return null;
  return {
    found: true,
    latitude: building.latitude,
    longitude: building.longitude,
    geometry: building.geometry,
    tags: building.tags || {},
    height: building.height || null,
    matchStrategy: 'simple_property_flow',
    source: building.source || null,
    neighborhoodBuildings: [],
  };
}
function selectedOrLocation(atlas, address) {
  const selected = atlas?.selectedBuilding || atlas?.buildings?.[0] || null;
  if (selected) return selected;
  const latitude = Number(atlas?.latitude);
  const longitude = Number(atlas?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    atlasId: `location:${latitude.toFixed(7)},${longitude.toFixed(7)}`,
    latitude,
    longitude,
    geometry: null,
    tags: { name: address },
    height: null,
    source: atlas?.reference?.source || { authority: 'Resolved Earth location', license: '', sourceUrl: '' },
  };
}

export default function SimplePropertyPage() {
  const [query, setQuery] = useState('');
  const [resolvedQuery, setResolvedQuery] = useState('');
  const [building, setBuilding] = useState(null);
  const [listings, setListings] = useState([]);
  const [platform, setPlatform] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Add an address. Voxel Vault will build the source-backed 3D draft first.');
  const [saved, setSaved] = useState(null);
  const [session, setSession] = useState(null);
  const clientRef = useRef(null);

  const reference = useMemo(() => referenceFor(building), [building]);
  const draft = useMemo(() => buildPropertyDraft({ building, listing: null, fallbackLabel: resolvedQuery }), [building, resolvedQuery]);
  const exactSale = useMemo(() => {
    if (!building) return null;
    return listings.find((item) => item?.transactionType === 'sale' && distanceMeters(building.latitude, building.longitude, item.latitude, item.longitude) <= 45) || null;
  }, [building, listings]);
  const fractionRail = platform?.investmentRails?.propertySpecificFractionalOwnership || null;
  const fractionProvider = fractionRail?.providerReferences?.[0] || null;

  useEffect(() => {
    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      setSession(data.session || null);
      const auth = client.auth.onAuthStateChange((_event, next) => { if (active) setSession(next || null); });
      subscription = auth.data.subscription;
    }).catch(() => {});

    const initial = new URLSearchParams(window.location.search).get('q') || '';
    if (initial) {
      setQuery(initial);
      window.setTimeout(() => search(initial), 0);
    }
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  async function search(value = query) {
    const address = clean(value);
    if (!address) return;
    setBusy(true);
    setBuilding(null);
    setListings([]);
    setSaved(null);
    setMessage('Building your 3D property…');
    try {
      const params = new URLSearchParams({ address, radius: '180' });
      const [atlasResponse, listingResponse, platformResponse] = await Promise.all([
        fetch(`/api/world-atlas/inspect?${params.toString()}`, { cache: 'no-store' }),
        fetch(`/api/earth-properties/search?q=${encodeURIComponent(address)}&type=sale`, { cache: 'no-store' }),
        fetch('/api/property-platform/status', { cache: 'no-store' }),
      ]);
      const atlas = await atlasResponse.json().catch(() => ({}));
      const market = await listingResponse.json().catch(() => ({}));
      const status = await platformResponse.json().catch(() => ({}));
      if (!atlasResponse.ok || !atlas?.ok) throw new Error(atlas?.error || 'That property could not be mapped yet.');
      const selected = selectedOrLocation(atlas, address);
      if (!selected) throw new Error('That address resolved without a usable map location.');
      setResolvedQuery(address);
      setBuilding(selected);
      setListings(Array.isArray(market?.listings) ? market.listings : []);
      setPlatform(status);
      if (!selected?.geometry) setMessage('Property location ready. No source-backed building footprint exists here, so Voxel Vault kept it as land/location instead of inventing a structure.');
      else setMessage('3D property ready. Choose what you want to do.');
      const nextDraft = buildPropertyDraft({ building: selected, fallbackLabel: address });
      setSaved(nextDraft?.id ? readPropertyDraft(nextDraft.id) : null);
    } catch (error) {
      setResolvedQuery('');
      setMessage(String(error?.message || error || 'Property lookup failed.'));
    } finally { setBusy(false); }
  }

  async function saveToVault() {
    if (!draft) return setMessage('This property needs source-backed identity before it can be saved.');
    try {
      const next = savePropertyDraft(draft);
      setSaved(next);
      if (session?.user) {
        const client = clientRef.current || await getSupabaseBrowserAsync();
        clientRef.current = client;
        await savePropertyDraftToAccount(client, session.user, next);
      }
      setMessage('Saved. It is in your Vault.');
    } catch (error) { setMessage(String(error?.message || error)); }
  }

  async function signIn() {
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
      if (error) throw error;
    } catch (error) { setMessage(String(error?.message || error || 'Could not sign in.')); }
  }

  async function shareWorld() {
    if (!draft) return;
    let current = saved;
    if (!current) {
      current = savePropertyDraft(draft);
      setSaved(current);
    }
    if (!session?.user) {
      setMessage('Your property is saved. Sign in once to put it on the public 3D World.');
      await signIn();
      return;
    }
    try {
      const next = setPropertyDraftWorldVisibility(current.id, true);
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      await savePropertyDraftToAccount(client, session.user, next);
      setSaved(next);
      setMessage('On World. Other people can now see the opt-in 3D property marker and model.');
    } catch (error) { setMessage(String(error?.message || error)); }
  }

  function buyPortion() {
    if (fractionRail?.liveExecutionReady === true) {
      setMessage('A verified fractional execution rail is available for review.');
      return;
    }
    setMessage('No verified fractional offering is connected to this exact property yet. Voxel Vault will not fake a share purchase.');
  }

  function buyWhole() {
    if (exactSale?.sourceUrl) {
      window.open(exactSale.sourceUrl, '_blank', 'noopener,noreferrer');
      setMessage('Opened the authorized sale source. The real purchase still closes through normal contract, title and settlement.');
      return;
    }
    setMessage('This exact property is not currently tied to an authorized sale listing, so Buy Whole stays off.');
  }

  return <main className="page">
    <header><Link href="/">V</Link><nav><Link href="/vault/property-drafts">VAULT</Link><Link href="/world">WORLD</Link></nav></header>

    <section className="searchBlock">
      <small>1 · ADD PROPERTY</small>
      <form onSubmit={(event) => { event.preventDefault(); search(); }}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter any property address" aria-label="Property address"/>
        <button disabled={busy}>{busy ? '…' : 'ADD'}</button>
      </form>
    </section>

    {building ? <section className="property">
      <div className="viewer">{reference ? <GeoReferenceModel reference={reference} authoritativeTwin={null} viewMode="orbit" resetKey={0}/> : <div className="empty3d"><div className="parcel"/><b>LAND / LOCATION</b><span>NO BUILDING INVENTED</span></div>}</div>
      <div className="controls">
        <div className="title"><small>YOUR 3D PROPERTY</small><h1>{resolvedQuery}</h1><span>{building?.source?.authority || 'Source-backed world map'}</span></div>
        <div className="choices">
          <button onClick={buyPortion}><b>BUY A PIECE</b><span>{fractionRail?.liveExecutionReady ? 'VERIFIED RAIL READY' : 'ONLY WHEN VERIFIED'}</span></button>
          <button onClick={buyWhole} className={exactSale?.sourceUrl ? 'ready' : ''}><b>BUY THE WHOLE THING</b><span>{exactSale ? money(exactSale) : 'ONLY WHEN LISTED'}</span></button>
        </div>
        <div className="next">
          <Link href="/vault/properties/claim">VERIFY → MINT</Link>
          <button className={saved ? 'done' : ''} onClick={saveToVault}>{saved ? '✓ IN VAULT' : 'SAVE TO VAULT'}</button>
          <button className={saved?.world?.public ? 'done' : ''} onClick={shareWorld}>{saved?.world?.public ? '✓ ON WORLD' : 'SHOW ON WORLD'}</button>
        </div>
        <p className="message" role="status">{message}</p>
        {fractionProvider?.officialMarketplaceUrl ? <a className="provider" href={fractionProvider.officialMarketplaceUrl} target="_blank" rel="noreferrer">Browse provider-listed fractional properties ↗</a> : null}
        <p className="legal">A 3D model or mint is digital provenance, not a deed. A portion or full-property purchase is shown as real only when a verified provider/listing and the required legal settlement actually exist.</p>
      </div>
    </section> : <section className="start"><div className="cube"><i/><i/><i/></div><b>{busy ? 'ADDING PROPERTY…' : 'ONE PROPERTY. ONE SCREEN.'}</b><span>{message}</span></section>}

    <div className="steps"><span>ADD</span><i>→</i><span>BUY PIECE / WHOLE</span><i>→</i><span>MINT</span><i>→</i><span>VAULT</span><i>→</i><span>WORLD</span></div>

    <style jsx>{`
      :global(body){margin:0;background:#070909;color:#f6f8f7;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:14px clamp(12px,3vw,34px) 84px;background:radial-gradient(circle at 82% 4%,rgba(121,239,188,.12),transparent 26%),#070909}header{height:48px;display:flex;align-items:center;justify-content:space-between}header>a{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:#f6f8f7;color:#07100c;text-decoration:none;font-weight:1000}nav{display:flex;gap:8px}nav a{color:#9aa6a1;text-decoration:none;font-size:8px;font-weight:950;letter-spacing:.12em;padding:10px}.searchBlock{max-width:920px;margin:48px auto 18px}.searchBlock small{display:block;margin-bottom:9px;color:#79efbc;font-size:7px;font-weight:950;letter-spacing:.14em}.searchBlock form{display:grid;grid-template-columns:1fr auto;gap:7px;padding:6px;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:#0e1211}.searchBlock input{min-width:0;border:0;outline:0;background:transparent;color:#fff;padding:15px;font:inherit;font-size:16px}.searchBlock button{border:0;border-radius:14px;padding:0 20px;background:#79efbc;color:#05100b;font-size:9px;font-weight:1000;letter-spacing:.1em}.property{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);gap:10px}.viewer{position:relative;min-height:590px;border:1px solid rgba(255,255,255,.08);border-radius:26px;overflow:hidden;background:#0b0f0e}.empty3d{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:10px;color:#65716d}.empty3d .parcel{width:210px;height:140px;border:2px solid rgba(121,239,188,.38);background:rgba(121,239,188,.05);transform:perspective(420px) rotateX(62deg) rotateZ(-8deg);border-radius:18px}.empty3d b{font-size:9px;letter-spacing:.12em;color:#98afa6}.empty3d span{font-size:6px;font-weight:950;letter-spacing:.12em}.controls{padding:20px;border:1px solid rgba(255,255,255,.08);border-radius:26px;background:rgba(255,255,255,.025)}.title small{color:#79efbc;font-size:7px;font-weight:950;letter-spacing:.13em}.title h1{font-size:clamp(28px,4vw,50px);line-height:.95;letter-spacing:-.055em;margin:8px 0}.title>span{color:#77827e;font-size:8px}.choices{display:grid;gap:8px;margin-top:24px}.choices button{min-height:82px;border:1px solid rgba(255,255,255,.09);border-radius:17px;background:#0d1110;color:#eef3f1;text-align:left;padding:14px;cursor:pointer}.choices button.ready{border-color:rgba(121,239,188,.28);background:rgba(121,239,188,.06)}.choices b{display:block;font-size:13px;letter-spacing:-.01em}.choices span{display:block;margin-top:5px;color:#75817c;font-size:7px;font-weight:850;letter-spacing:.08em}.next{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.next button,.next a{min-height:48px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:#151a18;color:#b4bdb9;text-decoration:none;display:grid;place-items:center;text-align:center;font:inherit;font-size:7px;font-weight:950;letter-spacing:.09em;cursor:pointer}.next a{background:#181d1b}.next button:nth-child(2){background:#f1f5f3;color:#07100c}.next button:last-child{grid-column:1/-1}.next .done{background:#79efbc!important;color:#06100c!important}.message{min-height:38px;margin:12px 0 0;padding:10px;border-radius:12px;background:rgba(121,239,188,.045);color:#9db0a9;font-size:8px;line-height:1.5}.provider{display:inline-block;margin-top:8px;color:#8edbbf;text-decoration:none;font-size:7px;font-weight:850}.legal{margin-top:14px;color:#56625e;font-size:7px;line-height:1.5}.start{max-width:1180px;height:560px;margin:0 auto;border:1px solid rgba(255,255,255,.07);border-radius:28px;display:grid;place-content:center;justify-items:center;gap:12px;text-align:center;background:radial-gradient(circle at 50% 40%,rgba(121,239,188,.08),transparent 28%),#0a0d0c}.start b{font-size:12px;letter-spacing:.12em}.start span{max-width:440px;color:#74807b;font-size:9px;line-height:1.6}.cube{position:relative;width:72px;height:72px;transform:rotate(30deg) skewY(-8deg);background:#79efbc;border-radius:9px;box-shadow:0 25px 70px rgba(121,239,188,.15)}.cube i{position:absolute;background:#173d30}.cube i:nth-child(1){width:18px;height:18px;left:10px;top:12px}.cube i:nth-child(2){width:18px;height:18px;right:10px;top:12px}.cube i:nth-child(3){width:18px;height:18px;left:27px;bottom:10px}.steps{max-width:1180px;margin:10px auto 0;display:flex;align-items:center;justify-content:center;gap:9px;flex-wrap:wrap;color:#61706a;font-size:6px;font-weight:950;letter-spacing:.1em}.steps i{font-style:normal;color:#35413c}@media(max-width:820px){.property{grid-template-columns:1fr}.viewer{min-height:48vh}.controls{padding:15px}.searchBlock{margin-top:28px}.steps{padding:0 8px}}@media(max-width:520px){.page{padding:10px 10px calc(78px + env(safe-area-inset-bottom))}.searchBlock form{border-radius:16px}.searchBlock input{font-size:15px;padding:13px 10px}.searchBlock button{padding:0 15px}.viewer{min-height:43vh;border-radius:20px}.controls{border-radius:20px}.title h1{font-size:31px}.choices{grid-template-columns:1fr 1fr}.choices button{min-height:96px;padding:12px}.choices b{font-size:11px}.next{grid-template-columns:1fr}.next button:last-child{grid-column:auto}.start{height:54vh;min-height:390px}}
    `}</style>
  </main>;
}
