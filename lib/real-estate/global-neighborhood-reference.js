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

function lineFromWay(element) {
  if (!Array.isArray(element?.geometry) || element.geometry.length < 2) return null;
  const coordinates = element.geometry
    .map((point) => [Number(point?.lon), Number(point?.lat)])
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  return coordinates.length >= 2 ? coordinates : null;
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

function normalizeStreet(value) {
  return clean(value)
    .toUpperCase()
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bBOULEVARD\b/g, 'BLVD')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bLANE\b/g, 'LN')
    .replace(/\bCOURT\b/g, 'CT')
    .replace(/\bPLACE\b/g, 'PL')
    .replace(/\bPARKWAY\b/g, 'PKWY')
    .replace(/\bHIGHWAY\b/g, 'HWY')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function requestedAddressAnchor(value) {
  const firstLine = clean(value).split(',')[0];
  const match = firstLine.match(/^\s*([0-9]+[A-Za-z-]*)\s+(.+?)\s*$/);
  if (!match) return null;
  const houseNumber = clean(match[1]).toUpperCase();
  const street = normalizeStreet(match[2]);
  return houseNumber && street ? { houseNumber, street } : null;
}

function candidateAddressAnchor(element) {
  const tags = element?.tags || {};
  const houseNumber = clean(tags['addr:housenumber']).toUpperCase();
  const street = normalizeStreet(tags['addr:street']);
  return houseNumber && street ? { houseNumber, street } : null;
}

