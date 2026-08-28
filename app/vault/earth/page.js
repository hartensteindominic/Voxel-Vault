'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import GeoReferenceModel from '../../geo/GeoReferenceModel';
import GlobalEarthGlobe from './GlobalEarthGlobe';
import MeshyHeroPanel from './MeshyHeroPanel';

const CATEGORIES = [
  ['all', 'All'],
  ['house', 'Houses'],
  ['condo', 'Condos'],
  ['mobile-home', 'Mobile / Trailer'],
  ['multifamily', 'Multifamily'],
  ['storefront', 'Storefronts'],
  ['commercial', 'Commercial'],
  ['warehouse', 'Warehouses'],
  ['barn-farm', 'Barns / Farms'],
  ['land', 'Land'],
];

const QUICK_LOCATIONS = [
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
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 })
        .format(cents / 100) + (property.transactionType === 'rent' ? ' / mo' : '');
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

function categoryLabel(category) {
  return CATEGORIES.find(([id]) => id === category)?.[1] || 'Property';
}

function shortProvider(provider) {
  return String(provider || 'Authorized source').replace(' / authorized MLS', ' MLS');
}

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
  if (atlas.sourceStatus.primary === 'overture-pmtiles') return { label: 'OVERTURE PRIMARY', fallback: false };
  return { label: 'OSM FALLBACK', fallback: true };
}

function listingVisual(item) {
  if (item?.imageUrl) return <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" />;
  return <div className="listingPlaceholder"><span>{categoryLabel(item?.category)}</span><div className="miniBuilding"><i/><i/><i/></div></div>;
}

