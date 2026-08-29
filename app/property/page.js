'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import GeoReferenceModel from '../geo/GeoReferenceModel';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { buildPropertyDraft, readPropertyDraft, savePropertyDraft, setPropertyDraftWorldVisibility } from '../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../lib/property-drafts-account';
import styles from './property.module.css';

function clean(value) { return String(value || '').trim(); }
function normalizedAddress(value) {
  return clean(value).toLowerCase()
    .replace(/\bavenue\b/g, 'ave').replace(/\bstreet\b/g, 'st').replace(/\broad\b/g, 'rd')
    .replace(/\bboulevard\b/g, 'blvd').replace(/\bdrive\b/g, 'dr').replace(/\blane\b/g, 'ln')
    .replace(/\bcourt\b/g, 'ct').replace(/\bplace\b/g, 'pl').replace(/\bnew york\b/g, 'ny')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
function listingMatchesResolvedAddress(listing, address) {
  const expected = normalizedAddress(address);
  const actual = normalizedAddress([listing?.address, listing?.city, listing?.region, listing?.postalCode].filter(Boolean).join(' '));
  if (!expected || !actual) return false;
  const expectedNumber = expected.match(/^\d+/)?.[0] || '';
  const actualNumber = actual.match(/^\d+/)?.[0] || '';
  if (!expectedNumber || expectedNumber !== actualNumber) return false;
  return actual === expected || actual.includes(expected) || expected.includes(actual);
}
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
    if (!building || !resolvedQuery) return null;
    return listings.find((item) => item?.transactionType === 'sale'
      && Boolean(item?.sourceUrl)
      && distanceMeters(building.latitude, building.longitude, item.latitude, item.longitude) <= 45
      && listingMatchesResolvedAddress(item, resolvedQuery)) || null;
  }, [building, listings, resolvedQuery]);
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
      setMessage(selected?.geometry
        ? '3D property ready. Choose what you want to do.'
        : 'Property location ready. No source-backed building footprint exists here, so Voxel Vault kept it as land/location instead of inventing a structure.');
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
      setMessage('Opened the exact authorized sale source. The real purchase still closes through normal contract, title and settlement.');
      return;
    }
    setMessage('This exact address is not currently tied to an authorized matching sale listing, so Buy Whole stays off.');
  }

  return <main className={styles.page}>
    <header className={styles.header}><Link className={styles.logo} href="/">V</Link><nav className={styles.nav}><Link href="/vault/property-drafts">VAULT</Link><Link href="/world">WORLD</Link></nav></header>
    <section className={styles.searchBlock}>
      <small>1 · ADD PROPERTY</small>
      <form className={styles.searchForm} onSubmit={(event) => { event.preventDefault(); search(); }}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter any property address" aria-label="Property address"/>
        <button disabled={busy}>{busy ? '…' : 'ADD'}</button>
      </form>
    </section>

    {building ? <section className={styles.property}>
      <div className={styles.viewer}>{reference ? <GeoReferenceModel reference={reference} authoritativeTwin={null} viewMode="orbit" resetKey={0}/> : <div className={styles.empty3d}><div className={styles.parcel}/><b>LAND / LOCATION</b><span>NO BUILDING INVENTED</span></div>}</div>
      <div className={styles.controls}>
        <div className={styles.title}><small>YOUR 3D PROPERTY</small><h1>{resolvedQuery}</h1><span>{building?.source?.authority || 'Source-backed world map'}</span></div>
        <div className={styles.choices}>
          <button onClick={buyPortion}><b>BUY A PIECE</b><span>{fractionRail?.liveExecutionReady ? 'VERIFIED RAIL READY' : 'ONLY WHEN VERIFIED'}</span></button>
          <button onClick={buyWhole} className={exactSale?.sourceUrl ? styles.ready : ''}><b>BUY THE WHOLE THING</b><span>{exactSale ? money(exactSale) : 'ONLY WHEN EXACTLY LISTED'}</span></button>
        </div>
        <div className={styles.next}>
          <Link href="/vault/properties/claim">VERIFY → MINT</Link>
          <button className={saved ? styles.done : ''} onClick={saveToVault}>{saved ? '✓ IN VAULT' : 'SAVE TO VAULT'}</button>
          <button className={saved?.world?.public ? styles.done : ''} onClick={shareWorld}>{saved?.world?.public ? '✓ ON WORLD' : 'SHOW ON WORLD'}</button>
        </div>
        <p className={styles.message} role="status">{message}</p>
        {fractionProvider?.officialMarketplaceUrl ? <a className={styles.provider} href={fractionProvider.officialMarketplaceUrl} target="_blank" rel="noreferrer">Browse provider-listed fractional properties ↗</a> : null}
        <p className={styles.legal}>A 3D model or mint is digital provenance, not a deed. A portion or full-property purchase is shown as real only when a verified provider/listing and the required legal settlement actually exist.</p>
      </div>
    </section> : <section className={styles.start}><div className={styles.cube}><i/><i/><i/></div><b>{busy ? 'ADDING PROPERTY…' : 'ONE PROPERTY. ONE SCREEN.'}</b><span>{message}</span></section>}

    <div className={styles.steps}><span>ADD</span><i>→</i><span>BUY PIECE / WHOLE</span><i>→</i><span>MINT</span><i>→</i><span>VAULT</span><i>→</i><span>WORLD</span></div>
  </main>;
}
