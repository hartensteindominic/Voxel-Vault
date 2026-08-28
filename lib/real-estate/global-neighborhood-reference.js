const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OSM_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright';
const APP_USER_AGENT = 'VoxelVault-GEO/1.0 (+https://www.voxelvault.io)';
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map();
let publicQueue = Promise.resolve();

const clean = (value) => String(value ?? '').trim();
const finite = (value) => value !== null && value !== undefined && clean(value) !== '' && Number.isFinite(Number(value));

function coordinate(value, min, max, label) {
  if (!finite(value)) throw new Error(`${label} is required.`);
  const number = Number(value);
  if (number < min || number > max) throw new Error(`${label} is outside its valid range.`);
  return number;
}

function parseMeters(value) {
  const text = clean(value).toLowerCase();
  if (!text) return null;
  const feet = text.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:ft|feet|foot)$/);
  if (feet) return Number(feet[1]) * 0.3048;
  const meters = text.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:m|meter|meters)?$/);
  return meters ? Number(meters[1]) : null;
}

function parseLevels(value) {
  const number = Number(clean(value).split(';')[0]);
  return Number.isFinite(number) && number > 0 && number < 300 ? number : null;
}

function chooseHeight(tags = {}) {
  const reported = parseMeters(tags.height);
  if (reported && reported > 0 && reported < 1000) {
    return { referenceHeightMeters: Number(reported.toFixed(3)), heightStatus: 'source_reported', heightSource: 'OpenStreetMap height tag', measuredHeightAccepted: false };
  }
  const levels = parseLevels(tags['building:levels']);
  if (levels) {
    return { referenceHeightMeters: Number((levels * 3).toFixed(3)), heightStatus: 'derived_from_levels', heightSource: `${levels} source-reported level(s) × 3 m illustrative floor height`, measuredHeightAccepted: false };
  }
  return { referenceHeightMeters: 3, heightStatus: 'illustrative_default', heightSource: '3 m illustrative extrusion because no source height or level count was available', measuredHeightAccepted: false };
}

function ringFromWay(element) {
  if (!Array.isArray(element?.geometry) || element.geometry.length < 3) return null;
  const ring = element.geometry
    .map((point) => [Number(point?.lon), Number(point?.lat)])
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  if (ring.length < 3) return null;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring.length >= 4 ? ring : null;
}

