'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import styles from './page.module.css';

function clean(value) { return String(value || '').trim(); }
function number(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function heightMeters(building) {
  const raw = building?.height?.referenceHeightMeters ?? building?.height?.heightMeters ?? building?.height?.estimatedHeightMeters ?? building?.height;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function rings(geometry) {
  if (!geometry?.coordinates) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates.slice(0, 1);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flatMap((polygon) => polygon.slice(0, 1));
  return [];
}
function pointsFromBuildings(buildings) {
  const points = [];
  buildings.forEach((building) => rings(building?.geometry).forEach((ring) => ring.forEach((coordinate) => {
    const lon = number(coordinate?.[0]); const lat = number(coordinate?.[1]);
    if (lat !== null && lon !== null) points.push({ lat, lon });
  })));
  return points;
}

function LocalBuildingMap({ buildings, selected }) {
  const scene = useMemo(() => {
    const usable = buildings.filter((building) => number(building?.latitude) !== null && number(building?.longitude) !== null).slice(0, 90);
    const geometryPoints = pointsFromBuildings(usable);
    const centerLat = number(selected?.latitude) ?? number(usable[0]?.latitude) ?? 0;
    const centerLon = number(selected?.longitude) ?? number(usable[0]?.longitude) ?? 0;
    const all = geometryPoints.length ? geometryPoints : usable.map((building) => ({ lat: Number(building.latitude), lon: Number(building.longitude) }));
    const latSpan = Math.max(0.00035, ...all.map((point) => Math.abs(point.lat - centerLat))) * 2.35;
    const lonSpan = Math.max(0.00045, ...all.map((point) => Math.abs(point.lon - centerLon))) * 2.35;
    const project = (lat, lon) => ({
      x: 50 + ((lon - centerLon) / lonSpan) * 82,
      y: 50 - ((lat - centerLat) / latSpan) * 82,
    });
    const shapes = usable.map((building, index) => {
      const buildingRings = rings(building.geometry);
      const polygons = buildingRings.map((ring) => ring.map((coordinate) => project(Number(coordinate[1]), Number(coordinate[0]))).map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '));
      const point = project(Number(building.latitude), Number(building.longitude));
      return { building, polygons, point, key: building.atlasId || `building-${index}` };
    });
    return { shapes, center: project(centerLat, centerLon) };
  }, [buildings, selected]);

  return <div className={styles.mapShell}>
    <svg className={styles.map} viewBox="0 0 100 100" role="img" aria-label="Source-backed local building map around the selected property">
      <defs>
        <pattern id="streetGrid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" className={styles.gridLine}/></pattern>
        <filter id="selectedGlow"><feGaussianBlur stdDeviation="1.1" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width="100" height="100" className={styles.mapGround}/>
      <rect width="100" height="100" fill="url(#streetGrid)"/>
      <path d="M-5 73 C18 62 32 67 52 55 S84 42 106 28" className={styles.roadWide}/>
      <path d="M-5 73 C18 62 32 67 52 55 S84 42 106 28" className={styles.road}/>
      <path d="M24 -5 C28 20 22 42 30 62 S42 84 47 105" className={styles.roadWide}/>
      <path d="M24 -5 C28 20 22 42 30 62 S42 84 47 105" className={styles.road}/>
      {scene.shapes.map(({ building, polygons, point, key }) => {
        const active = building.atlasId && building.atlasId === selected?.atlasId;
        if (polygons.length) return <g key={key} className={active ? styles.selectedBuilding : styles.building}>{polygons.map((polygon, index) => <polygon key={index} points={polygon}/>)}</g>;
        return <rect key={key} x={point.x - 1.2} y={point.y - 1.2} width="2.4" height="2.4" rx=".5" className={active ? styles.selectedDot : styles.dot}/>;
      })}
      <circle cx={scene.center.x} cy={scene.center.y} r="5.2" className={styles.focusRing}/>
      <circle cx={scene.center.x} cy={scene.center.y} r="1.55" className={styles.focusPin}/>
    </svg>
    <div className={styles.compass}><b>N</b><span>↑</span></div>
    <div className={styles.mapLegend}><span><i className={styles.legendSelected}/>Selected</span><span><i className={styles.legendNearby}/>Nearby buildings</span></div>
  </div>;
}

export default function CreditFreePropertyMapPage() {
  const [address, setAddress] = useState('');
  const [atlas, setAtlas] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Search an address. This map uses no Meshy generation credits.');

  async function search(event) {
    event?.preventDefault?.();
    const value = clean(address);
    if (!value) return;
    setBusy(true);
    setMessage('Locating the property and nearby source-backed buildings…');
    try {
      const params = new URLSearchParams({ address: value, radius: '240' });
      const response = await fetch(`/api/world-atlas/inspect?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'That address could not be mapped.');
      const choice = data.selectedBuilding || data.buildings?.[0] || (Number.isFinite(Number(data.latitude)) && Number.isFinite(Number(data.longitude)) ? {
        atlasId: `location:${Number(data.latitude).toFixed(7)},${Number(data.longitude).toFixed(7)}`,
        latitude: Number(data.latitude), longitude: Number(data.longitude), geometry: null, tags: { name: value },
      } : null);
      if (!choice) throw new Error('The address resolved without a usable map location.');
      setAtlas(data);
      setSelected(choice);
      setMessage(choice.atlasId && !String(choice.atlasId).startsWith('location:')
        ? 'Property located. The highlighted shape is the source-backed building reference.'
        : 'Location found. A precise source-backed building footprint was not available here, so the pin is shown without inventing a building shape.');
    } catch (error) {
      setAtlas(null); setSelected(null);
      setMessage(error instanceof Error ? error.message : 'Map lookup failed.');
    } finally { setBusy(false); }
  }

  const nearby = Array.isArray(atlas?.buildings) ? atlas.buildings : [];
  const selectedHeight = heightMeters(selected);
  const mappedIdentity = Boolean(selected?.atlasId && !String(selected.atlasId).startsWith('location:'));

  return <main className={styles.page}><section className={styles.phone}>
    <header className={styles.header}><Link href="/property" className={styles.back}>‹</Link><div><small>VOXELPOP · PROPERTY</small><h1>My World</h1></div><span className={styles.free}>0 CREDITS</span></header>

    <section className={styles.intro}><span>CREDIT-FREE MAP MODE</span><h2>Your property world still works.</h2><p>Explore the real mapped location and available building footprint data without starting Meshy, without spending 3D credits, and without needing temporary VoxelPop checkout storage.</p></section>

    <form className={styles.search} onSubmit={search}><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Enter a property address" autoComplete="street-address"/><button disabled={busy || !clean(address)}>{busy ? 'Mapping…' : 'Show property'}</button></form>

    {selected ? <>
      <LocalBuildingMap buildings={nearby.length ? nearby : [selected]} selected={selected}/>
      <section className={styles.propertyCard}><div className={styles.propertyTop}><div><small>SELECTED PROPERTY</small><h3>{selected?.tags?.name || address}</h3><p>{address}</p></div><span className={mappedIdentity ? styles.verified : styles.reference}>{mappedIdentity ? 'MAPPED' : 'LOCATION'}</span></div>
        <div className={styles.stats}><div><small>LATITUDE</small><b>{Number(selected.latitude).toFixed(5)}</b></div><div><small>LONGITUDE</small><b>{Number(selected.longitude).toFixed(5)}</b></div><div><small>HEIGHT</small><b>{selectedHeight ? `${selectedHeight.toFixed(1)} m` : 'Not sourced'}</b></div><div><small>NEARBY</small><b>{nearby.length} buildings</b></div></div>
      </section>
      <section className={styles.modeCard}><div className={styles.voxelIcon}><i/><i/><i/></div><div><small>VOXELPOP MAP PREVIEW</small><h3>No paid 3D required</h3><p>The map keeps sourced geography separate from generated appearance. When 3D provider credits are available, interactive generated 3D can remain an optional upgrade.</p></div></section>
    </> : <div className={styles.empty}><div className={styles.miniWorld}>⌂</div><b>Search an address to build the map</b><span>Real location first · generated 3D optional</span></div>}

    <p className={styles.status} role="status">{message}</p>
    <section className={styles.truth}><b>What this means</b><p>This is a digital map/reference experience. A mapped location or building footprint does not prove deed/title, ownership, market value, investment rights, rent rights, or physical-property rights. The map does not invent missing building geometry.</p></section>
    <div className={styles.actions}><Link href="/property">Back to VoxelPop Property</Link><Link href="/geo/slice">Open $1.99 sandbox</Link></div>
  </section></main>;
}
