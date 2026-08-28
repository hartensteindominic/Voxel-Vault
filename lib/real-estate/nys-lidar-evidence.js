export const NYS_ERIE_LIDAR_INDEX_LAYER = 'https://elevation.its.ny.gov/arcgis/rest/services/LAS_Indexes/FeatureServer/6';
export const NYS_ERIE_LIDAR_COLLECTION = 'NYS - Erie, Genesee, Livingston 2019';

function clean(value) {
  return String(value ?? '').trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || clean(value) === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function finiteCoordinate(value, label, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw Object.assign(new Error(`${label} must be a finite coordinate between ${min} and ${max}.`), { code: 'INVALID_LIDAR_POINT' });
  }
  return number;
}

export function buildNysErieLidarCoverageQuery(point = {}) {
  const latitude = finiteCoordinate(point.latitude, 'Latitude', -90, 90);
  const longitude = finiteCoordinate(point.longitude, 'Longitude', -180, 180);

  const url = new URL(`${NYS_ERIE_LIDAR_INDEX_LAYER}/query`);
  url.searchParams.set('f', 'json');
  url.searchParams.set('where', '1=1');
  url.searchParams.set('geometry', `${longitude},${latitude}`);
  url.searchParams.set('geometryType', 'esriGeometryPoint');
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('outFields', 'OBJECTID,FILENAME,SIZE_GB,COLLECTION,DIRECT_DL,FTP_PATH');
  url.searchParams.set('returnGeometry', 'false');
  url.searchParams.set('resultRecordCount', '10');
  return url.toString();
}

async function fetchJson(url, fetchImpl, timeoutMs) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw Object.assign(new Error(`NYS LiDAR index request failed: ${error instanceof Error ? error.message : 'network error'}`), { code: 'LIDAR_INDEX_UNAVAILABLE' });
  }

  if (!response?.ok) {
    throw Object.assign(new Error(`NYS LiDAR index returned HTTP ${response?.status || 'error'}.`), { code: 'LIDAR_INDEX_UNAVAILABLE' });
  }

  const body = await response.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    throw Object.assign(new Error('NYS LiDAR index returned an unreadable response.'), { code: 'LIDAR_INDEX_UNAVAILABLE' });
  }
  if (body.error) {
    throw Object.assign(new Error(`NYS LiDAR index query error: ${clean(body.error.message) || 'unknown ArcGIS error'}`), { code: 'LIDAR_INDEX_UNAVAILABLE' });
  }
  return body;
}

function normalizeTile(feature = {}) {
  const attributes = feature.attributes || feature.properties || {};
  return {
    objectId: clean(attributes.OBJECTID),
    filename: clean(attributes.FILENAME),
    sizeGb: numberOrNull(attributes.SIZE_GB),
    collection: clean(attributes.COLLECTION) || NYS_ERIE_LIDAR_COLLECTION,
    directDownloadUrl: clean(attributes.DIRECT_DL),
    ftpPath: clean(attributes.FTP_PATH),
  };
}

export async function fetchNysErieLidarCoverage(point = {}, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw Object.assign(new Error('No fetch implementation is available for the NYS LiDAR index.'), { code: 'LIDAR_INDEX_UNAVAILABLE' });
  }

  const latitude = finiteCoordinate(point.latitude, 'Latitude', -90, 90);
  const longitude = finiteCoordinate(point.longitude, 'Longitude', -180, 180);
  const observedAt = options.observedAt || new Date().toISOString();
  const queryUrl = buildNysErieLidarCoverageQuery({ latitude, longitude });
  const body = await fetchJson(queryUrl, fetchImpl, options.timeoutMs || 10000);
  const features = Array.isArray(body.features) ? body.features : [];
  const tiles = features.map(normalizeTile).filter((tile) => tile.filename || tile.directDownloadUrl || tile.ftpPath);

  return {
    ok: true,
    coverageStatus: tiles.length ? 'covered' : 'not_covered',
    point: { latitude, longitude },
    collection: NYS_ERIE_LIDAR_COLLECTION,
    tiles,
    // Discovering an authoritative LAS tile is evidence of LiDAR coverage only. It does not
    // become a building-height measurement until point-cloud samples are actually processed
    // against the official building footprint and a defensible ground reference.
    heightMeters: null,
    measurementStatus: tiles.length ? 'coverage_only' : 'no_coverage',
    measurementMethod: null,
    source: {
      authority: 'New York State ITS Geospatial Services',
      observedAt,
      sourceUrl: NYS_ERIE_LIDAR_INDEX_LAYER,
    },
    provenance: {
      queryUrl,
      layer: NYS_ERIE_LIDAR_INDEX_LAYER,
      collection: NYS_ERIE_LIDAR_COLLECTION,
    },
    legalEffects: {
      establishesParcelBoundary: false,
      establishesBuildingHeight: false,
      establishesDeedOwnership: false,
      createsBlockchainRights: false,
    },
  };
}
