const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const clean = (value) => String(value ?? '').trim();
const finite = (value) => value !== null && value !== undefined && clean(value) !== '' && Number.isFinite(Number(value));

function validCoordinate(value, min, max, label) {
  if (!finite(value)) return null;
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
  if (meters) return Number(meters[1]);
  return null;
}

function parseLevels(value) {
  const number = Number(clean(value).split(';')[0]);
  return Number.isFinite(number) && number > 0 && number < 300 ? number : null;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (degrees) => degrees * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

export async function geocodeGeoAddress(address, options = {}) {
  const query = clean(address).replace(/\s+/g, ' ').slice(0, 280);
  if (!query) throw new Error('Address is required for geocoding.');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('No fetch implementation is available.');

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');

  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'VoxelVault-GEO/1.0',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Global address lookup returned HTTP ${response.status}.`);
  const rows = await response.json().catch(() => []);
  const first = Array.isArray(rows) ? rows[0] : null;
  const latitude = validCoordinate(first?.lat, -90, 90, 'Latitude');
  const longitude = validCoordinate(first?.lon, -180, 180, 'Longitude');
  if (latitude === null || longitude === null) throw new Error('No global geocoding match was found for that address.');

  return {
    latitude,
    longitude,
    displayName: clean(first?.display_name),
    source: {
      authority: 'OpenStreetMap contributors via Nominatim',
      recordId: clean(first?.osm_id) ? `${clean(first?.osm_type)}:${clean(first?.osm_id)}` : '',
      observedAt: new Date().toISOString(),
      sourceUrl: 'https://www.openstreetmap.org/',
    },
  };
}

export async function fetchGlobalBuildingReference(input = {}, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('No fetch implementation is available.');
  const latitude = validCoordinate(input.latitude, -90, 90, 'Latitude');
  const longitude = validCoordinate(input.longitude, -180, 180, 'Longitude');
  if (latitude === null || longitude === null) throw new Error('Valid latitude and longitude are required for global building lookup.');
  const radiusMeters = Math.max(15, Math.min(150, Number(input.radiusMeters) || 60));
  const overpassUrl = clean(process.env.OVERPASS_API_URL || options.overpassUrl || DEFAULT_OVERPASS_URL);
  const query = `[out:json][timeout:12];way(around:${Math.round(radiusMeters)},${latitude},${longitude})["building"];out body geom qt 30;`;

  const response = await fetchImpl(overpassUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'VoxelVault-GEO/1.0',
    },
    body: new URLSearchParams({ data: query }).toString(),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Global building reference source returned HTTP ${response.status}.`);
  const payload = await response.json().catch(() => null);
  const candidates = (Array.isArray(payload?.elements) ? payload.elements : [])
    .map((element) => {
      const ring = ringFromWay(element);
      const center = ring ? centroid(ring) : null;
      if (!ring || !center) return null;
      return {
        element,
        ring,
        center,
        distanceMeters: haversineMeters(latitude, longitude, center.latitude, center.longitude),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  if (!candidates.length) {
    return {
      found: false,
      latitude,
      longitude,
      radiusMeters,
      geometry: null,
      source: {
        authority: 'OpenStreetMap contributors via Overpass API',
        recordId: '',
        observedAt: new Date().toISOString(),
        sourceUrl: 'https://www.openstreetmap.org/',
      },
      height: { referenceHeightMeters: 3, heightStatus: 'illustrative_default', heightSource: 'No building footprint was found; no building extrusion should be shown.', measuredHeightAccepted: false },
      note: 'No nearby OSM building footprint was returned. GEO must not invent a property-specific footprint.',
    };
  }

  const selected = candidates[0];
  const tags = selected.element?.tags || {};
  const id = Number(selected.element?.id);
  const height = chooseHeight(tags);
  return {
    found: true,
    latitude,
    longitude,
    radiusMeters,
    matchStrategy: 'nearest_source_building_within_radius',
    distanceMeters: Number(selected.distanceMeters.toFixed(2)),
    geometry: { type: 'Polygon', coordinates: [selected.ring] },
    tags: {
      building: clean(tags.building),
      name: clean(tags.name),
      height: clean(tags.height),
      levels: clean(tags['building:levels']),
      startDate: clean(tags.start_date),
      houseNumber: clean(tags['addr:housenumber']),
      street: clean(tags['addr:street']),
    },
    height,
    source: {
      authority: 'OpenStreetMap contributors via Overpass API',
      recordId: Number.isFinite(id) ? `way:${id}` : 'building-way',
      observedAt: new Date().toISOString(),
      sourceUrl: Number.isFinite(id) ? `https://www.openstreetmap.org/way/${id}` : 'https://www.openstreetmap.org/',
    },
    legalEffects: {
      authoritativeParcelBoundary: false,
      verifiesTitle: false,
      createsOwnership: false,
      verifiedMeasuredHeight: false,
    },
    note: height.heightStatus === 'source_reported'
      ? 'The footprint and height are source-reported global map reference data. They are not cadastral/title evidence and are not promoted to VERIFIED SPATIAL TWIN.'
      : 'The footprint is source-reported global map reference data. The displayed extrusion height is derived or illustrative and is not a measured building height.',
  };
}
