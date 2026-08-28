'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import BuffaloCalibratedReferenceModel from '../../geo/BuffaloCalibratedReferenceModel';
import GeoReferenceModel from '../../geo/GeoReferenceModel';
import GlobalEarthGlobe from './GlobalEarthGlobe';
import GoogleRealityMap from './GoogleRealityMap';
import MeshyHeroPanel from './MeshyHeroPanel';
import PropertyEvidencePanel from './PropertyEvidencePanel';
import PropertyTruthStack from './PropertyTruthStack';
import styles from './earth-experience.module.css';
import extra from './earth-experience-extra.module.css';

const GOOGLE_3D_ENABLED = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY);

const CATEGORIES = [
  ['all', 'All'], ['house', 'Houses'], ['condo', 'Condos'], ['mobile-home', 'Mobile'],
  ['multifamily', 'Multifamily'], ['storefront', 'Storefronts'], ['commercial', 'Commercial'],
  ['warehouse', 'Warehouses'], ['barn-farm', 'Farms'], ['land', 'Land'],
];

const QUICK_LOCATIONS = [
  { id: 'kensington', label: '1047 Kensington', query: '1047 Kensington Ave, Buffalo, NY 14215', authoritative: { type: 'buffalo-parcel', sbl: '90.32-8-4', pin: '1402000903200008004000' } },
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

function categoryLabel(category) {
  return CATEGORIES.find(([id]) => id === category)?.[1] || 'Property';
}

function parseCoordinateQuery(value) {
  const match = String(value || '').trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
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
    matchStrategy: selected.source?.authority?.includes('Erie County') ? 'erie_county_parcel_linked_building' : 'world_atlas_selected_building',
    source: selected.source || atlas.reference.source,
    neighborhoodBuildings: (atlas.buildings || []).map((building) => ({
      id: building.atlasId,
      selected: building.atlasId === selected.atlasId,
      distanceMeters: building.distanceMeters,
      center: { latitude: building.latitude, longitude: building.longitude },
      geometry: building.geometry,
      tags: building.tags || {},
      height: building.height || null,
      sourceUrl: building.source?.sourceUrl || '',
    })),
  };
}

function sourceMode(atlas) {
  if (atlas?.sourceStatus?.authoritativeLocal) return { label: 'ERIE LOCAL AUTHORITY', fallback: false };
  if (!atlas?.sourceStatus) return { label: 'WAITING FOR REGION', fallback: false };
  if (atlas.sourceStatus.primary === 'overture-pmtiles' && !atlas.sourceStatus.fallbackUsed) return { label: 'OVERTURE PRIMARY', fallback: false };
  return { label: 'OSM FALLBACK', fallback: true };
}

function capabilityLabel(capabilities, key) {
  if (!capabilities) return 'CHECKING';
  return capabilities?.[key]?.configured ? 'READY' : 'NOT CONNECTED';
}

