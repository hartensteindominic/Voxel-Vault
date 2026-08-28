import {
  PROPERTY_RIGHT_TYPES,
  normalizePropertyTwin,
} from './property-twin.js';

export const ERIE_COUNTY_PARCEL_LAYER = 'https://gis.erie.gov/server/rest/services/OGIS/Parcels/MapServer/0';
export const ERIE_COUNTY_BUILDING_LAYER = 'https://gis.erie.gov/server/rest/services/DSM/DSM_Basemap_2025/MapServer/120';
export const ERIE_COUNTY_MAPPING_DISCLAIMER = 'https://gis.erie.gov/public/HTML5/ErieCountyNY/';

const PARCEL_FIELDS = [
  'OBJECTID',
  'GlobalID',
  'SWIS',
  'PIN',
  'SBL',
  'ADDNAME',
  'ADDRESS',
  'LOCALZIP',
  'CITYTOWN',
  'FRONT',
  'DEPTH',
  'ASSESSACRE',
  'CALCACRES',
  'CLASS',
  'PROP_TYPE',
  'PROP_DESC',
  'DEEDATE',
  'BOOK',
  'PAGE',
  'ACTIVE',
  'TOTAV',
  'LANDAV',
  'YEARBLT',
  'SFLA',
];

const BUILDING_FIELDS = [
  'OBJECTID_12',
  'OBJECTID',
  'GlobalID',
  'PIN',
  'SBL',
  'ADDNAME',
  'ADDRESS',
  'YEARBLT',
  'SFLA',
  'DATE_',
  'EDITEDDATE',
  'erie_DWQMADMIN_Building_AREA',
];

function clean(value) {
  return String(value ?? '').trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || clean(value) === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function valueFrom(attributes, ...keys) {
  for (const key of keys) {
    if (attributes && attributes[key] !== undefined && attributes[key] !== null) return attributes[key];
  }
  return null;
}

function exactParcelKey(value, label) {
  const normalized = clean(value).toUpperCase().replace(/\s+/g, '');
  if (!normalized) return '';
  if (normalized.length < 3 || normalized.length > 32 || !/^[A-Z0-9.-]+$/.test(normalized)) {
    throw Object.assign(new Error(`${label} may contain only letters, numbers, periods and hyphens.`), { code: 'INVALID_PARCEL_KEY' });
  }
  return normalized;
}

export function normalizeErieParcelLookup(input = {}) {
  const pin = exactParcelKey(input.pin, 'PIN');
  const sbl = exactParcelKey(input.sbl, 'SBL');
  if ((pin && sbl) || (!pin && !sbl)) {
    throw Object.assign(new Error('Provide exactly one Erie County parcel key: PIN or SBL.'), { code: 'INVALID_PARCEL_KEY' });
  }
  return pin ? { field: 'PIN', value: pin, pin, sbl: '' } : { field: 'SBL', value: sbl, pin: '', sbl };
}

function queryUrl(layer, field, value, outFields) {
  const url = new URL(`${layer}/query`);
  url.searchParams.set('f', 'geojson');
  url.searchParams.set('where', `${field}='${value}'`);
  url.searchParams.set('outFields', outFields.join(','));
  url.searchParams.set('returnGeometry', 'true');
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('resultRecordCount', '25');
  return url.toString();
}

function polygonCoordinates(geometry) {
  if (!geometry || typeof geometry !== 'object') return [];
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) return geometry.coordinates;
  return [];
}

function toArcGisPolygon(geometry) {
  const polygons = polygonCoordinates(geometry);
  const rings = polygons
    .flatMap((polygon) => Array.isArray(polygon) ? polygon : [])
    .filter((ring) => Array.isArray(ring) && ring.length >= 4)
    .map((ring) => ring
      .filter((pair) => Array.isArray(pair) && Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1])))
      .map((pair) => [Number(pair[0]), Number(pair[1])]))
    .filter((ring) => ring.length >= 4);

  if (!rings.length) return null;
  return { rings, spatialReference: { wkid: 4326 } };
}

function spatialBuildingQueryUrl(layer, parcelGeometry, outFields) {
  const geometry = toArcGisPolygon(parcelGeometry);
  if (!geometry) return '';

  const url = new URL(`${layer}/query`);
  url.searchParams.set('f', 'geojson');
  url.searchParams.set('where', '1=1');
  url.searchParams.set('geometry', JSON.stringify(geometry));
  url.searchParams.set('geometryType', 'esriGeometryPolygon');
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('outFields', outFields.join(','));
  url.searchParams.set('returnGeometry', 'true');
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('resultRecordCount', '100');
  return url.toString();
}