function exactAddressMatch(requested, candidate) {
  return Boolean(requested && candidate
    && requested.houseNumber === candidate.houseNumber
    && requested.street === candidate.street);
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

function publicRealmKind(highway) {
  const value = clean(highway).toLowerCase();
  if (['footway', 'path', 'pedestrian', 'steps', 'cycleway', 'bridleway'].includes(value)) return 'walkway';
  return 'street';
}

function normalizePublicRealmWay(element, latitude, longitude) {
  const coordinates = lineFromWay(element);
  if (!coordinates) return null;
  const tags = element?.tags || {};
  const id = Number(element?.id);
  const nearestDistanceMeters = coordinates.reduce((nearest, [lon, lat]) => Math.min(
    nearest,
    haversineMeters(latitude, longitude, lat, lon),
  ), Infinity);
  const highway = clean(tags.highway);
  return {
    id: Number.isFinite(id) ? `way:${id}` : `mapped-way:${nearestDistanceMeters.toFixed(1)}`,
    kind: publicRealmKind(highway),
    nearestDistanceMeters: Number(nearestDistanceMeters.toFixed(2)),
    geometry: { type: 'LineString', coordinates },
    tags: {
      highway,
      name: clean(tags.name),
      surface: clean(tags.surface),
      lanes: clean(tags.lanes),
      sidewalk: clean(tags.sidewalk),
      foot: clean(tags.foot),
      bicycle: clean(tags.bicycle),
    },
    sourceUrl: Number.isFinite(id) ? `https://www.openstreetmap.org/way/${id}` : 'https://www.openstreetmap.org/',
  };
}

export async function fetchGlobalNeighborhoodReference(input = {}, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('No fetch implementation is available for global neighborhood lookup.');
  const latitude = coordinate(input.latitude, -90, 90, 'Latitude');
  const longitude = coordinate(input.longitude, -180, 180, 'Longitude');
  const requestedAddress = clean(input.address);
  const requestedAnchor = requestedAddressAnchor(requestedAddress);
  const radiusMeters = Math.max(60, Math.min(220, Number(input.radiusMeters) || 130));
  const overpassUrl = clean(process.env.OVERPASS_API_URL || options.overpassUrl || DEFAULT_OVERPASS_URL);
  const cacheKey = `${overpassUrl}|${latitude.toFixed(5)}|${longitude.toFixed(5)}|${Math.round(radiusMeters)}|${requestedAnchor?.houseNumber || ''}|${requestedAnchor?.street || ''}`;
  const cached = cacheRead(cacheKey);
  if (cached) return { ...cached, cacheStatus: 'warm-instance-hit' };

  const roundedRadius = Math.round(radiusMeters);
  const query = `[out:json][timeout:14];(way(around:${roundedRadius},${latitude},${longitude})["building"];way(around:${roundedRadius},${latitude},${longitude})["highway"];);out body geom qt 90;`;
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
  const elements = Array.isArray(payload?.elements) ? payload.elements : [];
  const candidates = elements
    .filter((element) => Boolean(element?.tags?.building))
    .map((element) => {
      const ring = ringFromWay(element);
      const center = ring ? centroid(ring) : null;
      if (!ring || !center) return null;
      return {
        element,
        ring,
        center,
        sourceAddress: candidateAddressAnchor(element),
        distanceMeters: haversineMeters(latitude, longitude, center.latitude, center.longitude),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const addressMatches = requestedAnchor
    ? candidates.filter((candidate) => exactAddressMatch(requestedAnchor, candidate.sourceAddress))
    : [];
  const selected = addressMatches[0] || candidates[0] || null;
  const selectedId = Number(selected?.element?.id);
  const orderedCandidates = selected
    ? [selected, ...candidates.filter((candidate) => Number(candidate.element?.id) !== selectedId)]
    : [];
  const buildings = orderedCandidates.slice(0, 24).map((candidate) => normalizeBuilding(candidate, selectedId));
  const primary = buildings[0] || null;
  const exactSourceAddressMatch = Boolean(selected && addressMatches.length);
  const matchStrategy = primary
    ? exactSourceAddressMatch ? 'exact_source_address_match' : 'nearest_source_building_within_neighborhood'
    : 'none';

  const publicRealmWays = elements
    .filter((element) => Boolean(element?.tags?.highway))
    .map((element) => normalizePublicRealmWay(element, latitude, longitude))
    .filter(Boolean)
    .sort((a, b) => a.nearestDistanceMeters - b.nearestDistanceMeters)
    .slice(0, 36);
  const streetCount = publicRealmWays.filter((way) => way.kind === 'street').length;
  const walkwayCount = publicRealmWays.filter((way) => way.kind === 'walkway').length;

  const source = {
    authority: 'OpenStreetMap contributors via Overpass API',
    observedAt: new Date().toISOString(),
    sourceUrl: primary?.sourceUrl || publicRealmWays[0]?.sourceUrl || 'https://www.openstreetmap.org/',
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
    publicRealm: {
      found: publicRealmWays.length > 0,
      mappedWayCount: publicRealmWays.length,
      streetCount,
      walkwayCount,
      ways: publicRealmWays,
      source: {
        authority: source.authority,
        observedAt: source.observedAt,
        attributionUrl: source.attributionUrl,
        license: source.license,
      },
      legalEffects: {
        definesParcelBoundary: false,
        provesRightOfWayWidth: false,
        provesSidewalkWidth: false,
        verifiesTitle: false,
      },
      note: 'Mapped street and path LineStrings are source-backed map centerlines. GEO does not infer curb, right-of-way, lane, or sidewalk widths from them; any rendered stroke thickness is visual styling only.',
    },
    geometry: primary?.geometry || null,
    tags: primary?.tags || {},
    height: primary?.height || { referenceHeightMeters: 3, heightStatus: 'illustrative_default', heightSource: 'No selected building footprint was found.', measuredHeightAccepted: false },
    distanceMeters: primary?.distanceMeters ?? null,
    matchStrategy,
    addressMatch: {
      requestedAddress,
      requestedHouseNumber: requestedAnchor?.houseNumber || '',
      requestedStreet: requestedAnchor?.street || '',
      exactSourceAddressMatch,
      sourceHouseNumber: primary?.tags?.houseNumber || '',
      sourceStreet: primary?.tags?.street || '',
      candidateCount: candidates.length,
      exactMatchCandidateCount: addressMatches.length,
    },
    source: { ...source, recordId: primary?.id || '' },
    legalEffects: {
      authoritativeParcelBoundary: false,
      verifiesTitle: false,
      createsOwnership: false,
      verifiedMeasuredHeight: false,
      publicRealmDefinesParcelBoundary: false,
    },
    note: primary
      ? exactSourceAddressMatch
        ? 'The selected footprint carries source-reported address tags matching the requested address. It remains global map reference geometry, not a cadastral parcel boundary or title record.'
        : 'No exact source-reported address-tag match was available, so GEO selected the nearest source-backed building footprint as reference context. It must not be described as the exact legal property footprint.'
      : 'No nearby OSM building footprint was returned. GEO must not invent a property-specific footprint.',
  });
}