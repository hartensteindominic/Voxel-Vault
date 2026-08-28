'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import GeoReferenceModel from '../../geo/GeoReferenceModel';
import GlobalEarthGlobe from './GlobalEarthGlobe';
import GoogleRealityMap from './GoogleRealityMap';
import MeshyHeroPanel from './MeshyHeroPanel';
import PropertyEvidencePanel from './PropertyEvidencePanel';

const GOOGLE_3D_ENABLED = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY);

const CATEGORIES = [
  ['all', 'All'], ['house', 'Houses'], ['condo', 'Condos'], ['mobile-home', 'Mobile'],
  ['multifamily', 'Multifamily'], ['storefront', 'Storefronts'], ['commercial', 'Commercial'],
  ['warehouse', 'Warehouses'], ['barn-farm', 'Farms'], ['land', 'Land'],
];

const QUICK_LOCATIONS = [
  { id: 'kensington', label: '1047 Kensington', query: '1047 Kensington Ave, Buffalo, NY 14215', lat: 42.9382, lng: -78.8206 },
  { id: 'buffalo', label: 'Buffalo', query: 'Buffalo, NY', lat: 42.8864, lng: -78.8784 },
  { id: 'new-york', label: 'New York', query: 'New York, NY', lat: 40.7128, lng: -74.0060 },
  { id: 'london', label: 'London', query: 'London, UK', lat: 51.5074, lng: -0.1278 },
  { id: 'tokyo', label: 'Tokyo', query: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
  { id: 'sydney', label: 'Sydney', query: 'Sydney, Australia', lat: -33.8688, lng: 151.2093 },
];

function money(property) {
  if (!property) return 'Price on request';
  const cents = Number(property.marketValueCents);
  if (Number.isFinite(cents)) {
    const currency = /^[A-Z]{3}$/.test(String(property.currency || '')) ? property.currency : 'USD';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100)
        + (property.transactionType === 'rent' ? ' / mo' : '');
    } catch {}
  }
  return property.marketValueText || 'Price on request';
}

function addressLine(property) {
  return [property?.address, property?.city, property?.region, property?.postalCode, property?.country].filter(Boolean).join(', ');
}

