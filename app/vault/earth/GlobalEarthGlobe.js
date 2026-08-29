'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import PlanetStreamGlobe from './PlanetStreamGlobe';

const STREAM_ZOOM = 15;
const MAX_STREAMED_BUILDINGS = 420;
const MAX_VISITED_REGIONS = 96;

function tileKey(latitude, longitude, ring = 0) {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, Number(latitude)));
  const lng = Math.max(-180, Math.min(180, Number(longitude)));
  const n = 2 ** STREAM_ZOOM;
  const x = Math.max(0, Math.min(n - 1, Math.floor(((lng + 180) / 360) * n)));
  const radians = lat * Math.PI / 180;
  const y = Math.max(0, Math.min(n - 1, Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * n)));
  return `${STREAM_ZOOM}:${x}:${y}:r${ring}`;
}

function validCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

function mergeBuildings(primary = [], streamed = []) {
  const map = new Map();
  for (const building of primary) {
    if (building?.atlasId) map.set(building.atlasId, building);
  }
  for (const building of streamed) {
    if (building?.atlasId && !map.has(building.atlasId)) map.set(building.atlasId, building);
  }
  return [...map.values()].slice(0, MAX_STREAMED_BUILDINGS + Math.min(primary.length, 120));
}

export default function GlobalEarthGlobe({
  listings = [],
  selectedId = '',
  onSelect,
  atlasBuildings = [],
  selectedAtlasId = '',
  onAtlasSelect,
  onLocation,
}) {
  const [streamedBuildings, setStreamedBuildings] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [visitedCount, setVisitedCount] = useState(0);
  const [lastCoverage, setLastCoverage] = useState(null);
  const visitedRef = useRef(new Map());
  const inflightRef = useRef(new Set());
  const streamedRef = useRef([]);

  streamedRef.current = streamedBuildings;

  const combinedBuildings = useMemo(
    () => mergeBuildings(atlasBuildings, streamedBuildings),
    [atlasBuildings, streamedBuildings],
  );

  const streamViewport = useCallback(async ({ latitude, longitude, cameraDistance }) => {
    if (!validCoordinate(latitude, -85.05112878, 85.05112878) || !validCoordinate(longitude, -180, 180)) return;
    const ring = Number(cameraDistance) <= 12.2 ? 1 : 0;
    const key = tileKey(latitude, longitude, ring);
    if (visitedRef.current.has(key) || inflightRef.current.has(key)) return;

    inflightRef.current.add(key);
    setStreaming(true);
    try {
      const response = await fetch(`/api/world-atlas/stream?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}&ring=${ring}`, {
        cache: 'force-cache',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Visible Earth region could not be streamed.');

      visitedRef.current.set(key, Date.now());
      if (visitedRef.current.size > MAX_VISITED_REGIONS) {
        const oldest = visitedRef.current.keys().next().value;
        if (oldest) visitedRef.current.delete(oldest);
      }
      setVisitedCount(visitedRef.current.size);
      setLastCoverage({
        tileCount: Number(data.tileCount || 0),
        buildingCount: Number(data.buildingCount || 0),
        source: data.coverage?.source || 'Overture Maps Foundation',
      });

      const incoming = Array.isArray(data.buildings) ? data.buildings : [];
      if (incoming.length) {
        setStreamedBuildings((current) => {
          const map = new Map(current.map((building) => [building.atlasId, building]));
          for (const building of incoming) {
            if (building?.atlasId) map.set(building.atlasId, building);
          }
          const next = [...map.values()];
          return next.length > MAX_STREAMED_BUILDINGS ? next.slice(next.length - MAX_STREAMED_BUILDINGS) : next;
        });
      }
    } catch {
      // The detailed address/property workflow remains available when a streamed region fails.
      // Do not create replacement buildings or mark a failed region as visited.
    } finally {
      inflightRef.current.delete(key);
      setStreaming(inflightRef.current.size > 0);
    }
  }, []);

  const chooseAtlas = useCallback((atlasId) => {
    const local = atlasBuildings.find((building) => building.atlasId === atlasId);
    if (local) {
      onAtlasSelect?.(atlasId);
      return;
    }

    const streamed = streamedRef.current.find((building) => building.atlasId === atlasId);
    if (streamed && validCoordinate(streamed.latitude, -90, 90) && validCoordinate(streamed.longitude, -180, 180)) {
      // Streamed globe markers are fast map references only. Selecting one deepens through
      // the normal Earth lookup instead of silently promoting the low-detail marker.
      onLocation?.({ latitude: Number(streamed.latitude), longitude: Number(streamed.longitude) });
    }
  }, [atlasBuildings, onAtlasSelect, onLocation]);

  return <div className="worldStreamShell">
    <PlanetStreamGlobe
      listings={listings}
      selectedId={selectedId}
      onSelect={onSelect}
      atlasBuildings={combinedBuildings}
      selectedAtlasId={selectedAtlasId}
      onAtlasSelect={chooseAtlas}
      onLocation={onLocation}
      onViewport={streamViewport}
      streaming={streaming}
    />
    <div className="worldCoverage" aria-live="polite">
      <div><b>{visitedCount}</b><span>REGIONS VISITED</span></div>
      <div><b>{streamedBuildings.length}</b><span>STREAMED MAP BUILDINGS</span></div>
      <div><b>{atlasBuildings.length}</b><span>DETAILED LOCAL BUILDINGS</span></div>
      <em>MAP REFERENCE · NOT TITLE</em>
      {lastCoverage ? <small>LAST LOAD · {lastCoverage.tileCount} TILE{lastCoverage.tileCount === 1 ? '' : 'S'} · {lastCoverage.buildingCount} SOURCE BUILDINGS · {lastCoverage.source}</small> : <small>Rotate or tap LOAD HERE to progressively read the visible Overture region.</small>}
    </div>
    <style jsx>{`.worldStreamShell{position:absolute;inset:0}.worldCoverage{position:absolute;z-index:4;left:12px;bottom:12px;max-width:min(560px,calc(100% - 24px));display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:8px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(4,10,12,.78);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:#edf7f3;pointer-events:none}.worldCoverage div{display:grid;gap:2px;min-width:0;padding:5px 7px;border-radius:10px;background:rgba(255,255,255,.04)}.worldCoverage b{font-size:13px}.worldCoverage span{font-size:6px;letter-spacing:.08em;color:#8fa59e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.worldCoverage em{grid-column:1/-1;font-style:normal;font-size:7px;font-weight:950;letter-spacing:.12em;color:#ffbd98}.worldCoverage small{grid-column:1/-1;font-size:7px;line-height:1.4;color:#849690}@media(max-width:640px){.worldCoverage{left:9px;right:9px;bottom:9px;max-width:none}.worldCoverage b{font-size:11px}.worldCoverage span{font-size:5.5px}.worldCoverage small{display:none}}`}</style>
  </div>;
}
