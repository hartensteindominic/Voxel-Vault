const DEFAULT_EPQS_URL = 'https://epqs.nationalmap.gov/v1/json';
const TERRAIN_CACHE_TTL_MS = 30 * 60 * 1000;
const terrainCache = new Map();

const clean = (value) => String(value ?? '').trim();
const finite = (value) => value !== null && value !== undefined && clean(value) !== '' && Number.isFinite(Number(value));

function coordinate(value, min, max, label) {
  if (!finite(value)) throw new Error(`${label} is required.`);
  const number = Number(value);
  if (number < min || number > max) throw new Error(`${label} is outside its valid range.`);
  return number;
}

function cacheRead(key) {
  const entry = terrainCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > TERRAIN_CACHE_TTL_MS) {
    terrainCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheWrite(key, value) {
  if (terrainCache.size > 300) terrainCache.delete(terrainCache.keys().next().value);
  terrainCache.set(key, { storedAt: Date.now(), value });
  return value;
}

function pointAtOffset(latitude, longitude, eastMeters, northMeters) {
  const latDelta = northMeters / 111320;
  const lonScale = Math.max(0.15, Math.cos(latitude * Math.PI / 180));
  const lonDelta = eastMeters / (111320 * lonScale);
  return {
    latitude: latitude + latDelta,
    longitude: longitude + lonDelta,
    eastMeters,
    northMeters,
  };
}

function parseEpqsPayload(payload) {
  const value = Number(payload?.value ?? payload?.Elevation ?? payload?.USGS_Elevation_Point_Query_Service?.Elevation_Query?.Elevation);
  if (!Number.isFinite(value) || value <= -999999) return null;
  return {
    elevationMeters: value,
    dataSource: clean(payload?.dataSource ?? payload?.Data_Source ?? payload?.USGS_Elevation_Point_Query_Service?.Elevation_Query?.Data_Source),
    resolutionMeters: Number.isFinite(Number(payload?.resolution)) ? Number(payload.resolution) : null,
    rasterId: clean(payload?.rasterId),
    date: clean(payload?.date),
  };
}

async function fetchElevationPoint(point, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('No fetch implementation is available for USGS terrain lookup.');
  const endpoint = clean(process.env.USGS_EPQS_URL || options.epqsUrl || DEFAULT_EPQS_URL);
  const url = new URL(endpoint);
  url.searchParams.set('x', String(point.longitude));
  url.searchParams.set('y', String(point.latitude));
  url.searchParams.set('wkid', '4326');
  url.searchParams.set('units', 'Meters');
  url.searchParams.set('includeDate', 'true');
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(Number(options.timeoutMs) || 8000),
  });
  if (!response.ok) throw new Error(`USGS terrain source returned HTTP ${response.status}.`);
  const payload = await response.json().catch(() => null);
  const parsed = parseEpqsPayload(payload || {});
  if (!parsed) throw new Error('USGS terrain source did not return a usable elevation.');
  return { ...point, ...parsed };
}

export async function fetchUsgsTerrainReference(input = {}, options = {}) {
  const latitude = coordinate(input.latitude, -90, 90, 'Latitude');
  const longitude = coordinate(input.longitude, -180, 180, 'Longitude');
  const countryCode = clean(input.countryCode || 'US').toUpperCase();
  const radiusMeters = Math.max(30, Math.min(180, Number(input.radiusMeters) || 90));

  if (countryCode !== 'US') {
    return {
      available: false,
      status: 'unsupported_country',
      terrainVerifiedSurvey: false,
      samples: [],
      note: 'The current authoritative terrain adapter is USGS 3DEP for U.S. locations. GEO keeps the global scene flat rather than inventing elevation outside this adapter.',
    };
  }

  const endpoint = clean(process.env.USGS_EPQS_URL || options.epqsUrl || DEFAULT_EPQS_URL);
  const cacheKey = `${endpoint}|${latitude.toFixed(5)}|${longitude.toFixed(5)}|${Math.round(radiusMeters)}`;
  const cached = cacheRead(cacheKey);
  if (cached) return { ...cached, cacheStatus: 'warm-instance-hit' };

  const offsets = [-radiusMeters, 0, radiusMeters];
  const points = [];
  offsets.forEach((northMeters, row) => {
    offsets.forEach((eastMeters, column) => {
      points.push({ ...pointAtOffset(latitude, longitude, eastMeters, northMeters), row, column });
    });
  });

  const settled = await Promise.allSettled(points.map((point) => fetchElevationPoint(point, options)));
  const successful = settled
    .map((result, index) => result.status === 'fulfilled' ? { ...result.value, row: points[index].row, column: points[index].column } : null)
    .filter(Boolean);

  if (successful.length < 4) {
    return cacheWrite(cacheKey, {
      available: false,
      status: 'insufficient_samples',
      cacheStatus: 'miss',
      terrainVerifiedSurvey: false,
      samples: successful,
      sampleCount: successful.length,
      note: 'USGS elevation reference did not return enough samples to build a terrain surface. GEO keeps the scene flat rather than fabricating terrain.',
      source: {
        authority: 'U.S. Geological Survey 3D Elevation Program',
        service: 'Elevation Point Query Service',
        sourceUrl: 'https://www.usgs.gov/the-national-map-data-delivery/gis-data-download',
      },
    });
  }

  const elevations = successful.map((sample) => sample.elevationMeters);
  const minElevationMeters = Math.min(...elevations);
  const maxElevationMeters = Math.max(...elevations);
  const center = successful.find((sample) => sample.row === 1 && sample.column === 1) || successful[0];
  const referenceElevationMeters = center.elevationMeters;
  const samples = successful.map((sample) => ({
    ...sample,
    relativeElevationMeters: Number((sample.elevationMeters - referenceElevationMeters).toFixed(3)),
  }));

  return cacheWrite(cacheKey, {
    available: true,
    status: 'source_backed_terrain_reference',
    cacheStatus: 'miss',
    latitude,
    longitude,
    radiusMeters,
    gridSize: 3,
    sampleCount: samples.length,
    referenceElevationMeters: Number(referenceElevationMeters.toFixed(3)),
    minElevationMeters: Number(minElevationMeters.toFixed(3)),
    maxElevationMeters: Number(maxElevationMeters.toFixed(3)),
    reliefMeters: Number((maxElevationMeters - minElevationMeters).toFixed(3)),
    samples,
    terrainVerifiedSurvey: false,
    source: {
      authority: 'U.S. Geological Survey 3D Elevation Program',
      service: 'Elevation Point Query Service',
      sourceUrl: 'https://www.usgs.gov/the-national-map-data-delivery/gis-data-download',
      endpoint,
      observedAt: new Date().toISOString(),
      caveat: 'EPQS elevations are interpolated from 3DEP elevation services and are not official surveyed control elevations.',
    },
    legalEffects: {
      establishesParcelBoundary: false,
      establishesBuildingHeight: false,
      establishesDeedOwnership: false,
    },
    note: 'Source-backed ground elevation reference for visualization. This does not measure the building roof height and does not upgrade a property to VERIFIED SPATIAL TWIN.',
  });
}