async function fetchGeoJson(url, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/geo+json, application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw Object.assign(new Error(`Erie County GIS request failed: ${error instanceof Error ? error.message : 'network error'}`), { code: 'GIS_UNAVAILABLE' });
  }

  if (!response?.ok) {
    throw Object.assign(new Error(`Erie County GIS returned HTTP ${response?.status || 'error'}.`), { code: 'GIS_UNAVAILABLE' });
  }

  const data = await response.json().catch(() => null);
  if (!data || typeof data !== 'object') {
    throw Object.assign(new Error('Erie County GIS returned an unreadable response.'), { code: 'GIS_UNAVAILABLE' });
  }
  if (data.error) {
    throw Object.assign(new Error(`Erie County GIS query error: ${clean(data.error.message) || 'unknown ArcGIS error'}`), { code: 'GIS_UNAVAILABLE' });
  }
  return data;
}

function featuresFrom(data) {
  return Array.isArray(data?.features) ? data.features : [];
}

function combinePolygonFeatures(features) {
  const polygons = features.flatMap((feature) => polygonCoordinates(feature?.geometry));
  if (!polygons.length) return null;
  return polygons.length === 1
    ? { type: 'Polygon', coordinates: polygons[0] }
    : { type: 'MultiPolygon', coordinates: polygons };
}

function collectCoordinatePairs(value, output = []) {
  if (!Array.isArray(value)) return output;
  if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
    output.push([Number(value[0]), Number(value[1])]);
    return output;
  }
  for (const child of value) collectCoordinatePairs(child, output);
  return output;
}

export function geometryReferencePoint(geometry) {
  const pairs = collectCoordinatePairs(geometry?.coordinates);
  if (!pairs.length) return { latitude: null, longitude: null };
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of pairs) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
  };
}

function sourceRecordId(attributes) {
  const pin = clean(attributes?.PIN);
  const sbl = clean(attributes?.SBL);
  const objectId = clean(valueFrom(attributes, 'OBJECTID', 'OBJECTID_12'));
  return [pin || sbl || 'building', objectId ? `object-${objectId}` : ''].filter(Boolean).join(':');
}

function isoFromArcGisDate(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '';
  try {
    return new Date(number).toISOString();
  } catch {
    return '';
  }
}

