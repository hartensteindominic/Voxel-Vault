import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { PMTiles } from 'pmtiles';
import { OVERTURE_BUILDINGS_PMTILES_URL, OVERTURE_BUILDINGS_RELEASE } from './overture-building-tiles.js';

const MAX_ZOOM = 15;
const MAX_RING = 1;
const MAX_FEATURES_PER_TILE = 120;
const MAX_FEATURES_PER_RESPONSE = 500;
const TILE_CACHE_TTL_MS = 60 * 60 * 1000;
const archiveCache = new Map();
const tileCache = new Map();

const clean = (value) => String(value ?? '').trim();

function coordinate(value, min, max, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} is required.`);
  if (number < min || number > max) throw new Error(`${label} is outside its valid range.`);
  return number;
}

function lonToTileX(longitude, zoom) {
  const n = 2 ** zoom;
  return Math.max(0, Math.min(n - 1, Math.floor(((longitude + 180) / 360) * n)));
}

function latToTileY(latitude, zoom) {
  const n = 2 ** zoom;
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = clamped * Math.PI / 180;
  return Math.max(0, Math.min(n - 1, Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * n)));
}

function ringCenter(ring = []) {
  const points = ring.filter((point) => Array.isArray(point) && point.length >= 2);
  if (!points.length) return null;
  let count = points.length;
  if (count > 1 && points[0][0] === points[count - 1][0] && points[0][1] === points[count - 1][1]) count -= 1;
  if (!count) return null;
  let longitude = 0;
  let latitude = 0;
  for (let index = 0; index < count; index += 1) {
    longitude += Number(points[index][0]);
    latitude += Number(points[index][1]);
  }
  return { longitude: longitude / count, latitude: latitude / count };
}

function geometryCenter(geometry) {
  if (geometry?.type === 'Polygon') return ringCenter(geometry.coordinates?.[0]);
  if (geometry?.type === 'MultiPolygon') {
    const rings = (geometry.coordinates || []).map((polygon) => polygon?.[0]).filter(Boolean);
    rings.sort((a, b) => (b?.length || 0) - (a?.length || 0));
    return ringCenter(rings[0]);
  }
  return null;
}

function parseNames(properties = {}) {
  const direct = clean(properties['@name']);
  if (direct) return direct;
  try {
    const names = typeof properties.names === 'string' ? JSON.parse(properties.names) : properties.names;
    return clean(names?.primary);
  } catch {
    return '';
  }
}

function parseHeight(properties = {}) {
  const height = Number(properties.height);
  if (Number.isFinite(height) && height > 0 && height < 1000) {
    return { referenceHeightMeters: Number(height.toFixed(2)), heightStatus: 'source_reported', measuredHeightAccepted: false };
  }
  const floors = Number(properties.num_floors);
  if (Number.isFinite(floors) && floors > 0 && floors < 300) {
    return { referenceHeightMeters: Number((floors * 3).toFixed(2)), heightStatus: 'derived_from_levels', measuredHeightAccepted: false };
  }
  return null;
}

function archiveFor(url) {
  if (!archiveCache.has(url)) archiveCache.set(url, new PMTiles(url));
  return archiveCache.get(url);
}

function cacheRead(key) {
  const row = tileCache.get(key);
  if (!row) return null;
  if (Date.now() - row.at > TILE_CACHE_TTL_MS) {
    tileCache.delete(key);
    return null;
  }
  return row.value;
}

function cacheWrite(key, value) {
  if (tileCache.size > 1200) tileCache.delete(tileCache.keys().next().value);
  tileCache.set(key, { at: Date.now(), value });
  return value;
}

function normalizeFeature(feature, x, y, z) {
  let geojson;
  try {
    geojson = feature.toGeoJSON(x, y, z);
  } catch {
    return null;
  }
  if (!geojson?.geometry || !['Polygon', 'MultiPolygon'].includes(geojson.geometry.type)) return null;
  const center = geometryCenter(geojson.geometry);
  if (!center || !Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) return null;
  const properties = feature.properties || {};
  const id = clean(properties.id) || clean(geojson.id) || `${z}:${x}:${y}:${feature.id}`;
  return {
    atlasId: `overture:${id}`,
    latitude: Number(center.latitude.toFixed(7)),
    longitude: Number(center.longitude.toFixed(7)),
    tags: {
      building: clean(properties.subtype) || 'building',
      name: parseNames(properties),
      levels: clean(properties.num_floors),
    },
    height: parseHeight(properties),
    source: {
      authority: 'Overture Maps Foundation',
      recordId: id,
      sourceUrl: 'https://explore.overturemaps.org/',
      attributionUrl: 'https://docs.overturemaps.org/attribution/',
      license: 'ODbL',
      release: OVERTURE_BUILDINGS_RELEASE,
    },
    rights: {
      mapReferenceOnly: true,
      createsPhysicalPropertyOwnership: false,
      createsTitle: false,
      createsExclusiveMapDataOwnership: false,
    },
  };
}

async function fetchTile(archive, url, x, y, z) {
  const key = `${url}|${z}|${x}|${y}`;
  const cached = cacheRead(key);
  if (cached) return { ...cached, cache: 'warm' };

  const result = await archive.getZxy(z, x, y, AbortSignal.timeout(9000));
  if (!result?.data) return cacheWrite(key, { x, y, z, buildings: [], cache: 'miss' });

  const tile = new VectorTile(new PbfReader(new Uint8Array(result.data)));
  const layers = [tile.layers?.building, tile.layers?.building_part].filter(Boolean);
  const buildings = [];
  for (const layer of layers) {
    if (buildings.length >= MAX_FEATURES_PER_TILE) break;
    const stride = Math.max(1, Math.ceil(layer.length / MAX_FEATURES_PER_TILE));
    for (let index = 0; index < layer.length && buildings.length < MAX_FEATURES_PER_TILE; index += stride) {
      const item = normalizeFeature(layer.feature(index), x, y, z);
      if (item) buildings.push(item);
    }
  }
  return cacheWrite(key, { x, y, z, buildings, cache: 'miss' });
}

export function worldAtlasTileKey(latitude, longitude, zoom = MAX_ZOOM) {
  const lat = coordinate(latitude, -85.05112878, 85.05112878, 'Latitude');
  const lng = coordinate(longitude, -180, 180, 'Longitude');
  const z = Math.max(0, Math.min(MAX_ZOOM, Number(zoom) || MAX_ZOOM));
  return { z, x: lonToTileX(lng, z), y: latToTileY(lat, z) };
}

export async function streamWorldAtlasRegion(input = {}, options = {}) {
  const latitude = coordinate(input.latitude, -85.05112878, 85.05112878, 'Latitude');
  const longitude = coordinate(input.longitude, -180, 180, 'Longitude');
  const ring = Math.max(0, Math.min(MAX_RING, Math.floor(Number(input.ring) || 0)));
  const url = clean(options.pmtilesUrl || process.env.OVERTURE_BUILDINGS_PMTILES_URL) || OVERTURE_BUILDINGS_PMTILES_URL;
  const archive = archiveFor(url);
  const header = await archive.getHeader();
  const z = Math.max(Number(header.minZoom || 0), Math.min(Number(header.maxZoom || MAX_ZOOM), MAX_ZOOM));
  const centerTile = worldAtlasTileKey(latitude, longitude, z);
  const n = 2 ** z;
  const tiles = [];

  for (let dx = -ring; dx <= ring; dx += 1) {
    for (let dy = -ring; dy <= ring; dy += 1) {
      const x = (centerTile.x + dx + n) % n;
      const y = centerTile.y + dy;
      if (y >= 0 && y < n) tiles.push({ x, y, z });
    }
  }

  const rows = await Promise.all(tiles.map((tile) => fetchTile(archive, url, tile.x, tile.y, tile.z)
    .catch(() => ({ ...tile, buildings: [], cache: 'error' }))));
  const buildings = [...new Map(rows.flatMap((row) => row.buildings || []).map((building) => [building.atlasId, building])).values()]
    .slice(0, MAX_FEATURES_PER_RESPONSE);

  return {
    ok: true,
    latitude,
    longitude,
    centerTile,
    tileCount: rows.length,
    buildingCount: buildings.length,
    buildings,
    tiles: rows.map((row) => ({ x: row.x, y: row.y, z: row.z, buildingCount: row.buildings?.length || 0, cache: row.cache })),
    coverage: {
      scope: 'global-on-demand',
      source: 'Overture Maps Foundation Buildings PMTiles',
      release: OVERTURE_BUILDINGS_RELEASE,
      loading: 'visible-or-visited-region tile streaming',
      note: 'The global archive remains remote. Voxel Vault streams only the Earth regions a user visits so the globe can scale worldwide without downloading billions of buildings to one device.',
    },
    legalEffects: {
      createsOwnership: false,
      createsTitle: false,
      createsExclusiveMapDataOwnership: false,
    },
  };
}

export const WORLD_ATLAS_STREAM_MAX_BUILDINGS = MAX_FEATURES_PER_RESPONSE;
export const WORLD_ATLAS_STREAM_MAX_RING = MAX_RING;
