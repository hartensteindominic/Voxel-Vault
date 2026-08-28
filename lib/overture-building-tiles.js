import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { PMTiles } from 'pmtiles';

const DEFAULT_RELEASE = '2026-07-22.0';
const DEFAULT_URL = `https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/${DEFAULT_RELEASE}/buildings.pmtiles`;
const CACHE_TTL_MS = 15 * 60 * 1000;
const archiveCache = new Map();
const resultCache = new Map();

const clean = (value) => String(value ?? '').trim();
const finite = (value) => value !== null && value !== undefined && clean(value) !== '' && Number.isFinite(Number(value));

function coordinate(value, min, max, label) {
  if (!finite(value)) throw new Error(`${label} is required.`);
  const number = Number(value);
  if (number < min || number > max) throw new Error(`${label} is outside its valid range.`);
  return number;
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return null; }
}

function parseMeters(value) {
  if (!finite(value)) return null;
  const number = Number(value);
  return number > 0 && number < 1000 ? number : null;
}

function parseFloors(value) {
  if (!finite(value)) return null;
  const number = Number(value);
  return number > 0 && number < 300 ? number : null;
}

function chooseHeight(properties = {}) {
  const height = parseMeters(properties.height);
  if (height) {
    return {
      referenceHeightMeters: Number(height.toFixed(3)),
      heightStatus: 'source_reported',
      heightSource: clean(properties['@height_source']) || 'Overture source-reported height',
      measuredHeightAccepted: false,
    };
  }
  const floors = parseFloors(properties.num_floors);
  if (floors) {
    return {
      referenceHeightMeters: Number((floors * 3).toFixed(3)),
      heightStatus: 'derived_from_levels',
      heightSource: `${floors} Overture floor(s) × 3 m illustrative floor height`,
      measuredHeightAccepted: false,
    };
  }
  return {
    referenceHeightMeters: 3,
    heightStatus: 'illustrative_default',
    heightSource: '3 m illustrative extrusion because no source height or floor count was available',
    measuredHeightAccepted: false,
  };
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (degrees) => degrees * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ringCenter(ring = []) {
  const points = ring.filter((point) => Array.isArray(point) && point.length >= 2);
  if (!points.length) return null;
  let count = points.length;
  if (count > 1 && points[0][0] === points[count - 1][0] && points[0][1] === points[count - 1][1]) count -= 1;
  if (count <= 0) return null;
  let lon = 0;
  let lat = 0;
  for (let index = 0; index < count; index += 1) {
    lon += Number(points[index][0]);
    lat += Number(points[index][1]);
  }
  return { longitude: lon / count, latitude: lat / count };
}

function geometryCenter(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') return ringCenter(geometry.coordinates?.[0]);
  if (geometry.type === 'MultiPolygon') {
    const rings = (geometry.coordinates || []).map((polygon) => polygon?.[0]).filter(Boolean);
    const largest = rings.sort((a, b) => (b?.length || 0) - (a?.length || 0))[0];
    return ringCenter(largest);
  }
  return null;
}

function lonToTileX(longitude, zoom) {
  const n = 2 ** zoom;
  return Math.floor(((longitude + 180) / 360) * n);
}

function latToTileY(latitude, zoom) {
  const n = 2 ** zoom;
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = clamped * Math.PI / 180;
  return Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * n);
}

function tileRange(latitude, longitude, radiusMeters, zoom) {
  const latitudeDelta = radiusMeters / 111_320;
  const cos = Math.max(0.08, Math.cos(latitude * Math.PI / 180));
  const longitudeDelta = radiusMeters / (111_320 * cos);
  const n = 2 ** zoom;
  const minX = Math.max(0, lonToTileX(Math.max(-180, longitude - longitudeDelta), zoom));
  const maxX = Math.min(n - 1, lonToTileX(Math.min(179.999999, longitude + longitudeDelta), zoom));
  const minY = Math.max(0, latToTileY(Math.min(85.05112878, latitude + latitudeDelta), zoom));
  const maxY = Math.min(n - 1, latToTileY(Math.max(-85.05112878, latitude - latitudeDelta), zoom));
  const tiles = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) tiles.push({ x, y, z: zoom });
  }
  return tiles.slice(0, 12);
}

function sourceSummary(properties = {}) {
  const sources = parseJson(properties.sources);
  const geometrySource = clean(properties['@geometry_source']);
  const heightSource = clean(properties['@height_source']);
  return {
    geometrySource,
    heightSource,
    sourceCount: Array.isArray(sources) ? sources.length : 0,
  };
}

function featureName(properties = {}) {
  const direct = clean(properties['@name']);
  if (direct) return direct;
  const names = parseJson(properties.names);
  return clean(names?.primary);
}

function normalizeFeature(feature, layerName, x, y, z, latitude, longitude) {
  let geojson;
  try { geojson = feature.toGeoJSON(x, y, z); } catch { return null; }
  const geometry = geojson?.geometry;
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return null;
  const center = geometryCenter(geometry);
  if (!center || !Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) return null;
  const properties = feature.properties || {};
  const overtureId = clean(properties.id) || clean(geojson.id) || `${z}:${x}:${y}:${feature.id}`;
  const distanceMeters = haversineMeters(latitude, longitude, center.latitude, center.longitude);
  const source = sourceSummary(properties);
  return {
    id: `overture:${overtureId}`,
    overtureId,
    layer: layerName,
    selected: false,
    distanceMeters: Number(distanceMeters.toFixed(2)),
    center,
    geometry,
    tags: {
      building: clean(properties.subtype) || layerName,
      name: featureName(properties),
      height: finite(properties.height) ? String(properties.height) : '',
      levels: finite(properties.num_floors) ? String(properties.num_floors) : '',
      houseNumber: '',
      street: '',
    },
    height: chooseHeight(properties),
    overture: {
      subtype: clean(properties.subtype),
      class: clean(properties.class),
      geometrySource: source.geometrySource,
      heightSource: source.heightSource,
      sourceCount: source.sourceCount,
    },
    sourceUrl: 'https://explore.overturemaps.org/',
  };
}