export async function fetchErieCountySpatialIntake(input = {}, options = {}) {
  const lookup = normalizeErieParcelLookup(input);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw Object.assign(new Error('No fetch implementation is available for Erie County GIS.'), { code: 'GIS_UNAVAILABLE' });
  }

  const observedAt = options.observedAt || new Date().toISOString();
  const parcelQuery = queryUrl(ERIE_COUNTY_PARCEL_LAYER, lookup.field, lookup.value, PARCEL_FIELDS);
  const parcelData = await fetchGeoJson(parcelQuery, fetchImpl);
  const parcelFeatures = featuresFrom(parcelData);
  if (!parcelFeatures.length) {
    throw Object.assign(new Error(`No Erie County parcel matched ${lookup.field} ${lookup.value}.`), { code: 'PARCEL_NOT_FOUND' });
  }
  if (parcelFeatures.length !== 1) {
    throw Object.assign(new Error(`Erie County GIS returned ${parcelFeatures.length} parcel matches; exact identity is ambiguous.`), { code: 'AMBIGUOUS_PARCEL' });
  }

  const parcel = parcelFeatures[0];
  const attributes = parcel?.properties || {};
  const pin = clean(attributes.PIN) || lookup.pin;
  const sbl = clean(attributes.SBL) || lookup.sbl;
  const canonicalField = pin ? 'PIN' : 'SBL';
  const canonicalValue = pin || sbl;

  if (!canonicalValue) {
    throw Object.assign(new Error('Matched Erie County parcel did not include a PIN or SBL.'), { code: 'GIS_UNAVAILABLE' });
  }

  const buildingAttributeQuery = queryUrl(ERIE_COUNTY_BUILDING_LAYER, canonicalField, canonicalValue, BUILDING_FIELDS);
  let buildingQuery = buildingAttributeQuery;
  let buildingMatchStrategy = `${canonicalField.toLowerCase()}-attribute`;
  let buildingData = await fetchGeoJson(buildingAttributeQuery, fetchImpl);
  let buildingFeatures = featuresFrom(buildingData);

  // Some records in the BUILDING layer do not carry the same joined parcel identifier even
  // though their official footprint intersects the official parcel polygon. In that case,
  // use an ArcGIS polygon-intersection query against the already-resolved parcel geometry.
  // This stays source-to-source and never falls back to a guessed address or generic model.
  let buildingSpatialQuery = '';
  if (!buildingFeatures.length) {
    buildingSpatialQuery = spatialBuildingQueryUrl(ERIE_COUNTY_BUILDING_LAYER, parcel?.geometry, BUILDING_FIELDS);
    if (buildingSpatialQuery) {
      buildingData = await fetchGeoJson(buildingSpatialQuery, fetchImpl);
      buildingFeatures = featuresFrom(buildingData);
      buildingQuery = buildingSpatialQuery;
      buildingMatchStrategy = 'parcel-polygon-intersection';
    }
  }

  const buildingGeometry = combinePolygonFeatures(buildingFeatures);
  const referencePoint = geometryReferencePoint(parcel?.geometry);

  const buildingEditTimes = buildingFeatures
    .map((feature) => isoFromArcGisDate(valueFrom(feature?.properties || {}, 'EDITEDDATE', 'DATE_')))
    .filter(Boolean)
    .sort();
  const latestBuildingEdit = buildingEditTimes.at(-1) || '';

  const twin = normalizePropertyTwin({
    propertyId: `ERIE:${pin || sbl}`,
    label: clean(attributes.ADDNAME) || clean(attributes.ADDRESS) || `Erie County parcel ${sbl || pin}`,
    addressLabel: [clean(attributes.ADDRESS) || clean(attributes.ADDNAME), clean(attributes.CITYTOWN), 'NY', clean(attributes.LOCALZIP)].filter(Boolean).join(' · '),
    identity: {
      countryCode: 'US',
      subdivisionCode: 'NY',
      countyCode: 'ERIE',
      parcelId: pin || sbl,
      fingerprint: '',
    },
    location: {
      latitude: referencePoint.latitude,
      longitude: referencePoint.longitude,
      parcelGeometry: parcel?.geometry || null,
      source: {
        authority: 'Erie County Office of GIS / Real Property Tax Services',
        recordId: sourceRecordId(attributes),
        observedAt,
        sourceUrl: ERIE_COUNTY_PARCEL_LAYER,
      },
    },
    structure: {
      buildingGeometry,
      // The county layer exposes footprint and joined property attributes, but no verified
      // building height. Leaving height null intentionally prevents physical verification.
      heightMeters: null,
      floors: null,
      grossAreaSqFt: numberOrNull(attributes.SFLA),
      yearBuilt: numberOrNull(attributes.YEARBLT),
      source: buildingGeometry ? {
        authority: 'Erie County Office of GIS — BUILDING layer',
        recordId: buildingFeatures.map((feature) => sourceRecordId(feature?.properties || {})).join(','),
        observedAt: latestBuildingEdit || observedAt,
        sourceUrl: ERIE_COUNTY_BUILDING_LAYER,
      } : {},
    },
    rights: {
      type: PROPERTY_RIGHT_TYPES.REFERENCE_ONLY,
    },
  });

  return {
    ok: true,
    lookup,
    twin,
    countyRecord: {
      pin,
      sbl,
      swis: clean(attributes.SWIS),
      parcelAddress: clean(attributes.ADDRESS) || clean(attributes.ADDNAME),
      municipality: clean(attributes.CITYTOWN),
      zip: clean(attributes.LOCALZIP),
      propertyClass: clean(attributes.CLASS),
      propertyType: clean(attributes.PROP_TYPE),
      propertyDescription: clean(attributes.PROP_DESC),
      frontageFt: numberOrNull(attributes.FRONT),
      depthFt: numberOrNull(attributes.DEPTH),
      assessedAcres: numberOrNull(attributes.ASSESSACRE),
      calculatedAcres: numberOrNull(attributes.CALCACRES),
      totalAssessedValueUsd: numberOrNull(attributes.TOTAV),
      landAssessedValueUsd: numberOrNull(attributes.LANDAV),
      yearBuilt: numberOrNull(attributes.YEARBLT),
      livingAreaSqFt: numberOrNull(attributes.SFLA),
      deedDateReference: clean(attributes.DEEDATE),
      deedBookReference: clean(attributes.BOOK),
      deedPageReference: clean(attributes.PAGE),
      activeFlag: clean(attributes.ACTIVE),
      buildingFootprintCount: buildingFeatures.length,
      buildingMatchStrategy,
    },
    provenance: {
      observedAt,
      parcelLayer: ERIE_COUNTY_PARCEL_LAYER,
      buildingLayer: ERIE_COUNTY_BUILDING_LAYER,
      mappingDisclaimer: ERIE_COUNTY_MAPPING_DISCLAIMER,
      parcelQuery,
      buildingQuery,
      buildingAttributeQuery,
      buildingSpatialQuery,
      buildingMatchStrategy,
    },
    legalEffects: {
      isLegalSurvey: false,
      establishesParcelBoundary: false,
      establishesDeedOwnership: false,
      establishesTitleStatus: false,
      establishesFractionalSecurityRights: false,
      createsBlockchainRights: false,
    },
    sourceLimitations: [
      'Erie County GIS is used as a source-backed spatial and tax-record reference, not as a legal survey.',
      'Displayed coordinates and parcel polygons do not establish legal parcel corners or conveyance boundaries.',
      'Assessed values are not treated as market valuations or guaranteed investment values.',
      'Deed book/page fields are reference leads only; title ownership and encumbrances require authoritative closing/title evidence.',
      buildingMatchStrategy === 'parcel-polygon-intersection'
        ? 'The BUILDING footprint was matched by spatial intersection with the official parcel polygon because its joined parcel identifier did not produce a direct match.'
        : 'The BUILDING footprint was matched by the county-returned parcel identifier.',
      'Building footprint data does not include a verified height, so full physical 3D verification remains incomplete.',
    ],
  };
}