function safeMapUrl(property) {
  if (Number.isFinite(Number(property?.latitude)) && Number.isFinite(Number(property?.longitude))) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.latitude},${property.longitude}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine(property))}`;
}

function categoryLabel(category) { return CATEGORIES.find(([id]) => id === category)?.[1] || 'Property'; }
function shortProvider(provider) { return String(provider || 'Authorized source').replace(' / authorized MLS', ' MLS'); }

function atlasBuildingLabel(building) {
  if (!building) return 'Mapped building';
  const sourceAddress = [building.tags?.houseNumber, building.tags?.street].filter(Boolean).join(' ');
  return building.tags?.name || sourceAddress || building.tags?.building || 'Mapped building';
}

function atlasReferenceForSelection(atlas, selected) {
  if (!atlas?.reference) return null;
  if (!selected) return atlas.reference;
  return {
    ...atlas.reference,
    found: true,
    latitude: selected.latitude,
    longitude: selected.longitude,
    geometry: selected.geometry,
    tags: selected.tags || {},
    height: selected.height || null,
    matchStrategy: 'world_atlas_selected_building',
    source: selected.source || atlas.reference.source,
    neighborhoodBuildings: (atlas.buildings || []).map((building) => ({
      id: building.atlasId,
      selected: building.atlasId === selected.atlasId,
      distanceMeters: building.distanceMeters,
      center: { latitude: building.latitude, longitude: building.longitude },
      geometry: building.geometry,
      tags: building.tags,
      height: building.height,
      sourceUrl: building.source?.sourceUrl || '',
    })),
  };
}

function parseCoordinateQuery(value) {
  const match = String(value || '').trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function sourceMode(atlas) {
  if (!atlas?.sourceStatus) return { label: 'WAITING FOR REGION', fallback: false };
  if (atlas.sourceStatus.primary === 'overture-pmtiles' && !atlas.sourceStatus.fallbackUsed) return { label: 'OVERTURE PRIMARY', fallback: false };
  return { label: 'OSM FALLBACK', fallback: true };
}

function listingVisual(item) {
  if (item?.imageUrl) return <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" />;
  return <div className="listingPlaceholder"><span>{categoryLabel(item?.category)}</span><div className="miniBuilding"><i/><i/><i/></div></div>;
}

function capabilityLabel(capabilities, key) {
  if (!capabilities) return 'CHECKING';
  return capabilities?.[key]?.configured ? 'READY' : 'NOT CONNECTED';
}

export default function EarthPropertiesPage() {
  const starter = QUICK_LOCATIONS[0];
  const [query, setQuery] = useState(starter.query);
  const [focus, setFocus] = useState({ lat: starter.lat, lng: starter.lng, label: starter.query });
  const [view, setView] = useState(GOOGLE_3D_ENABLED ? 'reality' : 'voxel');
  const [category, setCategory] = useState('all');
  const [type, setType] = useState('all');
  const [listings, setListings] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [listingMessage, setListingMessage] = useState('Real listings only. Authorized market feeds are checked separately from the world map.');
  const [configured, setConfigured] = useState(null);
  const [listingBusy, setListingBusy] = useState(false);
  const [lastSearch, setLastSearch] = useState(null);
  const [atlas, setAtlas] = useState(null);
  const [atlasBusy, setAtlasBusy] = useState(false);
  const [atlasMessage, setAtlasMessage] = useState('Loading the 1047 Kensington starter region…');
  const [selectedAtlasId, setSelectedAtlasId] = useState('');
  const [capabilities, setCapabilities] = useState(null);

  const selected = useMemo(() => listings.find((item) => item.id === selectedId) || listings[0] || null, [listings, selectedId]);
  const liveProviders = providers.filter((provider) => provider.configured);
  const atlasBuildings = useMemo(() => Array.isArray(atlas?.buildings) ? atlas.buildings : [], [atlas]);
  const selectedAtlas = useMemo(
    () => atlasBuildings.find((item) => item.atlasId === selectedAtlasId) || atlas?.selectedBuilding || atlasBuildings[0] || null,
    [atlasBuildings, selectedAtlasId, atlas],
  );
  const atlasReference = useMemo(() => atlasReferenceForSelection(atlas, selectedAtlas), [atlas, selectedAtlas]);
  const mode = sourceMode(atlas);
  const visualLat = Number.isFinite(Number(selectedAtlas?.latitude)) ? Number(selectedAtlas.latitude) : focus.lat;
  const visualLng = Number.isFinite(Number(selectedAtlas?.longitude)) ? Number(selectedAtlas.longitude) : focus.lng;
  const visualLabel = selected?.address || atlasBuildingLabel(selectedAtlas) || focus.label;

  async function loadCapabilities() {
    try {
      const response = await fetch('/api/world-atlas/capabilities', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (response.ok) setCapabilities(data);
    } catch {}
  }

  async function loadListings(params = {}, nextCategory = category, nextType = type) {
    setListingBusy(true);
    try {
      const search = new URLSearchParams({ category: nextCategory, type: nextType });
      if (params?.query) search.set('q', params.query);
      if (Number.isFinite(params?.lat) && Number.isFinite(params?.lng)) {
        search.set('lat', String(params.lat));
        search.set('lng', String(params.lng));
      }
      const response = await fetch(`/api/earth-properties/search?${search.toString()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Property search failed.');
      setConfigured(Boolean(data.configured));
      setProviders(Array.isArray(data.providers) ? data.providers : []);
      setListings(Array.isArray(data.listings) ? data.listings : []);
      setSelectedId(data.listings?.[0]?.id || '');
      setListingMessage(data.message || 'Market search complete.');
    } catch (error) {
      setListings([]);
      setSelectedId('');
      setListingMessage(String(error?.message || error || 'Market search failed. The map remains available.'));
    } finally { setListingBusy(false); }
  }

  async function loadAtlas(params = {}) {
    setAtlasBusy(true);
    setAtlasMessage('Reading a small source-backed building region…');
    try {
      const search = new URLSearchParams({ radius: '180' });
      if (params?.address && !Number.isFinite(params?.lat)) search.set('address', String(params.address));
      if (Number.isFinite(params?.lat) && Number.isFinite(params?.lng)) {
        search.set('lat', String(params.lat));
        search.set('lng', String(params.lng));
      }
      const response = await fetch(`/api/world-atlas/inspect?${search.toString()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'World atlas lookup failed.');
      setAtlas(data);
      setSelectedAtlasId(data.selectedBuilding?.atlasId || data.buildings?.[0]?.atlasId || '');
      if (Number.isFinite(Number(data.latitude)) && Number.isFinite(Number(data.longitude))) {
        setFocus({ lat: Number(data.latitude), lng: Number(data.longitude), label: data.address || params?.query || params?.address || 'Selected Earth location' });
      }
      const source = data?.sourceStatus?.fallbackUsed ? 'OpenStreetMap fallback' : 'Overture';
      setAtlasMessage(data.buildingCount
        ? `${data.buildingCount} source-backed building${data.buildingCount === 1 ? '' : 's'} loaded from ${source}.`
        : `Location resolved through ${source}, but no building footprint was returned. Nothing was invented.`);
    } catch (error) {
      setAtlas(null);
      setSelectedAtlasId('');
      setAtlasMessage(`${String(error?.message || error || 'World atlas lookup failed.')} Reality links and authorized market search remain usable.`);
    } finally { setAtlasBusy(false); }
  }

  async function explore(params = {}) {
    setLastSearch(params);
    if (Number.isFinite(params?.lat) && Number.isFinite(params?.lng)) {
      setFocus({ lat: Number(params.lat), lng: Number(params.lng), label: params.query || `${params.lat}, ${params.lng}` });
    }
    await Promise.allSettled([loadListings(params), loadAtlas(params)]);
  }

  useEffect(() => {
    loadCapabilities();
    loadListings({ query: starter.query, lat: starter.lat, lng: starter.lng });
    loadAtlas({ lat: starter.lat, lng: starter.lng, query: starter.query });
  }, []);

  function submit(event) {
    event.preventDefault();
    const value = query.trim();
    if (!value) { setAtlasMessage('Enter a city, country, postcode, address, or latitude/longitude pair.'); return; }
    const coordinates = parseCoordinateQuery(value);
    if (coordinates) { explore({ ...coordinates, query: value }); return; }
    explore({ query: value, address: value });
  }

  function quickExplore(location) {
    setQuery(location.query);
    setFocus({ lat: location.lat, lng: location.lng, label: location.query });
    explore({ lat: location.lat, lng: location.lng, query: location.query });
  }

  function nearMe() {
    if (!navigator.geolocation) { setAtlasMessage('Location services are unavailable in this browser.'); return; }
    setAtlasBusy(true);
    setAtlasMessage('Getting your location…');
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setQuery(label);
      setFocus({ lat, lng, label });
      explore({ lat, lng, query: label });
    }, (error) => {
      setAtlasBusy(false);
      setAtlasMessage(error.message || 'Location permission was not granted.');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  function globeLocation({ latitude, longitude }) {
    const label = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    setQuery(label);
    setFocus({ lat: latitude, lng: longitude, label });
    setAtlasMessage(`Exploring source-backed buildings around ${label}…`);
    explore({ lat: latitude, lng: longitude, query: label });
  }

  function chooseCategory(next) { setCategory(next); loadListings(lastSearch || {}, next, type); }
  function chooseType(next) { setType(next); loadListings(lastSearch || {}, category, next); }

  function chooseListing(item) {
    setSelectedId(item.id);
    if (Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))) {
      const lat = Number(item.latitude), lng = Number(item.longitude);
      setFocus({ lat, lng, label: addressLine(item) || 'Selected listing' });
      loadAtlas({ lat, lng, query: addressLine(item) });
    }
  }

  function downloadRegion() {
    if (!atlasBuildings.length) return;
    const geojson = {
      type: 'FeatureCollection',
      name: 'Voxel Vault loaded atlas region',
      generatedAt: new Date().toISOString(),
      sourceStatus: atlas?.sourceStatus || null,
      rights: atlas?.rights || null,
      features: atlasBuildings.map((building) => ({
        type: 'Feature', id: building.atlasId, geometry: building.geometry,
        properties: {
          atlasId: building.atlasId, name: building.tags?.name || null, building: building.tags?.building || null,
          levels: building.tags?.levels || null, referenceHeightMeters: building.height?.referenceHeightMeters ?? null,
          heightStatus: building.height?.heightStatus || null, sourceAuthority: building.source?.authority || null,
          sourceRecordId: building.source?.recordId || null, sourceLicense: building.source?.license || null,
          sourceUrl: building.source?.sourceUrl || null, mapReferenceOnly: true,
        },
      })),
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `voxel-vault-region-${Number(focus.lat).toFixed(4)}-${Number(focus.lng).toFixed(4)}.geojson`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  return <main className="page">
    <header>
      <Link className="brand" href="/vault">VOXEL VAULT</Link>
      <nav><Link href="/geo">GEO</Link><Link href="/vault/estates/mine">MY TWINS</Link><Link href="/vault/properties/claim">VERIFY</Link></nav>
    </header>

    <section className="hero">
      <div className="kicker"><i/> VOXEL VAULT WORLD ATLAS</div>
      <h1>The whole Earth.<br/><em>Reality + data + 3D.</em></h1>
      <p>Search a real address and inspect the same place three ways: Google Photorealistic 3D when configured, Voxel Vault source-backed geometry, and the global navigation globe. Real listings only come from authorized market providers.</p>
      <form onSubmit={submit} className="search">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Address, city, postcode · or latitude, longitude" aria-label="Search Earth" />
        <button disabled={atlasBusy || listingBusy}>{atlasBusy ? 'LOADING…' : 'EXPLORE'}</button>
        <button className="near" type="button" onClick={nearMe} disabled={atlasBusy}>NEAR ME</button>
      </form>
      <div className="quickRail">{QUICK_LOCATIONS.map((location) => <button type="button" key={location.id} onClick={() => quickExplore(location)} disabled={atlasBusy}>{location.label}</button>)}</div>
      <div className="capabilityRail">
        <div><b>WORLD DATA</b><span>{capabilityLabel(capabilities, 'worldAtlas')}</span></div>
        <div><b>GOOGLE 3D</b><span>{capabilityLabel(capabilities, 'googleReality')}</span></div>
        <div><b>MESHY 7</b><span>{capabilityLabel(capabilities, 'meshy')}</span></div>
        <div><b>MARKET</b><span>{liveProviders.length ? `${liveProviders.length} LIVE` : 'AWAITING ACCESS'}</span></div>
      </div>
    </section>

    <section className="explorer">
      <div className="explorerTop">
        <div><small>WORLD BUILDING ATLAS</small><h2>{visualLabel}</h2><p>{atlasMessage}</p></div>
        <div className="viewTabs">
          <button className={view === 'reality' ? 'active' : ''} onClick={() => setView('reality')}>REALITY</button>
          <button className={view === 'voxel' ? 'active' : ''} onClick={() => setView('voxel')}>VOXEL</button>
          <button className={view === 'globe' ? 'active' : ''} onClick={() => setView('globe')}>GLOBE</button>
        </div>
      </div>

      <div className="explorerGrid">
        <div className="visualStage">
          {view === 'reality' ? <GoogleRealityMap latitude={visualLat} longitude={visualLng} label={visualLabel} active /> : null}
          {view === 'voxel' ? <div className="voxelStage">{atlasReference?.found
            ? <GeoReferenceModel reference={atlasReference} authoritativeTwin={null} viewMode="orbit" resetKey={selectedAtlas?.atlasId || 'atlas'} />
            : <div className="stageFallback"><b>{atlasBusy ? 'READING BUILDING DATA…' : 'SOURCE GEOMETRY UNAVAILABLE'}</b><span>Reality and source links still work. Voxel Vault will not invent a footprint.</span></div>}</div> : null}
          {view === 'globe' ? <div className="globeStage"><GlobalEarthGlobe listings={listings} selectedId={selected?.id || ''} onSelect={setSelectedId} atlasBuildings={atlasBuildings} selectedAtlasId={selectedAtlas?.atlasId || ''} onAtlasSelect={setSelectedAtlasId} onLocation={globeLocation} /><div className="globeHint">DRAG · PINCH · TAP EARTH · PEACH = MAP · MINT = LISTING</div></div> : null}
        </div>

        <aside className="propertyCard">
          <div className="sourceRow"><span className={mode.fallback ? 'fallback' : ''}>{mode.label}</span><span>{atlasBuildings.length} BUILDINGS</span></div>
          <small>SELECTED PLACE</small>
          <h3>{atlasBuildingLabel(selectedAtlas)}</h3>
          <p>{visualLat.toFixed(5)}, {visualLng.toFixed(5)}</p>
          <div className="facts"><div><b>{selectedAtlas?.tags?.levels || '—'}</b><span>FLOORS</span></div><div><b>{selectedAtlas?.height?.referenceHeightMeters ? `${Number(selectedAtlas.height.referenceHeightMeters).toFixed(1)}m` : '—'}</b><span>DISPLAY HEIGHT</span></div><div><b>{selectedAtlas?.source?.license || '—'}</b><span>MAP LICENSE</span></div></div>
          <div className="truthBox"><b>WHAT IS VERIFIED?</b><span>Location and map geometry are source-backed when shown. Facade appearance, exact roof/windows/materials, title, and sale status require their own evidence layers.</span></div>
          <button type="button" className="download" onClick={downloadRegion} disabled={!atlasBuildings.length}>DOWNLOAD LOADED REGION · GEOJSON</button>
          {selectedAtlas?.source?.sourceUrl ? <a className="sourceLink" href={selectedAtlas.source.sourceUrl} target="_blank" rel="noreferrer">OPEN MAP SOURCE ↗</a> : null}
        </aside>
      </div>

      <PropertyEvidencePanel listing={selected} building={selectedAtlas} fallbackLabel={focus.label} />

      <div className="meshyZone">
        <div className="meshyIntro"><small>MESHY · THE PERFECT AMOUNT</small><h2>Use AI detail only on selected buildings.</h2><p>Google Maps stays the live photorealistic reality layer. Meshy 7 creates a cached property model only from 2–4 user-owned, open-licensed, or explicitly derivative-licensed views. Normal browsing never spends Meshy credits.</p></div>
        <MeshyHeroPanel building={selectedAtlas} listing={selected} />
      </div>
    </section>

    <section className="marketSection">
      <div className="sectionHead"><div><small>AUTHORIZED REAL-ESTATE MARKET</small><h2>Real listings only.</h2><p>{listingMessage}</p></div><div className="marketState"><b>{listings.length}</b><span>LIVE RESULTS</span></div></div>
      <div className="coverage"><b>LIVE COVERAGE</b><span>{liveProviders.length ? liveProviders.map((p) => p.name).join(' · ') : 'No licensed listing provider is connected in this deployment.'}</span><b>AWAITING ACCESS</b><span>{providers.filter((p) => !p.configured).map((p) => p.name).join(' · ') || 'Additional licensed markets can be added without changing the map layer.'}</span></div>
      <div className="filters"><div>{[['all', 'Buy + Rent'], ['sale', 'For Sale'], ['rent', 'For Rent']].map(([id, label]) => <button key={id} className={type === id ? 'active' : ''} onClick={() => chooseType(id)}>{label}</button>)}</div><div>{CATEGORIES.map(([id, label]) => <button key={id} className={category === id ? 'active' : ''} onClick={() => chooseCategory(id)}>{label}</button>)}</div></div>
      <div className="marketGrid">
        <div className="results">{listings.length === 0 ? <div className="empty"><b>{configured === false ? 'MAP READY · MARKET FEED NOT CONNECTED' : listingBusy ? 'CHECKING AUTHORIZED MARKET…' : 'NO LIVE LISTINGS HERE'}</b><span>Mapped buildings can still be explored. Voxel Vault does not fabricate listing inventory.</span></div> : listings.map((item) => <button key={item.id} className={selected?.id === item.id ? 'listing active' : 'listing'} onClick={() => chooseListing(item)}><div className="photo">{listingVisual(item)}</div><div className="listingBody"><div className="sourceTag">{shortProvider(item.provider)} · {item.country || 'Earth'}</div><strong>{money(item)}</strong><b>{item.address || 'Address from source'}</b><small>{[item.city, item.region, item.postalCode].filter(Boolean).join(', ')}</small><div>{item.beds != null ? `${item.beds} bd · ` : ''}{item.baths != null ? `${item.baths} ba · ` : ''}{item.livingAreaSqft ? `${Math.round(item.livingAreaSqft).toLocaleString()} sqft` : categoryLabel(item.category)}</div></div></button>)}</div>
        <aside className="detail">{selected ? <><div className="detailVisual">{listingVisual(selected)}<span>AUTHORIZED LISTING MEDIA</span></div><div className="detailBody"><div className="source"><i/>{selected.provider} · {selected.status}</div><h2>{selected.address || 'Real Earth property'}</h2><p>{[selected.city, selected.region, selected.postalCode, selected.country].filter(Boolean).join(', ')}</p><div className="price"><span>{selected.marketValueLabel}</span><strong>{money(selected)}</strong></div><div className="listingFacts"><div><b>{selected.beds ?? '—'}</b><span>BEDS</span></div><div><b>{selected.baths ?? '—'}</b><span>BATHS</span></div><div><b>{selected.livingAreaSqft ? Math.round(selected.livingAreaSqft).toLocaleString() : '—'}</b><span>SQ FT</span></div></div><a className="primaryButton" href={selected.sourceUrl || safeMapUrl(selected)} target="_blank" rel="noreferrer">{selected.sourceUrl ? 'OPEN REAL SOURCE LISTING' : 'OPEN EARTH LOCATION'} ↗</a><Link className="secondary" href="/vault/properties/claim">MINTING RECOMMENDED AFTER VERIFICATION</Link><p className="fine"><b>Physical purchase:</b> broker → contract → title → closing → deed-recording. A Voxel Vault twin or NFT does not replace the deed.</p></div></> : <div className="detailEmpty"><b>MAP ≠ MARKET INVENTORY</b><span>A mapped building can exist without being for sale or rent.</span></div>}</aside>
      </div>
    </section>

    <section className="governance">
      <article><small>ANTI-MONOPOLY STEWARDSHIP</small><h2>More claims, higher marginal fee.</h2><p>The proposed digital-stewardship schedule is <b>linear, not exponential</b>: $1/year base + $0.25 per existing global claim + $0.75 per existing claim in the same local region. Regional cap: 20. No owner/admin exemption.</p><div className="policyTruth"><b>POLICY MODEL · BILLING DISABLED</b><span>This is not a government tax and does not create rights in physical property.</span></div></article>
      <article><small>WHO OWNS THE WORLD MAP?</small><h2>Voxel Vault can own the atlas product—not the Earth.</h2><p>Voxel Vault can own its software, interface, original metadata, compliant model cache and workflows. Google, Overture, OpenStreetMap, municipalities and listing providers keep their own data and licenses.</p></article>
    </section>

    <footer><b>REALITY ≠ TITLE ≠ INVESTMENT</b><span>Physical-market value and digital twin resale value remain separate. Google imagery is used only through permitted live visualization; map geometry, listing photos, Meshy models, legal ownership and investment rights remain separate evidence layers.</span></footer>

    <style jsx>{`
      :global(body){margin:0;background:#07100f;color:#f4f7f6;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:0 clamp(12px,3vw,38px) 90px;background:radial-gradient(circle at 80% 2%,rgba(105,82,214,.13),transparent 24%),radial-gradient(circle at 12% 20%,rgba(75,202,154,.08),transparent 26%),#07100f}.page *{box-sizing:border-box}header{height:62px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.055);position:sticky;top:0;background:rgba(7,16,15,.86);backdrop-filter:blur(18px);z-index:20}.brand{color:#fff;text-decoration:none;font-size:10px;font-weight:1000;letter-spacing:.16em}nav{display:flex;gap:16px}nav a{color:#8e9b95;text-decoration:none;font-size:8px;font-weight:850;letter-spacing:.08em}.hero{max-width:1180px;margin:0 auto;padding:54px 0 28px;display:grid;gap:15px}.kicker,.explorerTop small,.sectionHead small,.meshyIntro small,.governance small{font-size:7px;letter-spacing:.15em;font-weight:950;color:#79ddb7}.kicker i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#79efbc;box-shadow:0 0 18px #79efbc;margin-right:6px}.hero h1{font-size:clamp(42px,7vw,88px);line-height:.92;letter-spacing:-.065em;margin:0;max-width:900px}.hero h1 em{font-style:normal;color:#8fe3c2}.hero>p{max-width:800px;color:#89958f;font-size:12px;line-height:1.65;margin:0}.search{display:grid;grid-template-columns:1fr auto auto;gap:8px;max-width:920px}.search input{min-width:0;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:#0a1513;color:#f4f7f6;padding:15px;font-size:11px;outline:none}.search button,.quickRail button,.viewTabs button,.filters button,.download{border:1px solid rgba(255,255,255,.08);border-radius:12px;background:#101c19;color:#cbd7d2;padding:12px 14px;font-size:7px;font-weight:950;letter-spacing:.08em}.search button:first-of-type{background:#fff;color:#07100f}.search button:disabled,.quickRail button:disabled,.download:disabled{opacity:.45}.quickRail{display:flex;gap:7px;flex-wrap:wrap}.quickRail button{padding:9px 11px;background:rgba(255,255,255,.035)}.capabilityRail{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;max-width:920px}.capabilityRail>div{display:flex;justify-content:space-between;gap:8px;padding:10px;border:1px solid rgba(255,255,255,.06);border-radius:12px;background:rgba(255,255,255,.02)}.capabilityRail b,.capabilityRail span{font-size:6px;letter-spacing:.1em}.capabilityRail span{color:#88d8b9}.explorer,.marketSection{max-width:1180px;margin:0 auto;padding:32px 0;border-top:1px solid rgba(255,255,255,.065);display:grid;gap:16px}.explorerTop,.sectionHead{display:flex;justify-content:space-between;gap:16px;align-items:end}.explorerTop h2,.sectionHead h2,.meshyIntro h2,.governance h2{font-size:clamp(25px,4vw,42px);letter-spacing:-.05em;margin:4px 0}.explorerTop p,.sectionHead p,.meshyIntro p,.governance p{color:#83908a;font-size:10px;line-height:1.6;margin:0;max-width:760px}.viewTabs{display:flex;gap:6px;padding:4px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:#08110f}.viewTabs button{padding:9px 12px;border:0;background:transparent}.viewTabs button.active{background:#fff;color:#07100f}.explorerGrid{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(250px,.65fr);gap:12px}.visualStage{min-height:430px}.voxelStage,.globeStage{height:min(58vh,650px);min-height:430px;position:relative;border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:#0a1412}.stageFallback{height:100%;display:grid;place-content:center;text-align:center;gap:8px;padding:30px}.stageFallback b{font-size:9px;letter-spacing:.12em}.stageFallback span{font-size:9px;color:#7b8782}.globeHint{position:absolute;left:12px;right:12px;bottom:10px;text-align:center;padding:8px;border-radius:10px;background:rgba(4,8,7,.7);font-size:6px;color:#9aa7a1;letter-spacing:.08em}.propertyCard{border:1px solid rgba(255,255,255,.08);border-radius:24px;background:rgba(255,255,255,.022);padding:16px;display:grid;align-content:start;gap:11px}.propertyCard small{font-size:7px;color:#718078;letter-spacing:.12em;font-weight:950}.propertyCard h3{font-size:25px;line-height:1.02;letter-spacing:-.045em;margin:0}.propertyCard>p{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;color:#809088;margin:0}.sourceRow{display:flex;gap:6px;flex-wrap:wrap}.sourceRow span{border:1px solid rgba(121,239,188,.12);background:rgba(121,239,188,.05);color:#80d9b6;border-radius:999px;padding:6px 8px;font-size:6px;font-weight:950;letter-spacing:.08em}.sourceRow span.fallback{color:#f1b08e;border-color:rgba(241,176,142,.15);background:rgba(241,176,142,.05)}.facts,.listingFacts{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.facts>div,.listingFacts>div{display:grid;gap:3px;padding:10px;border:1px solid rgba(255,255,255,.06);border-radius:12px;background:rgba(0,0,0,.13)}.facts b,.listingFacts b{font-size:14px}.facts span,.listingFacts span{font-size:6px;color:#718078;letter-spacing:.09em}.truthBox,.policyTruth{display:grid;gap:4px;padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(0,0,0,.16)}.truthBox b,.policyTruth b{font-size:7px;letter-spacing:.1em}.truthBox span,.policyTruth span{font-size:8px;line-height:1.55;color:#84918b}.download{width:100%;background:#12231e}.sourceLink,.secondary{color:#cfeee1;text-decoration:none;font-size:7px;font-weight:900;letter-spacing:.08em}.meshyZone{display:grid;grid-template-columns:.7fr 1.3fr;gap:12px;align-items:start;margin-top:4px}.meshyIntro{padding:18px}.marketState{display:grid;text-align:right}.marketState b{font-size:30px}.marketState span{font-size:6px;color:#748079;letter-spacing:.1em}.coverage{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;padding:11px;border:1px solid rgba(255,255,255,.06);border-radius:14px;background:rgba(255,255,255,.018)}.coverage b{font-size:6px;letter-spacing:.11em;color:#80d9b6}.coverage span{font-size:8px;color:#7e8b85}.filters{display:grid;gap:7px}.filters>div{display:flex;gap:6px;overflow:auto;padding-bottom:2px}.filters button{white-space:nowrap;padding:8px 10px;background:rgba(255,255,255,.025)}.filters button.active{background:#fff;color:#07100f}.marketGrid{display:grid;grid-template-columns:1.35fr .75fr;gap:12px}.results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-content:start}.listing{display:grid;grid-template-columns:110px 1fr;gap:9px;text-align:left;border:1px solid rgba(255,255,255,.06);border-radius:16px;background:rgba(255,255,255,.018);color:#eaf2ef;padding:7px;overflow:hidden}.listing.active{border-color:rgba(121,239,188,.35);background:rgba(121,239,188,.045)}.photo{height:108px;border-radius:11px;overflow:hidden;background:#101a18}.photo :global(img),.detailVisual :global(img){width:100%;height:100%;object-fit:cover}.listingPlaceholder{height:100%;display:grid;place-content:center;text-align:center;gap:7px;color:#7e8b85;font-size:7px}.miniBuilding{display:flex;gap:2px;justify-content:center;align-items:end;height:34px}.miniBuilding i{display:block;width:13px;background:#3b5f52;border-radius:2px 2px 0 0}.miniBuilding i:nth-child(1){height:18px}.miniBuilding i:nth-child(2){height:30px}.miniBuilding i:nth-child(3){height:23px}.listingBody{min-width:0;display:grid;align-content:center;gap:3px}.sourceTag{font-size:6px;color:#77cba9;letter-spacing:.08em}.listingBody strong{font-size:15px}.listingBody b{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.listingBody small,.listingBody>div:last-child{font-size:7px;color:#7d8984}.detail{border:1px solid rgba(255,255,255,.07);border-radius:20px;overflow:hidden;background:rgba(255,255,255,.02);min-height:360px}.detailVisual{height:190px;position:relative;background:#0d1715}.detailVisual>span{position:absolute;left:9px;bottom:8px;background:rgba(4,8,7,.8);padding:6px 8px;border-radius:8px;font-size:6px;letter-spacing:.08em}.detailBody{padding:15px;display:grid;gap:10px}.source{font-size:7px;color:#7ccfac}.source i{display:inline-block;width:5px;height:5px;border-radius:50%;background:#79efbc;margin-right:5px}.detailBody h2{font-size:25px;line-height:.98;letter-spacing:-.05em;margin:0}.detailBody>p{font-size:8px;color:#7c8983;margin:0}.price{display:grid;gap:2px}.price span{font-size:6px;color:#6e7b75;letter-spacing:.08em}.price strong{font-size:24px}.primaryButton{display:block;text-align:center;background:#fff;color:#07100f;text-decoration:none;border-radius:12px;padding:12px;font-size:7px;font-weight:950;letter-spacing:.08em}.fine{font-size:7px!important;line-height:1.55!important;color:#6d7a74!important}.empty,.detailEmpty{min-height:250px;display:grid;place-content:center;text-align:center;gap:7px;padding:24px;border:1px dashed rgba(255,255,255,.08);border-radius:18px}.empty b,.detailEmpty b{font-size:8px;letter-spacing:.1em}.empty span,.detailEmpty span{font-size:8px;color:#7c8983;line-height:1.55}.governance{max-width:1180px;margin:0 auto;padding:32px 0;border-top:1px solid rgba(255,255,255,.065);display:grid;grid-template-columns:1fr 1fr;gap:10px}.governance article{padding:20px;border:1px solid rgba(255,255,255,.07);border-radius:22px;background:rgba(255,255,255,.018)}footer{max-width:1180px;margin:20px auto 0;padding:18px;border-top:1px solid rgba(255,255,255,.06);display:grid;gap:5px}footer b{font-size:7px;letter-spacing:.12em}footer span{font-size:8px;line-height:1.55;color:#6f7c76}
      @media(max-width:900px){.explorerGrid,.marketGrid,.meshyZone{grid-template-columns:1fr}.propertyCard{order:-1}.results{grid-template-columns:1fr}.governance{grid-template-columns:1fr}.capabilityRail{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:680px){.page{padding-left:11px;padding-right:11px}header{height:56px}nav{gap:10px}nav a{font-size:7px}.hero{padding-top:34px}.hero h1{font-size:48px}.search{grid-template-columns:1fr 1fr}.search input{grid-column:1/-1}.search button{min-height:44px}.capabilityRail{grid-template-columns:1fr 1fr}.explorerTop,.sectionHead{display:grid}.viewTabs{width:100%;display:grid;grid-template-columns:repeat(3,1fr)}.viewTabs button{min-height:42px}.visualStage,.voxelStage,.globeStage{min-height:360px;height:50vh}.propertyCard{border-radius:20px}.listing{grid-template-columns:92px 1fr}.photo{height:96px}.governance article{padding:16px}}
    `}</style>
  </main>;
}