export default function EarthPropertiesPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [type, setType] = useState('all');
  const [listings, setListings] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [listingMessage, setListingMessage] = useState('Authorized market feeds are checked separately from the world map.');
  const [configured, setConfigured] = useState(null);
  const [listingBusy, setListingBusy] = useState(false);
  const [lastSearch, setLastSearch] = useState(null);
  const [atlas, setAtlas] = useState(null);
  const [atlasBusy, setAtlasBusy] = useState(false);
  const [atlasMessage, setAtlasMessage] = useState('Loading a real starter region…');
  const [selectedAtlasId, setSelectedAtlasId] = useState('');

  const selected = useMemo(() => listings.find((item) => item.id === selectedId) || listings[0] || null, [listings, selectedId]);
  const liveProviders = providers.filter((provider) => provider.configured);
  const atlasBuildings = useMemo(() => Array.isArray(atlas?.buildings) ? atlas.buildings : [], [atlas]);
  const selectedAtlas = useMemo(
    () => atlasBuildings.find((item) => item.atlasId === selectedAtlasId) || atlas?.selectedBuilding || atlasBuildings[0] || null,
    [atlasBuildings, selectedAtlasId, atlas],
  );
  const atlasReference = useMemo(() => atlasReferenceForSelection(atlas, selectedAtlas), [atlas, selectedAtlas]);
  const mode = sourceMode(atlas);

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
    } finally {
      setListingBusy(false);
    }
  }

  async function loadAtlas(params = {}) {
    setAtlasBusy(true);
    setAtlasMessage('Reading the small global building-tile region around this point…');
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
      const source = data?.sourceStatus?.primary === 'overture-pmtiles' ? 'Overture' : 'OpenStreetMap fallback';
      setAtlasMessage(data.buildingCount
        ? `${data.buildingCount} source-backed building${data.buildingCount === 1 ? '' : 's'} loaded from ${source}.`
        : `Location resolved through ${source}, but no building footprint was returned here. Nothing was invented.`);
    } catch (error) {
      setAtlas(null);
      setSelectedAtlasId('');
      setAtlasMessage(String(error?.message || error || 'World atlas lookup failed. Try a quick location or coordinates.'));
    } finally {
      setAtlasBusy(false);
    }
  }

  async function explore(params = {}) {
    setLastSearch(params);
    await Promise.allSettled([loadListings(params), loadAtlas(params)]);
  }

  useEffect(() => {
    loadListings({});
    const starter = QUICK_LOCATIONS[0];
    loadAtlas({ lat: starter.lat, lng: starter.lng });
  }, []);

  function submit(event) {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      setAtlasMessage('Enter a city, country, postcode, address, or latitude/longitude pair.');
      return;
    }
    const coordinates = parseCoordinateQuery(value);
    if (coordinates) {
      explore({ ...coordinates });
      return;
    }
    explore({ query: value, address: value });
  }

  function quickExplore(location) {
    setQuery(location.query);
    explore({ lat: location.lat, lng: location.lng, query: location.query });
  }

  function nearMe() {
    if (!navigator.geolocation) {
      setAtlasMessage('Location services are unavailable in this browser.');
      return;
    }
    setAtlasBusy(true);
    setAtlasMessage('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setQuery(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        explore({ lat, lng });
      },
      (error) => {
        setAtlasBusy(false);
        setAtlasMessage(error.message || 'Location permission was not granted.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  function globeLocation({ latitude, longitude }) {
    const label = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    setQuery(label);
    setAtlasMessage(`Exploring source-backed buildings around ${label}…`);
    explore({ lat: latitude, lng: longitude });
  }

  function chooseCategory(next) {
    setCategory(next);
    loadListings(lastSearch || {}, next, type);
  }

  function chooseType(next) {
    setType(next);
    loadListings(lastSearch || {}, category, next);
  }

  function chooseListing(item) {
    setSelectedId(item.id);
    if (Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))) {
      loadAtlas({ lat: Number(item.latitude), lng: Number(item.longitude) });
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
        type: 'Feature',
        id: building.atlasId,
        geometry: building.geometry,
        properties: {
          atlasId: building.atlasId,
          name: building.tags?.name || null,
          building: building.tags?.building || null,
          levels: building.tags?.levels || null,
          referenceHeightMeters: building.height?.referenceHeightMeters ?? null,
          heightStatus: building.height?.heightStatus || null,
          sourceAuthority: building.source?.authority || null,
          sourceRecordId: building.source?.recordId || null,
          sourceLicense: building.source?.license || null,
          sourceUrl: building.source?.sourceUrl || null,
          mapReferenceOnly: true,
        },
      })),
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `voxel-vault-region-${Number(atlas.latitude).toFixed(4)}-${Number(atlas.longitude).toFixed(4)}.geojson`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  return <main className="page">
    <header>
      <Link className="brand" href="/vault">VOXEL VAULT</Link>
      <nav><Link href="/geo">GEO</Link><Link href="/vault/estates/mine">MY TWINS</Link><Link href="/vault/properties/claim">VERIFY</Link></nav>
    </header>

    <section className="hero">
      <div className="heroCopy">
        <div className="kicker"><i/> VOXEL VAULT WORLD ATLAS</div>
        <h1>Explore the real world.<br/><em>Building by building.</em></h1>
        <p>Search anywhere, tap the globe, or use your location. Voxel Vault reads a small source-backed building region on demand instead of trying to download the whole planet to your phone. Real properties for sale or rent remain a separate authorized market layer.</p>
        <form onSubmit={submit} className="search">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="City, country, postcode or address · or 42.8864, -78.8784" aria-label="Search Earth" />
          <button disabled={atlasBusy || listingBusy}>{atlasBusy ? 'LOADING…' : 'SEARCH EARTH'}</button>
          <button className="near" type="button" onClick={nearMe} disabled={atlasBusy}>NEAR ME</button>
        </form>
        <div className="quickRail">{QUICK_LOCATIONS.map((location) => <button type="button" key={location.id} onClick={() => quickExplore(location)} disabled={atlasBusy}>{location.label}</button>)}</div>
        <div className="statusLine"><span className={mode.fallback ? 'fallback' : 'primary'}>{mode.label}</span><span>{atlasBuildings.length} BUILDINGS LOADED</span><span>{liveProviders.length} LIVE MARKET FEED{liveProviders.length === 1 ? '' : 'S'}</span></div>
      </div>
      <div className="globeCard">
        <GlobalEarthGlobe listings={listings} selectedId={selected?.id || ''} onSelect={setSelectedId} atlasBuildings={atlasBuildings} selectedAtlasId={selectedAtlas?.atlasId || ''} onAtlasSelect={setSelectedAtlasId} onLocation={globeLocation} />
        <div className="globeHint">DRAG · PINCH TO ZOOM · TAP EARTH · PEACH = MAP BUILDING · MINT = LIVE LISTING</div>
      </div>
    </section>

    <section className="atlasSection">
      <div className="sectionHead">
        <div><small>WORLD BUILDING ATLAS</small><h2>Real geometry where you look.</h2><p>{atlasMessage}</p></div>
        <div className="sectionActions"><span className={mode.fallback ? 'sourceBadge fallback' : 'sourceBadge'}>{mode.label}</span><button type="button" onClick={downloadRegion} disabled={!atlasBuildings.length}>DOWNLOAD LOADED REGION · GEOJSON</button></div>
      </div>
      <div className="atlasGrid">
        <div className="atlasVisual">
          {atlasReference?.found
            ? <GeoReferenceModel reference={atlasReference} authoritativeTwin={null} viewMode="orbit" resetKey={selectedAtlas?.atlasId || 'atlas'} />
            : <div className="atlasEmpty"><b>{atlasBusy ? 'READING GLOBAL BUILDING TILES…' : 'NO BUILDING SELECTED'}</b><span>Search or tap a populated point on Earth. Voxel Vault will not invent a footprint when the source returns none.</span></div>}
          {selectedAtlas ? <div className="visualLabel">{atlasBuildingLabel(selectedAtlas)} · {selectedAtlas.source?.authority || 'SOURCE'} · {selectedAtlas.source?.license || 'LICENSE'}</div> : null}
        </div>
        <aside className="atlasInfo">
          <small>SELECTED MAP BUILDING</small>
          <h3>{atlasBuildingLabel(selectedAtlas)}</h3>
          <p>{selectedAtlas ? `${selectedAtlas.latitude.toFixed(5)}, ${selectedAtlas.longitude.toFixed(5)}` : 'Choose a building marker or point on Earth.'}</p>
          <div className="facts">
            <div><b>{selectedAtlas?.tags?.levels || '—'}</b><span>REPORTED FLOORS</span></div>
            <div><b>{selectedAtlas?.height?.referenceHeightMeters ? `${Number(selectedAtlas.height.referenceHeightMeters).toFixed(1)}m` : '—'}</b><span>DISPLAY HEIGHT</span></div>
            <div><b>{atlasBuildings.length || '—'}</b><span>REGION BUILDINGS</span></div>
          </div>
          <div className="sourceCard"><b>{selectedAtlas?.source?.authority || 'Waiting for source'}</b><span>{selectedAtlas?.source?.release ? `Release ${selectedAtlas.source.release} · ` : ''}{selectedAtlas?.source?.license || 'Source license appears after lookup'}</span>{atlas?.sourceStatus?.fallbackUsed ? <em>Primary Overture lookup returned no usable building or was unavailable, so Voxel Vault used its OSM fallback for this region.</em> : <em>Primary global building source. No Overpass request was required for this region.</em>}</div>
          {selectedAtlas?.source?.sourceUrl ? <a className="secondary" href={selectedAtlas.source.sourceUrl} target="_blank" rel="noreferrer">OPEN MAP SOURCE ↗</a> : null}
          <p className="fine"><b>Map truth:</b> this geometry is a world-map reference. It is not automatically a parcel survey, deed, title record, current facade scan, or property-for-sale listing.</p>
        </aside>
      </div>
      <div className="meshyWrap"><div className="meshyCopy"><small>MESHY · THE PERFECT AMOUNT</small><h2>Spend detail only where it matters.</h2><p>Ordinary world browsing uses source geometry and spends zero Meshy credits. A selected hero building can use 2–4 rights-cleared views, 30K target polygons, 2K PBR textures, private caching, and an in-app GLB viewer.</p></div><MeshyHeroPanel building={selectedAtlas} /></div>
    </section>

    <section className="stewardship">
      <div className="stewardCopy"><small>ANTI-MONOPOLY STEWARDSHIP</small><h2>Owning more digital claims should cost more.</h2><p>The planned marginal schedule is <b>linear, not exponential</b>: $1/year base + $0.25 per existing global claim + $0.75 per existing claim in the same local atlas region. A single account is capped at 20 claims per local region and 10,000 globally, with no owner/admin exemption.</p></div>
      <div className="policyCards"><article><b>$1.00</b><span>BASE / YEAR</span></article><article><b>+$0.25</b><span>PER GLOBAL CLAIM</span></article><article><b>+$0.75</b><span>PER SAME-REGION CLAIM</span></article><article><b>20</b><span>LOCAL CLAIM CAP</span></article></div>
      <div className="policyTruth"><b>POLICY MODEL · BILLING DISABLED</b><span>This is a Voxel Vault digital-atlas stewardship mechanic, not a government tax, not a tax on physical property, and not a deed or title fee. Live charging stays disabled until an authoritative server-side claim ledger and reviewed commerce flow exist.</span></div>
    </section>

    <section className="ownershipMap">
      <small>WHO OWNS THE WORLD MAP?</small><h2>Voxel Vault can own the atlas product—not the Earth.</h2>
      <div className="ownershipCards"><article><b>VOXEL VAULT'S PRODUCT</b><span>Software, interface, original scoring, compliant caches, verification workflows, marketplace rules, and generated assets subject to their source licenses.</span></article><article><b>SOURCE DATA STAYS ATTRIBUTED</b><span>Overture, OpenStreetMap, jurisdictions and their upstream sources keep their licenses and notices. Displaying their map data does not make it exclusive Voxel Vault property.</span></article><article><b>REAL PROPERTY STAYS LEGAL PROPERTY</b><span>A digital stewardship claim cannot create a deed, title, tenancy, rent entitlement, government lien, or exclusive physical ownership of a location.</span></article></div>
    </section>

    <section className="marketSection">
      <div className="sectionHead marketHead"><div><small>AUTHORIZED REAL-ESTATE MARKET</small><h2>Map coverage is worldwide.<br/>Listings are not fabricated.</h2><p>{listingMessage}</p></div><div className="marketState"><b>{listings.length}</b><span>LIVE LISTINGS IN VIEW</span></div></div>
      <div className="filters"><div className="typeRail">{[['all', 'Buy + Rent'], ['sale', 'For Sale'], ['rent', 'For Rent']].map(([id, label]) => <button key={id} className={type === id ? 'active' : ''} onClick={() => chooseType(id)}>{label}</button>)}</div><div className="categoryRail">{CATEGORIES.map(([id, label]) => <button key={id} className={category === id ? 'active' : ''} onClick={() => chooseCategory(id)}>{label}</button>)}</div></div>
      <div className="marketGrid">
        <div className="results">
          {listings.length === 0 ? <div className="empty"><b>{configured === false ? 'WORLD MAP READY · MARKET FEED NOT CONNECTED' : listingBusy ? 'CHECKING AUTHORIZED MARKET…' : 'NO LIVE LISTINGS IN THIS VIEW'}</b><span>{configured === false ? 'Mapped buildings still work worldwide. Real market inventory appears only from an authorized listing provider; Voxel Vault does not create sample properties to make this panel look full.' : 'Try another city, tap another place, or change filters.'}</span></div> : listings.map((item) => <button key={item.id} className={selected?.id === item.id ? 'listing active' : 'listing'} onClick={() => chooseListing(item)}><div className="photo">{listingVisual(item)}</div><div className="listingBody"><div className="sourceTag">{shortProvider(item.provider)} · {item.country || 'Earth'}</div><strong>{money(item)}</strong><b>{item.address || 'Address available from source'}</b><small>{[item.city, item.region, item.postalCode].filter(Boolean).join(', ')}</small><div>{item.beds != null ? `${item.beds} bd · ` : ''}{item.baths != null ? `${item.baths} ba · ` : ''}{item.livingAreaSqft ? `${Math.round(item.livingAreaSqft).toLocaleString()} sqft` : categoryLabel(item.category)}</div></div></button>)}
        </div>
        <aside className="detail">
          {selected ? <><div className="detailVisual">{listingVisual(selected)}<span>AUTHORIZED MARKET SOURCE · {selected.country || 'EARTH'}</span></div><div className="detailBody"><div className="source"><i/>{selected.provider} · {selected.status}</div><h2>{selected.address || 'Real Earth property'}</h2><p>{[selected.city, selected.region, selected.postalCode, selected.country].filter(Boolean).join(', ')}</p><div className="price"><span>{selected.marketValueLabel}</span><strong>{money(selected)}</strong><small>{selected.modifiedAt ? `Source updated ${new Date(selected.modifiedAt).toLocaleDateString()}` : 'Verify latest availability at source'}</small></div><div className="listingFacts"><div><b>{selected.beds ?? '—'}</b><span>BEDS</span></div><div><b>{selected.baths ?? '—'}</b><span>BATHS</span></div><div><b>{selected.livingAreaSqft ? Math.round(selected.livingAreaSqft).toLocaleString() : '—'}</b><span>SQ FT</span></div></div><a className="primaryButton" href={selected.sourceUrl || safeMapUrl(selected)} target="_blank" rel="noreferrer">{selected.sourceUrl ? 'OPEN REAL SOURCE LISTING' : 'OPEN EARTH LOCATION'} ↗</a><Link className="secondary" href="/vault/properties/claim">VERIFY OWNER · CREATE PROPERTY PASSPORT</Link><p className="fine"><b>Legal boundary:</b> a Voxel Vault digital twin does not replace the deed. Real-property purchase still requires the normal contract, title, closing and recording process.</p></div></> : <div className="detailEmpty"><b>MAP ≠ MARKET INVENTORY</b><span>The world atlas can show a mapped building without claiming it is for sale. Connect an authorized listing feed to populate this panel.</span></div>}
        </aside>
      </div>
    </section>

    <footer><b>GLOBAL VALUE + MAP TRUTH</b><span>Physical-market value and digital twin resale value remain separate. Map geometry, market listings, digital stewardship, and legal ownership are separate evidence/rights layers; none guarantees appreciation or income.</span></footer>

    <style jsx>{`
      :global(body){margin:0;background:#07100f;color:#f4f7f6;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:0 clamp(14px,3vw,40px) 92px;background:radial-gradient(circle at 78% 5%,rgba(101,77,214,.14),transparent 24%),radial-gradient(circle at 18% 18%,rgba(71,201,153,.08),transparent 25%),#07100f}.page *{box-sizing:border-box}header{height:64px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.07)}.brand{font-size:10px;letter-spacing:.16em;font-weight:950;color:#fff;text-decoration:none}nav{display:flex;gap:7px}nav a{font-size:7px;font-weight:900;color:#8e9a95;text-decoration:none;border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:9px 11px}.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(390px,.78fr);gap:24px;padding:38px 0 28px;align-items:stretch}.heroCopy{padding:20px 0}.kicker{font-size:8px;letter-spacing:.17em;font-weight:950;color:#91a09a}.kicker i,.source i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#79efbc;margin-right:8px;box-shadow:0 0 16px #79efbc}.hero h1{font-size:clamp(52px,7vw,94px);letter-spacing:-.07em;line-height:.87;margin:16px 0 19px}.hero h1 em{font-style:normal;color:#75817c}.hero p{max-width:760px;color:#8c9994;font-size:13px;line-height:1.72}.search{display:grid;grid-template-columns:1fr auto auto;gap:7px;margin-top:23px}.search input{min-width:0;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.045);color:#fff;border-radius:15px;padding:15px 16px;font:inherit;font-size:11px;outline:none}.search input::placeholder{color:#63706b}.search button,.sectionActions button{border:0;border-radius:14px;padding:0 15px;background:#eef6f3;color:#07100f;font-size:7px;font-weight:950;letter-spacing:.08em}.search .near{background:rgba(121,239,188,.09);border:1px solid rgba(121,239,188,.18);color:#8df2d0}.search button:disabled,.quickRail button:disabled,.sectionActions button:disabled{opacity:.45}.quickRail{display:flex;gap:6px;overflow:auto;padding:10px 1px 2px}.quickRail button{flex:0 0 auto;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);color:#8f9a96;border-radius:999px;padding:8px 10px;font-size:7px;font-weight:900}.statusLine{display:flex;flex-wrap:wrap;gap:16px;margin-top:11px}.statusLine span{font-size:7px;color:#74817c;letter-spacing:.11em;font-weight:900}.statusLine .primary{color:#79efbc}.statusLine .fallback{color:#efb08f}.globeCard{position:relative;min-height:460px;border:1px solid rgba(255,255,255,.08);border-radius:30px;overflow:hidden;background:radial-gradient(circle at 50% 45%,rgba(42,91,72,.26),transparent 45%),linear-gradient(150deg,#0d1614,#070c0d)}.globeHint{position:absolute;left:14px;right:14px;bottom:13px;z-index:4;text-align:center;font-size:6px;color:#80908a;letter-spacing:.1em;font-weight:900;background:rgba(5,10,9,.66);border:1px solid rgba(255,255,255,.07);padding:8px;border-radius:999px;pointer-events:none}.atlasSection,.marketSection,.stewardship,.ownershipMap{border-top:1px solid rgba(255,255,255,.07);padding:34px 0}.sectionHead{display:flex;justify-content:space-between;gap:25px;align-items:flex-end;margin-bottom:18px}.sectionHead small,.atlasInfo>small,.meshyCopy small,.stewardCopy small,.ownershipMap>small{font-size:7px;color:#7be5bd;letter-spacing:.15em;font-weight:950}.sectionHead h2,.meshyCopy h2,.stewardCopy h2,.ownershipMap h2{font-size:clamp(30px,4vw,52px);letter-spacing:-.055em;line-height:.95;margin:7px 0 10px}.sectionHead p,.meshyCopy p,.stewardCopy p{max-width:720px;margin:0;color:#82908a;font-size:11px;line-height:1.65}.sectionActions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.sectionActions button{min-height:38px}.sourceBadge{border:1px solid rgba(121,239,188,.18);background:rgba(121,239,188,.07);color:#80e7c0;border-radius:999px;padding:10px;font-size:7px;font-weight:950;letter-spacing:.1em}.sourceBadge.fallback{border-color:rgba(239,176,143,.2);background:rgba(239,176,143,.06);color:#efb08f}.atlasGrid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,.55fr);border:1px solid rgba(255,255,255,.08);border-radius:28px;overflow:hidden;background:rgba(255,255,255,.018)}.atlasVisual{position:relative;min-height:550px;background:#080f0e;border-right:1px solid rgba(255,255,255,.07)}.atlasEmpty{position:absolute;inset:0;display:grid;place-content:center;text-align:center;gap:8px;padding:30px}.atlasEmpty b{font-size:9px;letter-spacing:.13em}.atlasEmpty span{max-width:400px;color:#6f7b77;font-size:10px;line-height:1.6}.visualLabel{position:absolute;left:13px;right:13px;bottom:12px;z-index:4;padding:9px 11px;background:rgba(5,10,9,.7);border:1px solid rgba(255,255,255,.08);border-radius:999px;text-align:center;color:#82908b;font-size:6px;font-weight:900;letter-spacing:.08em;pointer-events:none}.atlasInfo{padding:24px;display:flex;flex-direction:column;gap:11px}.atlasInfo h3{font-size:28px;letter-spacing:-.045em;margin:0}.atlasInfo>p{color:#78857f;font-size:10px;margin:0}.facts,.listingFacts{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.facts div,.listingFacts div{border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025);border-radius:14px;padding:11px}.facts b,.listingFacts b{display:block;font-size:15px}.facts span,.listingFacts span{display:block;margin-top:3px;color:#65716c;font-size:6px;letter-spacing:.09em;font-weight:900}.sourceCard{border:1px solid rgba(255,255,255,.07);border-radius:15px;padding:12px;background:rgba(255,255,255,.022)}.sourceCard b,.sourceCard span,.sourceCard em{display:block}.sourceCard b{font-size:9px}.sourceCard span{font-size:7px;color:#81908a;margin-top:4px}.sourceCard em{font-style:normal;color:#65716d;font-size:7px;line-height:1.5;margin-top:8px}.secondary{display:flex;align-items:center;justify-content:center;min-height:40px;border:1px solid rgba(255,255,255,.09);color:#a4b0ab;text-decoration:none;border-radius:13px;font-size:7px;font-weight:950;letter-spacing:.09em}.fine{color:#697570!important;font-size:8px!important;line-height:1.6!important}.meshyWrap{display:grid;grid-template-columns:minmax(220px,.36fr) minmax(0,.64fr);gap:18px;margin-top:18px;align-items:start}.meshyCopy{padding:18px 0}.stewardship{display:grid;grid-template-columns:minmax(0,.8fr) minmax(360px,1.2fr);gap:26px;align-items:center}.policyCards{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.policyCards article{border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px;background:rgba(255,255,255,.025)}.policyCards b{display:block;font-size:20px}.policyCards span{display:block;color:#68756f;font-size:6px;letter-spacing:.1em;margin-top:5px;font-weight:900}.policyTruth{grid-column:1/-1;border:1px solid rgba(239,176,143,.15);background:rgba(239,176,143,.035);border-radius:15px;padding:12px 14px;display:flex;gap:14px;align-items:center}.policyTruth b{white-space:nowrap;color:#e7af91;font-size:7px;letter-spacing:.1em}.policyTruth span{color:#78847f;font-size:8px;line-height:1.55}.ownershipCards{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:18px}.ownershipCards article{border:1px solid rgba(255,255,255,.07);border-radius:18px;padding:16px;background:rgba(255,255,255,.018)}.ownershipCards b{font-size:8px;letter-spacing:.1em}.ownershipCards span{display:block;color:#73807a;font-size:9px;line-height:1.6;margin-top:7px}.marketHead{align-items:center}.marketState{border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:12px 15px;text-align:right;background:rgba(255,255,255,.02)}.marketState b{display:block;font-size:24px}.marketState span{display:block;color:#68746f;font-size:6px;letter-spacing:.1em}.filters{display:grid;gap:8px;margin-bottom:13px}.typeRail,.categoryRail{display:flex;gap:6px;overflow:auto;padding-bottom:1px}.filters button{flex:0 0 auto;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);color:#7f8c86;border-radius:999px;padding:9px 11px;font-size:7px;font-weight:900}.filters button.active{background:#eff6f3;color:#07100f;border-color:#eff6f3}.marketGrid{display:grid;grid-template-columns:minmax(320px,.8fr) minmax(0,1.2fr);gap:13px}.results{display:grid;align-content:start;gap:8px}.empty,.detailEmpty{border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:26px;display:grid;gap:8px;background:rgba(255,255,255,.018)}.empty b,.detailEmpty b{font-size:9px;letter-spacing:.12em}.empty span,.detailEmpty span{color:#74807b;font-size:10px;line-height:1.6}.listing{display:grid;grid-template-columns:135px 1fr;text-align:left;padding:0;border:1px solid rgba(255,255,255,.07);border-radius:18px;overflow:hidden;background:rgba(255,255,255,.018);color:#fff}.listing.active{border-color:rgba(121,239,188,.32);background:rgba(121,239,188,.035)}.photo{min-height:130px;background:#101816;overflow:hidden}.photo>img,.detailVisual>img{width:100%;height:100%;object-fit:cover;display:block}.listingPlaceholder{height:100%;min-height:130px;position:relative;display:grid;place-items:center;background:radial-gradient(circle at 50% 45%,rgba(121,239,188,.1),transparent 36%),#0b1210}.listingPlaceholder>span{position:absolute;top:10px;left:10px;color:#65736d;font-size:6px;font-weight:900;letter-spacing:.08em}.miniBuilding{width:58%;height:44%;background:#b5b8ad;position:relative;border-radius:2px;box-shadow:0 14px 30px rgba(0,0,0,.28)}.miniBuilding:before{content:'';position:absolute;left:-7%;right:-7%;top:-12%;height:14%;background:#3a403e}.miniBuilding i{position:absolute;bottom:18%;width:16%;height:30%;background:#6b9c9a}.miniBuilding i:nth-child(1){left:12%}.miniBuilding i:nth-child(2){left:42%}.miniBuilding i:nth-child(3){right:12%}.listingBody{padding:13px;min-width:0}.sourceTag{font-size:6px;color:#69cfa9;letter-spacing:.09em;font-weight:900}.listingBody strong{display:block;font-size:21px;letter-spacing:-.035em;margin:5px 0}.listingBody b,.listingBody small,.listingBody>div:last-child{display:block}.listingBody b{font-size:10px}.listingBody small,.listingBody>div:last-child{color:#707d77;font-size:8px;margin-top:3px}.detail{border:1px solid rgba(255,255,255,.08);border-radius:24px;overflow:hidden;background:rgba(255,255,255,.018);align-self:start}.detailVisual{height:300px;position:relative;background:#0b1210;overflow:hidden}.detailVisual>.listingPlaceholder{min-height:300px}.detailVisual>span{position:absolute;left:12px;right:12px;bottom:11px;text-align:center;background:rgba(5,10,9,.7);border:1px solid rgba(255,255,255,.08);padding:8px;border-radius:999px;color:#84918c;font-size:6px;letter-spacing:.08em;font-weight:900}.detailBody{padding:20px}.source{color:#74deb5;font-size:7px;font-weight:900;letter-spacing:.09em}.detailBody h2{font-size:32px;letter-spacing:-.045em;margin:8px 0 4px}.detailBody>p{color:#75817c;font-size:9px}.price{display:grid;gap:2px;margin:18px 0}.price span,.price small{color:#6f7b76;font-size:7px}.price strong{font-size:38px;letter-spacing:-.05em}.primaryButton{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:14px;background:#edf5f2;color:#07100f;text-decoration:none;font-size:8px;font-weight:950;letter-spacing:.09em;margin:13px 0 7px}footer{border-top:1px solid rgba(255,255,255,.07);padding:22px 0;color:#6d7974;display:flex;gap:16px;align-items:flex-start;font-size:8px;line-height:1.6}footer b{color:#96a39d;white-space:nowrap;letter-spacing:.12em;font-size:7px}@media(max-width:980px){.hero{grid-template-columns:1fr}.globeCard{min-height:420px}.atlasGrid,.marketGrid{grid-template-columns:1fr}.atlasVisual{border-right:0;border-bottom:1px solid rgba(255,255,255,.07);min-height:490px}.meshyWrap{grid-template-columns:1fr}.stewardship{grid-template-columns:1fr}.ownershipCards{grid-template-columns:1fr}.policyCards{grid-template-columns:repeat(2,1fr)}}@media(max-width:640px){.page{padding:0 13px 78px}header{height:56px}nav a{padding:8px 9px}.hero{padding-top:22px;gap:14px}.heroCopy{padding-top:7px}.hero h1{font-size:52px}.hero p{font-size:11px}.search{grid-template-columns:1fr 1fr}.search input{grid-column:1/-1}.search button{min-height:43px}.globeCard{min-height:390px;border-radius:23px}.globeHint{font-size:5.5px}.sectionHead{display:grid;align-items:start}.sectionActions{justify-content:flex-start}.atlasVisual{min-height:430px}.atlasInfo{padding:17px}.meshyCopy{padding-bottom:0}.policyTruth{display:grid}.policyCards{grid-template-columns:1fr 1fr}.marketGrid{grid-template-columns:1fr}.listing{grid-template-columns:112px 1fr}.photo{min-height:118px}.detailVisual{height:245px}.detailVisual>.listingPlaceholder{min-height:245px}.ownershipMap h2,.sectionHead h2,.meshyCopy h2,.stewardCopy h2{font-size:38px}footer{display:grid}}
    `}</style>
  </main>;
}