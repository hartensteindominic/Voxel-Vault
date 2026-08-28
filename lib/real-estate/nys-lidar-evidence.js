export const NYS_LIDAR_INDEX_SERVICE = 'https://elevation.its.ny.gov/arcgis/rest/services/LAS_Indexes/FeatureServer';
export const NYS_ERIE_LIDAR_COLLECTION = 'NYS - Erie, Genesee, Livingston 2019';
export const NYS_ERIE_LIDAR_INDEX_LAYER = `${NYS_LIDAR_INDEX_SERVICE}/7`;

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

export async function discoverNysErieLidarLayer(fetchImpl = globalThis.fetch, timeoutMs = 10000) {
  if (typeof fetchImpl !== 'function') {
    throw Object.assign(new Error('No fetch implementation is available for the NYS LiDAR index.'), { code: 'LIDAR_INDEX_UNAVAILABLE' });
  }

  const serviceUrl = new URL(NYS_LIDAR_INDEX_SERVICE);
  serviceUrl.searchParams.set('f', 'json');
  const service = await fetchJson(serviceUrl.toString(), fetchImpl, timeoutMs);
  const layers = Array.isArray(service.layers) ? service.layers : [];
  const matches = layers.filter((layer) => clean(layer?.name) === NYS_ERIE_LIDAR_COLLECTION);

  if (matches.length !== 1 || !Number.isInteger(Number(matches[0]?.id))) {
    throw Object.assign(
      new Error(`NYS LiDAR index must expose exactly one layer named "${NYS_ERIE_LIDAR_COLLECTION}"; found ${matches.length}.`),
      { code: 'LIDAR_COLLECTION_NOT_FOUND' },
    );
  }

  const layerId = Number(matches[0].id);
  return {
    id: layerId,
    name: clean(matches[0].name),
    geometryType: clean(matches[0].geometryType),
    layerUrl: `${NYS_LIDAR_INDEX_SERVICE}/${layerId}`,
    serviceUrl: NYS_LIDAR_INDEX_SERVICE,
  };
}

export function buildNysErieLidarCoverageQuery(point = {}, layerUrl = NYS_ERIE_LIDAR_INDEX_LAYER) {
  const latitude = finiteCoordinate(point.latitude, 'Latitude', -90, 90);
  const longitude = finiteCoordinate(point.longitude, 'Longitude', -180, 180);

  const url = new URL(`${layerUrl}/query`);
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
  const timeoutMs = options.timeoutMs || 10000;

  // The state periodically republishes this FeatureServer and layer IDs can shift. Resolve the
  // authoritative collection by its exact official name on every live evidence read instead of
  // silently trusting a stale numeric layer ID. This caught the July 2026 move from layer 6 to 7.
  const resolvedLayer = await discoverNysErieLidarLayer(fetchImpl, timeoutMs);
  if (resolvedLayer.geometryType && resolvedLayer.geometryType !== 'esriGeometryPolygon') {
    throw Object.assign(new Error(`NYS LiDAR collection has unexpected geometry type ${resolvedLayer.geometryType}.`), { code: 'LIDAR_COLLECTION_INVALID' });
  }

  const queryUrl = buildNysErieLidarCoverageQuery({ latitude, longitude }, resolvedLayer.layerUrl);
  const body = await fetchJson(queryUrl, fetchImpl, timeoutMs);
  const features = Array.isArray(body.features) ? body.features : [];
  const tiles = features.map(normalizeTile).filter((tile) => tile.filename || tile.directDownloadUrl || tile.ftpPath);

  return {
    ok: true,
    coverageStatus: tiles.length ? 'covered' : 'not_covered',
    point: { latitude, longitude },
    collection: NYS_ERIE_LIDAR_COLLECTION,
    resolvedLayer,
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
      sourceUrl: resolvedLayer.layerUrl,
    },
    provenance: {
      queryUrl,
      service: NYS_LIDAR_INDEX_SERVICE,
      resolvedLayerId: resolvedLayer.id,
      resolvedLayerName: resolvedLayer.name,
      layer: resolvedLayer.layerUrl,
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