function centroid(ring) {
  const points = ring.slice(0, -1);
  if (!points.length) return null;
  const sum = points.reduce((acc, [lon, lat]) => ({ lon: acc.lon + lon, lat: acc.lat + lat }), { lon: 0, lat: 0 });
  return { longitude: sum.lon / points.length, latitude: sum.lat / points.length };
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (degrees) => degrees * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cacheRead(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheWrite(key, value) {
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  cache.set(key, { storedAt: Date.now(), value });
  return value;
}

async function serializedPublicRequest(task) {
  const next = publicQueue.then(task, task);
  publicQueue = next.catch(() => {});
  return next;
}

function normalizeBuilding(candidate, selectedId) {
  const tags = candidate.element?.tags || {};
  const id = Number(candidate.element?.id);
  return {
    id: Number.isFinite(id) ? `way:${id}` : `building:${candidate.distanceMeters.toFixed(1)}`,
    selected: Number.isFinite(id) && id === selectedId,
    distanceMeters: Number(candidate.distanceMeters.toFixed(2)),
    center: candidate.center,
    geometry: { type: 'Polygon', coordinates: [candidate.ring] },
    tags: {
      building: clean(tags.building),
      name: clean(tags.name),
      height: clean(tags.height),
      levels: clean(tags['building:levels']),
      houseNumber: clean(tags['addr:housenumber']),
      street: clean(tags['addr:street']),
    },
    height: chooseHeight(tags),
    sourceUrl: Number.isFinite(id) ? `https://www.openstreetmap.org/way/${id}` : 'https://www.openstreetmap.org/',
  };
}

export async function fetchGlobalNeighborhoodReference(input = {}, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('No fetch implementation is available for global neighborhood lookup.');
  const latitude = coordinate(input.latitude, -90, 90, 'Latitude');
  const longitude = coordinate(input.longitude, -180, 180, 'Longitude');
  const radiusMeters = Math.max(60, Math.min(220, Number(input.radiusMeters) || 130));
  const overpassUrl = clean(process.env.OVERPASS_API_URL || options.overpassUrl || DEFAULT_OVERPASS_URL);
  const cacheKey = `${overpassUrl}|${latitude.toFixed(5)}|${longitude.toFixed(5)}|${Math.round(radiusMeters)}`;
  const cached = cacheRead(cacheKey);
  if (cached) return { ...cached, cacheStatus: 'warm-instance-hit' };

  const query = `[out:json][timeout:14];way(around:${Math.round(radiusMeters)},${latitude},${longitude})["building"];out body geom qt 45;`;
  const execute = async () => {
    const response = await fetchImpl(overpassUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': APP_USER_AGENT,
        Referer: 'https://www.voxelvault.io/geo',
      },
      body: new URLSearchParams({ data: query }).toString(),
      cache: 'no-store',
      signal: AbortSignal.timeout(17000),
    });
    if (!response.ok) throw new Error(`Global neighborhood source returned HTTP ${response.status}.`);
    return response;
  };

  const response = overpassUrl === DEFAULT_OVERPASS_URL ? await serializedPublicRequest(execute) : await execute();
  const payload = await response.json().catch(() => null);
  const candidates = (Array.isArray(payload?.elements) ? payload.elements : [])
    .map((element) => {
      const ring = ringFromWay(element);
      const center = ring ? centroid(ring) : null;
      if (!ring || !center) return null;
      return { element, ring, center, distanceMeters: haversineMeters(latitude, longitude, center.latitude, center.longitude) };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const selected = candidates[0] || null;
  const selectedId = Number(selected?.element?.id);
  const buildings = candidates.slice(0, 24).map((candidate) => normalizeBuilding(candidate, selectedId));
  const primary = buildings[0] || null;
  const source = {
    authority: 'OpenStreetMap contributors via Overpass API',
    observedAt: new Date().toISOString(),
    sourceUrl: primary?.sourceUrl || 'https://www.openstreetmap.org/',
    attributionUrl: OSM_ATTRIBUTION_URL,
    license: 'ODbL',
    publicServiceUsage: overpassUrl === DEFAULT_OVERPASS_URL ? 'small-scale serialized lookup; configure OVERPASS_API_URL for production scale' : 'configured Overpass-compatible provider',
  };

  return cacheWrite(cacheKey, {
    found: Boolean(primary),
    latitude,
    longitude,
    radiusMeters,
    cacheStatus: 'miss',
    neighborhoodBuildingCount: buildings.length,
    neighborhoodBuildings: buildings,
    geometry: primary?.geometry || null,
    tags: primary?.tags || {},
    height: primary?.height || { referenceHeightMeters: 3, heightStatus: 'illustrative_default', heightSource: 'No selected building footprint was found.', measuredHeightAccepted: false },
    distanceMeters: primary?.distanceMeters ?? null,
    matchStrategy: primary ? 'nearest_source_building_within_neighborhood' : 'none',
    source: { ...source, recordId: primary?.id || '' },
    legalEffects: {
      authoritativeParcelBoundary: false,
      verifiesTitle: false,
      createsOwnership: false,
      verifiedMeasuredHeight: false,
    },
    note: primary
      ? 'The selected and surrounding building footprints are source-backed global map references. Their height may be source-reported, derived from levels, or illustrative; none becomes legal parcel/title evidence.'
      : 'No nearby OSM building footprint was returned. GEO must not invent a property-specific footprint.',
  });
}