export default function EarthPropertiesPage() {
  const starter = QUICK_LOCATIONS[0];
  const [query, setQuery] = useState(starter.query);
  const [focus, setFocus] = useState({ lat: null, lng: null, label: starter.query, resolved: false, authority: null });
  const [view, setView] = useState(GOOGLE_3D_ENABLED ? 'compare' : 'voxel');
  const [category, setCategory] = useState('all');
  const [type, setType] = useState('all');
  const [listings, setListings] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [listingMessage, setListingMessage] = useState('Listings are not fabricated. Authorized market feeds are checked separately from the map.');
  const [configured, setConfigured] = useState(null);
  const [listingBusy, setListingBusy] = useState(false);
  const [lastSearch, setLastSearch] = useState({ query: starter.query });
  const [atlas, setAtlas] = useState(null);
  const [atlasBusy, setAtlasBusy] = useState(false);
  const [atlasMessage, setAtlasMessage] = useState('Resolving 1047 Kensington from City + County property sources…');
  const [selectedAtlasId, setSelectedAtlasId] = useState('');
  const [capabilities, setCapabilities] = useState(null);
  const [authoritativeEvidence, setAuthoritativeEvidence] = useState(null);
  const [buffaloReference, setBuffaloReference] = useState(null);
  const [resetKey, setResetKey] = useState(0);

  const selected = useMemo(() => listings.find((item) => item.id === selectedId) || null, [listings, selectedId]);
  const liveProviders = providers.filter((provider) => provider.configured);
  const atlasBuildings = useMemo(() => Array.isArray(atlas?.buildings) ? atlas.buildings : [], [atlas]);
  const selectedAtlas = useMemo(
    () => atlasBuildings.find((item) => item.atlasId === selectedAtlasId) || atlas?.selectedBuilding || atlasBuildings[0] || null,
    [atlasBuildings, selectedAtlasId, atlas],
  );
  const atlasReference = useMemo(() => atlasReferenceForSelection(atlas, selectedAtlas), [atlas, selectedAtlas]);
  const mode = sourceMode(atlas);
  const visualLat = Number.isFinite(Number(selectedAtlas?.latitude)) ? Number(selectedAtlas.latitude) : (focus.resolved ? Number(focus.lat) : NaN);
  const visualLng = Number.isFinite(Number(selectedAtlas?.longitude)) ? Number(selectedAtlas.longitude) : (focus.resolved ? Number(focus.lng) : NaN);
  const visualReady = Number.isFinite(visualLat) && Number.isFinite(visualLng);
  const visualLabel = selected ? addressLine(selected) : (selectedAtlas ? atlasBuildingLabel(selectedAtlas) : focus.label);
  const hasAuthoritativeBuilding = Boolean(authoritativeEvidence?.twin?.structure?.buildingGeometry);

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
      setSelectedId('');
      setListingMessage(data.message || 'Market search complete.');
    } catch (error) {
      setListings([]);
      setSelectedId('');
      setListingMessage(String(error?.message || error || 'Market search failed. Reality and map exploration remain available.'));
    } finally {
      setListingBusy(false);
    }
  }

  async function loadAtlas(params = {}) {
    setAtlasBusy(true);
    setAtlasMessage(params?.address ? `Resolving ${params.address}…` : 'Reading a bounded source-backed building region…');
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
        setFocus((current) => ({ ...current, lat: Number(data.latitude), lng: Number(data.longitude), resolved: true }));
      }
      const source = data?.sourceStatus?.fallbackUsed ? 'OpenStreetMap fallback' : 'Overture';
      setAtlasMessage(data.buildingCount
        ? `${data.buildingCount} source-backed building${data.buildingCount === 1 ? '' : 's'} loaded from ${source}.`
        : `The location resolved, but those global map sources returned no building footprint here. Nothing was invented.`);
      setResetKey((value) => value + 1);
    } catch (error) {
      setAtlas(null);
      setSelectedAtlasId('');
      setAtlasMessage(`${String(error?.message || error || 'World atlas lookup failed.')} Google/source links and authorized market search remain usable.`);
    } finally {
      setAtlasBusy(false);
    }
  }

  async function explore(params = {}) {
    setAuthoritativeEvidence(null);
    setBuffaloReference(null);
    setLastSearch(params);
    if (Number.isFinite(params?.lat) && Number.isFinite(params?.lng)) {
      setFocus({ lat: Number(params.lat), lng: Number(params.lng), label: params.query || `${params.lat}, ${params.lng}`, resolved: true, authority: params.authority || null });
    } else {
      setFocus({ lat: null, lng: null, label: params.address || params.query || 'Selected Earth location', resolved: false, authority: null });
    }
    await Promise.allSettled([loadListings(params), loadAtlas(params)]);
  }

  async function exploreAuthoritative(location) {
    const authoritative = location?.authoritative;
    if (authoritative?.type !== 'buffalo-parcel') return explore({ query: location.query, address: location.query });
    setAtlasBusy(true);
    setLastSearch({ query: location.query });
    setAtlasMessage(`Resolving ${location.label} from City parcel ${authoritative.sbl} + Erie County GIS…`);
    try {
      const response = await fetch('/api/world-atlas/property-anchor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...authoritative, address: location.query, radiusMeters: 180 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Authoritative property anchor failed.');
      const lat = Number(data?.anchor?.latitude);
      const lng = Number(data?.anchor?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Authoritative property sources did not return usable coordinates.');

      setAuthoritativeEvidence(data.authoritativeEvidence || null);
      setBuffaloReference(data.cityReference || null);
      setAtlas(data.atlas || null);
      setSelectedAtlasId(data.atlas?.selectedBuilding?.atlasId || data.atlas?.buildings?.[0]?.atlasId || '');
      setFocus({ lat, lng, label: location.query, resolved: true, authority: data.anchor?.authority || 'Buffalo / Erie jurisdiction GIS' });
      setResetKey((value) => value + 1);
      setAtlasMessage(data.localBuildingStatus === 'parcel_linked_building'
        ? `1047 is anchored to the City parcel and a parcel-linked Erie County BUILDING footprint. ${data.atlas?.buildingCount || 1} building${Number(data.atlas?.buildingCount || 1) === 1 ? '' : 's'} available with neighborhood context.`
        : `1047 is anchored to the authoritative parcel location. No exact county BUILDING footprint is attached yet, so Reality remains the visual reference instead of inventing architecture.`);
      await loadListings({ lat, lng, query: location.query });
    } catch (error) {
      setAuthoritativeEvidence(null);
      setBuffaloReference(null);
      setAtlasMessage(`${String(error?.message || error)} Falling back to exact-address geocoding; no coordinate is guessed.`);
      await explore({ query: location.query, address: location.query });
    } finally {
      setAtlasBusy(false);
    }
  }

  useEffect(() => {
    loadCapabilities();
    exploreAuthoritative(starter);
  }, []);

  function submit(event) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    const coordinates = parseCoordinateQuery(value);
    if (coordinates) return explore({ ...coordinates, query: value });
    const known = QUICK_LOCATIONS.find((item) => item.authoritative && item.query.toLowerCase() === value.toLowerCase());
    if (known) return exploreAuthoritative(known);
    return explore({ query: value, address: value });
  }

  function quickExplore(location) {
    setQuery(location.query);
    if (location.authoritative) return exploreAuthoritative(location);
    return explore({ lat: location.lat, lng: location.lng, query: location.query });
  }

  function nearMe() {
    if (!navigator.geolocation) {
      setAtlasMessage('Location services are unavailable in this browser.');
      return;
    }
    setAtlasBusy(true);
    setAtlasMessage('Getting your location…');
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setQuery(label);
      explore({ lat, lng, query: label });
    }, (error) => {
      setAtlasBusy(false);
      setAtlasMessage(error.message || 'Location permission was not granted.');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  function globeLocation({ latitude, longitude }) {
    const label = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    setQuery(label);
    explore({ lat: latitude, lng: longitude, query: label });
  }

  function chooseListing(item) {
    setSelectedId(item.id);
    if (Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))) {
      const lat = Number(item.latitude);
      const lng = Number(item.longitude);
      setFocus({ lat, lng, label: addressLine(item) || 'Selected listing', resolved: true, authority: item.provider || null });
      setAuthoritativeEvidence(null);
      setBuffaloReference(null);
      loadAtlas({ lat, lng, query: addressLine(item) });
    }
  }

  function chooseAtlas(atlasId) {
    setSelectedAtlasId(atlasId);
    setResetKey((value) => value + 1);
  }

  function chooseCategory(next) {
    setCategory(next);
    loadListings(lastSearch || {}, next, type);
  }

  function chooseType(next) {
    setType(next);
    loadListings(lastSearch || {}, category, next);
  }

  function downloadRegion() {
    if (!atlasBuildings.length || !visualReady) return;
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
    const href = URL.createObjectURL(new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' }));
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `voxel-vault-region-${visualLat.toFixed(4)}-${visualLng.toFixed(4)}.geojson`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  function voxelStage(compactLabel = false) {
    if (hasAuthoritativeBuilding) {
      return <div className={styles.stageCard}>
        <BuffaloCalibratedReferenceModel
          reference={atlasReference}
          authoritativeTwin={authoritativeEvidence?.twin || null}
          buffaloReference={buffaloReference}
          addressLabel={focus.label}
          viewMode="orbit"
          resetKey={resetKey}
        />
        {compactLabel ? <span className={styles.paneLabel}>SOURCE + LOCAL AUTHORITY</span> : null}
      </div>;
    }
    if (atlasReference?.found) {
      return <div className={styles.stageCard}>
        <GeoReferenceModel reference={atlasReference} authoritativeTwin={null} viewMode="orbit" resetKey={resetKey} />
        {compactLabel ? <span className={styles.paneLabel}>SOURCE-BACKED VOXEL</span> : null}
      </div>;
    }
    return <div className={`${styles.stageCard} ${styles.stageEmpty}`}>
      <b>{atlasBusy ? 'RESOLVING PROPERTY EVIDENCE…' : 'NO VERIFIED BUILDING FOOTPRINT'}</b>
      <span>The location can still be inspected in Reality and external evidence sources. Voxel Vault will not invent a house just to fill this panel.</span>
    </div>;
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link className={styles.brand} href="/vault">VOXEL VAULT</Link>
      <nav className={styles.nav}><Link href="/geo">GEO</Link><Link href="/vault/estates/mine">MY TWINS</Link><Link href="/vault/properties/claim">VERIFY</Link></nav>
    </header>

    <section className={styles.hero}>
      <div className={styles.eyebrow}><i className={styles.pulse}/> VOXEL VAULT WORLD ATLAS</div>
      <h1>See the real world.<br/><em>Then build its twin.</em></h1>
      <p className={styles.heroText}>One address, synchronized across live Reality, source-backed Voxel geometry, the world Globe, visual evidence and selective Meshy 7 reconstruction. The system prefers jurisdiction evidence where available and fails visibly instead of inventing architecture.</p>
      <form className={styles.search} onSubmit={submit}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Address, city, postcode · or latitude, longitude" aria-label="Search Earth" />
        <button disabled={atlasBusy || listingBusy}>{atlasBusy ? 'RESOLVING…' : 'EXPLORE'}</button>
        <button type="button" onClick={nearMe} disabled={atlasBusy}>NEAR ME</button>
      </form>
      <div className={styles.quick}>{QUICK_LOCATIONS.map((location) => <button type="button" key={location.id} onClick={() => quickExplore(location)} disabled={atlasBusy}>{location.label}</button>)}</div>
      <div className={styles.capabilities}>
        <div className={styles.capability}><b>WORLD DATA</b><span>{capabilityLabel(capabilities, 'worldAtlas')}</span></div>
        <div className={styles.capability}><b>GOOGLE 3D</b><span>{capabilityLabel(capabilities, 'googleReality')}</span></div>
        <div className={styles.capability}><b>MESHY 7</b><span>{capabilityLabel(capabilities, 'meshy')}</span></div>
        <div className={styles.capability}><b>MARKET</b><span>{liveProviders.length ? `${liveProviders.length} LIVE` : 'AWAITING ACCESS'}</span></div>
      </div>
    </section>

    <section className={styles.shell}>
      <div className={styles.topbar}>
        <div className={styles.title}><small>WORLD BUILDING ATLAS</small><h2>{visualLabel || 'Selected Earth location'}</h2><p>{atlasMessage}</p></div>
        <div className={styles.tabs} role="group" aria-label="Property visualization mode">
          <button className={view === 'compare' ? styles.active : ''} onClick={() => setView('compare')}>COMPARE</button>
          <button className={view === 'reality' ? styles.active : ''} onClick={() => setView('reality')}>REALITY</button>
          <button className={view === 'voxel' ? styles.active : ''} onClick={() => setView('voxel')}>VOXEL</button>
          <button className={view === 'globe' ? styles.active : ''} onClick={() => setView('globe')}>GLOBE</button>
        </div>
      </div>

      <div className={styles.atlasGrid}>
        <div className={styles.stage}>
          {view === 'compare' ? <div className={styles.compare}>
            <div className={styles.comparePane}><GoogleRealityMap latitude={visualReady ? visualLat : null} longitude={visualReady ? visualLng : null} label={visualLabel} active /><span className={styles.paneLabel}>GOOGLE LIVE REALITY</span></div>
            <div className={styles.comparePane}>{voxelStage(true)}</div>
          </div> : null}
          {view === 'reality' ? <GoogleRealityMap latitude={visualReady ? visualLat : null} longitude={visualReady ? visualLng : null} label={visualLabel} active /> : null}
          {view === 'voxel' ? voxelStage(false) : null}
          {view === 'globe' ? <div className={`${styles.stageCard} ${styles.globeWrap}`}>
            <GlobalEarthGlobe listings={listings} selectedId={selected?.id || ''} onSelect={setSelectedId} atlasBuildings={atlasBuildings} selectedAtlasId={selectedAtlas?.atlasId || ''} onAtlasSelect={chooseAtlas} onLocation={globeLocation} />
            <div className={styles.globeHint}>DRAG · PINCH · TAP EARTH · PEACH = MAP · MINT = LISTING</div>
          </div> : null}
        </div>

        <aside className={styles.side}>
          <div className={styles.badgeRow}>
            <span className={styles.badge}>{mode.label}</span>
            <span className={styles.badge}>{atlasBuildings.length} BUILDINGS</span>
            {focus.authority ? <span className={styles.badge}>{focus.authority}</span> : null}
            {atlas?.sourceStatus?.fallbackUsed ? <span className={`${styles.badge} ${styles.badgeWarm}`}>FALLBACK USED</span> : null}
          </div>
          <small>SELECTED PLACE</small>
          <h3>{selectedAtlas ? atlasBuildingLabel(selectedAtlas) : focus.label}</h3>
          <p className={styles.coord}>{visualReady ? `${visualLat.toFixed(6)}, ${visualLng.toFixed(6)}` : 'RESOLVING EXACT LOCATION'}</p>
          <div className={styles.facts}>
            <div className={styles.fact}><b>{buffaloReference?.stories || selectedAtlas?.tags?.levels || '—'}</b><span>FLOORS</span></div>
            <div className={styles.fact}><b>{buffaloReference?.totalLivingAreaSqFt ? `${Math.round(buffaloReference.totalLivingAreaSqFt).toLocaleString()} ft²` : '—'}</b><span>CITY AREA REF</span></div>
            <div className={styles.fact}><b>{selectedAtlas?.height?.referenceHeightMeters ? `${Number(selectedAtlas.height.referenceHeightMeters).toFixed(1)}m` : '—'}</b><span>DISPLAY HEIGHT</span></div>
            <div className={styles.fact}><b>{authoritativeEvidence?.countyRecord?.buildingMatchStrategy || selectedAtlas?.source?.license || '—'}</b><span>GEOMETRY STATUS</span></div>
          </div>
          <div className={styles.sourceNote}><b>FAIL-SAFE PROPERTY TRUTH</b><span>Reality imagery, map geometry, assessment characteristics, listing photos, AI models, legal title and investment rights are separate evidence layers. Missing layers stay missing. MINTING RECOMMENDED AFTER VERIFICATION; minting never upgrades title.</span></div>
          <button className={styles.download} type="button" onClick={downloadRegion} disabled={!atlasBuildings.length || !visualReady}>DOWNLOAD LOADED REGION · GEOJSON</button>
          {selectedAtlas?.source?.sourceUrl ? <a className={styles.sourceLink} href={selectedAtlas.source.sourceUrl} target="_blank" rel="noreferrer">OPEN MAP SOURCE ↗</a> : null}
          <Link className={styles.sourceLink} href="/vault/properties/claim">VERIFY OWNER · CREATE PROPERTY PASSPORT</Link>
        </aside>
      </div>

      <PropertyTruthStack
        building={selectedAtlas}
        authoritativeEvidence={authoritativeEvidence}
        buffaloReference={buffaloReference}
        listing={selected}
        googleConfigured={Boolean(capabilities?.googleReality?.configured)}
        meshyConfigured={Boolean(capabilities?.meshy?.configured)}
        focusAuthority={focus.authority || ''}
      />

      <PropertyEvidencePanel listing={selected} building={selectedAtlas} fallbackLabel={focus.label}/>

      <div className={styles.meshZone}>
        <div className={styles.meshCopy}><small>MESHY · THE PERFECT AMOUNT</small><h2>Spend AI detail only where evidence earns it.</h2><p>Normal Earth browsing spends zero Meshy credits. Meshy 7 is reserved for a selected hero property with 2–4 user-owned, open-licensed or explicitly derivative-licensed views. Google/Zillow/Redfin remain visual reference surfaces unless separate rights permit reconstruction.</p></div>
        <MeshyHeroPanel building={selectedAtlas} listing={selected}/>
      </div>
    </section>

    <section className={styles.market}>
      <div className={styles.marketHead}><div><small>AUTHORIZED REAL-ESTATE MARKET</small><h2>Listings are not fabricated.</h2><p>{listingMessage}</p></div><div className={styles.marketCount}><b>{listings.length}</b><span>LIVE RESULTS</span></div></div>
      <div className={styles.providerBar}><b>LIVE COVERAGE</b><span>{liveProviders.length ? liveProviders.map((provider) => provider.name).join(' · ') : 'No licensed listing feed is connected on this deployment.'}</span><b>MAP COVERAGE</b><span>World exploration remains independent from market inventory.</span></div>
      <div className={extra.filters}>
        <div>{[['all','Buy + Rent'],['sale','For Sale'],['rent','For Rent']].map(([id,label]) => <button key={id} className={type === id ? extra.activeFilter : ''} onClick={() => chooseType(id)}>{label}</button>)}</div>
        <div>{CATEGORIES.map(([id,label]) => <button key={id} className={category === id ? extra.activeFilter : ''} onClick={() => chooseCategory(id)}>{label}</button>)}</div>
      </div>
      <div className={styles.marketGrid}>
        {listings.length === 0 ? <div className={styles.emptyMarket}><b>{configured === false ? 'MAP READY · MARKET FEED NOT CONNECTED' : listingBusy ? 'CHECKING AUTHORIZED MARKET…' : 'NO LIVE LISTINGS HERE'}</b><span>A mapped building is not automatically for sale. Try another place or connect an authorized provider.</span></div> : listings.map((item) => <article key={item.id} className={styles.listing}>
          <button type="button" className={extra.cardSelect} onClick={() => chooseListing(item)}>
            {item.imageUrl ? <img src={item.imageUrl} alt="" referrerPolicy="no-referrer"/> : <div className={styles.listingPlaceholder}>{categoryLabel(item.category)}</div>}
            <div className={styles.listingBody}><small>{item.provider} · {item.country || 'Earth'}</small><strong>{money(item)}</strong><b>{item.address || 'Address from source'}</b><span>{[item.city,item.region,item.postalCode].filter(Boolean).join(', ')}</span><span>{item.beds != null ? `${item.beds} bd · ` : ''}{item.baths != null ? `${item.baths} ba · ` : ''}{item.livingAreaSqft ? `${Math.round(item.livingAreaSqft).toLocaleString()} sqft` : categoryLabel(item.category)}</span></div>
          </button>
          {item.sourceUrl ? <a className={styles.marketLink} href={item.sourceUrl} target="_blank" rel="noreferrer">OPEN SOURCE LISTING ↗</a> : null}
        </article>)}
      </div>
      <div className={styles.sourceNote}><b>REAL-PROPERTY BOUNDARY</b><span>A real-property acquisition still requires the normal broker/contract, title, closing and recording process. A digital twin does not replace the deed, and a map/listing/AI model does not create ownership.</span></div>
    </section>

    <section className={extra.governance}>
      <article><small>ANTI-MONOPOLY STEWARDSHIP</small><h2>More digital claims, higher marginal fee.</h2><p>The proposed Voxel Vault stewardship schedule stays <b>linear, not exponential</b>: $1/year base + $0.25 per existing global claim + $0.75 per existing claim in the same local region. Regional cap: 20. No owner/admin exemption. Billing remains disabled until an authoritative claim ledger exists. This is not a government tax and does not create rights in physical property.</p></article>
      <article><small>WHO OWNS THE WORLD MAP?</small><h2>Voxel Vault can own the atlas product—not the Earth.</h2><p>Voxel Vault can own its software, interface, original metadata, compliant caches and workflows. Google, Overture, OpenStreetMap, municipalities and listing providers keep their source data and licenses.</p></article>
    </section>

    <footer className={styles.footer}><b>REALITY ≠ TITLE ≠ INVESTMENT</b><span>Physical-market value and digital twin resale value remain separate. Map geometry, listing photos, Meshy models, legal ownership and investment rights stay separate evidence layers; none guarantees appreciation or income.</span></footer>
  </main>;
}