function readCache(key) {
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    resultCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key, value) {
  if (resultCache.size > 500) resultCache.delete(resultCache.keys().next().value);
  resultCache.set(key, { storedAt: Date.now(), value });
  return value;
}

function archiveFor(url) {
  if (!archiveCache.has(url)) archiveCache.set(url, new PMTiles(url));
  return archiveCache.get(url);
}

async function readTile(archive, tile) {
  const result = await archive.getZxy(tile.z, tile.x, tile.y, AbortSignal.timeout(9000));
  if (!result?.data) return [];
  const vectorTile = new VectorTile(new PbfReader(new Uint8Array(result.data)));
  const preferred = ['building', 'building_part'];
  const layerNames = preferred.filter((name) => vectorTile.layers?.[name]);
  const names = layerNames.length ? layerNames : Object.keys(vectorTile.layers || {});
  const rows = [];
  for (const layerName of names) {
    const layer = vectorTile.layers[layerName];
    if (!layer) continue;
    const limit = Math.min(layer.length, 1800);
    for (let index = 0; index < limit; index += 1) {
      const feature = layer.feature(index);
      rows.push({ feature, layerName });
    }
  }
  return rows;
}

export async function fetchOvertureBuildingNeighborhood(input = {}, options = {}) {
  const latitude = coordinate(input.latitude, -90, 90, 'Latitude');
  const longitude = coordinate(input.longitude, -180, 180, 'Longitude');
  const radiusMeters = Math.max(60, Math.min(260, Number(input.radiusMeters) || 160));
  const release = clean(options.release || process.env.OVERTURE_RELEASE || DEFAULT_RELEASE) || DEFAULT_RELEASE;
  const url = clean(options.pmtilesUrl || process.env.OVERTURE_BUILDINGS_PMTILES_URL)
    || `https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/${release}/buildings.pmtiles`;
  const key = `${url}|${latitude.toFixed(5)}|${longitude.toFixed(5)}|${Math.round(radiusMeters)}`;
  const cached = readCache(key);
  if (cached) return { ...cached, cacheStatus: 'warm-instance-hit' };

  const archive = archiveFor(url);
  const header = await archive.getHeader();
  const zoom = Math.max(Number(header.minZoom || 0), Math.min(Number(header.maxZoom || 15), 15));
  const tiles = tileRange(latitude, longitude, radiusMeters, zoom);
  const tileRows = await Promise.all(tiles.map((tile) => readTile(archive, tile).catch(() => [])));
  const normalized = [];
  for (let tileIndex = 0; tileIndex < tiles.length; tileIndex += 1) {
    const tile = tiles[tileIndex];
    for (const row of tileRows[tileIndex]) {
      const item = normalizeFeature(row.feature, row.layerName, tile.x, tile.y, tile.z, latitude, longitude);
      if (item && item.distanceMeters <= radiusMeters * 1.65) normalized.push(item);
    }
  }

  const deduped = [...new Map(normalized.map((item) => [item.id, item])).values()]
    .sort((a, b) => {
      if (a.layer === 'building' && b.layer !== 'building') return -1;
      if (b.layer === 'building' && a.layer !== 'building') return 1;
      return a.distanceMeters - b.distanceMeters;
    });
  const mainBuildings = deduped.filter((item) => item.layer === 'building');
  const chosen = (mainBuildings.length ? mainBuildings : deduped).slice(0, 36);
  if (chosen[0]) chosen[0].selected = true;

  const value = {
    found: chosen.length > 0,
    latitude,
    longitude,
    radiusMeters,
    cacheStatus: 'miss',
    neighborhoodBuildingCount: chosen.length,
    neighborhoodBuildings: chosen,
    geometry: chosen[0]?.geometry || null,
    tags: chosen[0]?.tags || {},
    height: chosen[0]?.height || {
      referenceHeightMeters: 3,
      heightStatus: 'illustrative_default',
      heightSource: 'No building footprint was returned for this point.',
      measuredHeightAccepted: false,
    },
    distanceMeters: chosen[0]?.distanceMeters ?? null,
    matchStrategy: chosen[0] ? 'nearest_overture_building_within_region' : 'none',
    publicRealm: null,
    source: {
      authority: 'Overture Maps Foundation',
      recordId: chosen[0]?.overtureId || '',
      observedAt: new Date().toISOString(),
      sourceUrl: 'https://explore.overturemaps.org/',
      attributionUrl: 'https://docs.overturemaps.org/attribution/',
      license: 'ODbL',
      release,
      pmtilesUrl: url,
      note: 'Overture Buildings combines compatible open sources. See Overture attribution for upstream source notices.',
    },
    legalEffects: {
      authoritativeParcelBoundary: false,
      verifiesTitle: false,
      createsOwnership: false,
      verifiedMeasuredHeight: false,
    },
    note: chosen.length
      ? 'Building geometry is read from Overture Maps Foundation global building tiles. It is map reference data, not cadastral, title, deed, survey, or sale-listing evidence.'
      : 'No Overture building footprint was returned inside this small lookup region. Voxel Vault does not invent one.',
  };
  return writeCache(key, value);
}

export const OVERTURE_BUILDINGS_RELEASE = DEFAULT_RELEASE;
export const OVERTURE_BUILDINGS_PMTILES_URL = DEFAULT_URL;