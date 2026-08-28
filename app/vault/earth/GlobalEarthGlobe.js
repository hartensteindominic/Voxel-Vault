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
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        tileCount: Number(data.tileCount || 0),
        buildingCount: Number(data.buildingCount || 0),
        source: data.coverage?.source || 'Overture Maps Foundation Buildings PMTiles',
        scope: data.coverage?.scope || 'global-on-demand',
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

  return <PlanetStreamGlobe
    listings={listings}
    selectedId={selectedId}
    onSelect={onSelect}
    atlasBuildings={combinedBuildings}
    selectedAtlasId={selectedAtlasId}
    onAtlasSelect={chooseAtlas}
    onLocation={onLocation}
    onViewport={streamViewport}
    streaming={streaming}
    coverage={{
      visitedRegions: visitedCount,
      streamedBuildings: streamedBuildings.length,
      detailedBuildings: atlasBuildings.length,
      visibleMarkers: combinedBuildings.length,
      lastCoverage,
      truthLabel: 'MAP REFERENCE · NOT TITLE',
    }}
  />;
}
