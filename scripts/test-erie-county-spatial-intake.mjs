import assert from 'node:assert/strict';
import {
  ERIE_COUNTY_BUILDING_LAYER,
  ERIE_COUNTY_PARCEL_LAYER,
  fetchErieCountySpatialIntake,
  normalizeErieParcelLookup,
} from '../lib/real-estate/erie-county-gis.js';

const parcelGeometry = {
  type: 'Polygon',
  coordinates: [[
    [-78.8800, 42.8850],
    [-78.8780, 42.8850],
    [-78.8780, 42.8870],
    [-78.8800, 42.8870],
    [-78.8800, 42.8850],
  ]],
};

const buildingGeometry = {
  type: 'Polygon',
  coordinates: [[
    [-78.8795, 42.8855],
    [-78.8787, 42.8855],
    [-78.8787, 42.8864],
    [-78.8795, 42.8864],
    [-78.8795, 42.8855],
  ]],
};

const broadSpatialCandidate = {
  type: 'Polygon',
  coordinates: [[
    [-78.8830, 42.8830],
    [-78.8750, 42.8830],
    [-78.8750, 42.8900],
    [-78.8830, 42.8900],
    [-78.8830, 42.8830],
  ]],
};

function parcelFeature() {
  return {
    type: 'Feature',
    geometry: parcelGeometry,
    properties: {
      OBJECTID: 1001,
      GlobalID: 'parcel-guid',
      SWIS: '140200',
      PIN: '140200-101-01-001.000',
      SBL: '101.01-1-1',
      ADDNAME: '10 TEST STREET',
      ADDRESS: '10 TEST STREET',
      LOCALZIP: '14202',
      CITYTOWN: 'BUFFALO',
      FRONT: 40,
      DEPTH: 110,
      ASSESSACRE: 0.1,
      CALCACRES: 0.101,
      CLASS: '210',
      PROP_TYPE: 'Residential',
      PROP_DESC: 'One family residence',
      DEEDATE: '2024-01-15',
      BOOK: '9999',
      PAGE: '123',
      ACTIVE: 'A',
      TOTAV: 150000,
      LANDAV: 18000,
      YEARBLT: 1920,
      SFLA: 1650,
      OWNER1: 'SHOULD NOT LEAK',
      OWNER2: 'ALSO SHOULD NOT LEAK',
      MAILADDR: 'PRIVATE MAILING ADDRESS',
    },
  };
}

function jsonResponse(features) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { type: 'FeatureCollection', features };
    },
  };
}

const calls = [];
const mockFetch = async (url) => {
  calls.push(String(url));
  if (String(url).startsWith(`${ERIE_COUNTY_PARCEL_LAYER}/query`)) {
    return jsonResponse([parcelFeature()]);
  }

  if (String(url).startsWith(`${ERIE_COUNTY_BUILDING_LAYER}/query`)) {
    return jsonResponse([{
      type: 'Feature',
      geometry: buildingGeometry,
      properties: {
        OBJECTID_12: 501,
        PIN: '140200-101-01-001.000',
        SBL: '101.01-1-1',
        ADDRESS: '10 TEST STREET',
        YEARBLT: 1920,
        SFLA: 1650,
        EDITEDDATE: Date.parse('2026-05-01T12:00:00Z'),
        erie_DWQMADMIN_Building_AREA: 1200,
      },
    }]);
  }

  throw new Error(`Unexpected outbound URL in test: ${url}`);
};

assert.deepEqual(
  normalizeErieParcelLookup({ sbl: '101.01-1-1' }),
  { field: 'SBL', value: '101.01-1-1', pin: '', sbl: '101.01-1-1' },
  'SBL should normalize into an exact controlled lookup'
);
assert.throws(
  () => normalizeErieParcelLookup({ pin: "1' OR '1'='1" }),
  /only letters, numbers, periods and hyphens/,
  'SQL-like input must be rejected before an ArcGIS where clause is built'
);
assert.throws(
  () => normalizeErieParcelLookup({ pin: 'A-1', sbl: 'B-2' }),
  /exactly one Erie County parcel key/,
  'callers cannot provide competing parcel keys'
);

const result = await fetchErieCountySpatialIntake(
  { sbl: '101.01-1-1' },
  { fetchImpl: mockFetch, observedAt: '2026-08-28T12:30:00Z' }
);

assert.equal(calls.length, 2, 'direct parcel-linked intake should make one parcel query and one building query');
assert.ok(calls[0].startsWith(`${ERIE_COUNTY_PARCEL_LAYER}/query?`), 'parcel query must use the allowlisted official parcel layer');
assert.ok(calls[1].startsWith(`${ERIE_COUNTY_BUILDING_LAYER}/query?`), 'building query must use the allowlisted official building layer');

const parcelQuery = new URL(calls[0]);
const buildingQuery = new URL(calls[1]);
assert.equal(parcelQuery.searchParams.get('where'), "SBL='101.01-1-1'");
assert.equal(parcelQuery.searchParams.get('outSR'), '4326');
assert.equal(parcelQuery.searchParams.get('f'), 'geojson');
assert.equal(buildingQuery.searchParams.get('where'), "PIN='140200-101-01-001.000'", 'building lookup should prefer the county-returned canonical PIN');
assert.equal(buildingQuery.searchParams.get('outSR'), '4326');

assert.equal(result.ok, true);
assert.equal(result.countyRecord.sbl, '101.01-1-1');
assert.equal(result.countyRecord.pin, '140200-101-01-001.000');
assert.equal(result.countyRecord.totalAssessedValueUsd, 150000);
assert.equal(result.countyRecord.landAssessedValueUsd, 18000);
assert.equal(result.countyRecord.yearBuilt, 1920);
assert.equal(result.countyRecord.livingAreaSqFt, 1650);
assert.equal(result.countyRecord.buildingFootprintCount, 1);
assert.equal(result.countyRecord.buildingCandidateCount, 0);
assert.equal(result.countyRecord.buildingMatchStrategy, 'pin-attribute');
assert.equal(result.twin.location.parcelGeometry.type, 'Polygon');
assert.equal(result.twin.structure.buildingGeometry.type, 'Polygon');
assert.equal(result.twin.structure.heightMeters, null, 'height must remain unknown rather than inferred');
assert.equal(result.twin.rights.type, 'reference_only');
assert.equal(result.twin.verification.geography, 'verified', 'source-backed county parcel geometry may pass the platform geographic truth layer');
assert.equal(result.twin.verification.physical, 'partial', 'direct parcel-linked footprint without authoritative height must not pass physical 3D verification');
assert.equal(result.twin.verification.rights, 'unverified');
assert.equal(result.twin.verification.fullyVerified, false);

assert.ok(Object.values(result.legalEffects).every((value) => value === false), 'GIS intake must create no legal/title/blockchain rights');
assert.match(result.sourceLimitations.join(' '), /not as a legal survey/i);
assert.match(result.sourceLimitations.join(' '), /not treated as market valuations/i);
assert.match(result.sourceLimitations.join(' '), /title ownership and encumbrances require authoritative closing\/title evidence/i);

const serialized = JSON.stringify(result);
assert.equal(serialized.includes('SHOULD NOT LEAK'), false, 'county owner names must not be returned by the intake adapter');
assert.equal(serialized.includes('PRIVATE MAILING ADDRESS'), false, 'county owner mailing details must not be returned by the intake adapter');
assert.equal(parcelQuery.searchParams.get('outFields').includes('OWNER1'), false, 'owner identity fields should not even be requested from the county layer');
assert.equal(parcelQuery.searchParams.get('outFields').includes('MAIL'), false, 'mailing fields should not be requested from the county layer');

const fallbackCalls = [];
const fallbackFetch = async (url) => {
  fallbackCalls.push(String(url));
  if (String(url).startsWith(`${ERIE_COUNTY_PARCEL_LAYER}/query`)) {
    return jsonResponse([parcelFeature()]);
  }
  if (String(url).startsWith(`${ERIE_COUNTY_BUILDING_LAYER}/query`)) {
    const parsed = new URL(String(url));
    if (!parsed.searchParams.get('geometry')) return jsonResponse([]);
    return jsonResponse([{
      type: 'Feature',
      geometry: broadSpatialCandidate,
      properties: {
        OBJECTID: 9999,
        PIN: null,
        SBL: null,
        ADDRESS: null,
        ADDNAME: null,
      },
    }]);
  }
  throw new Error(`Unexpected outbound URL in fallback test: ${url}`);
};

const fallbackResult = await fetchErieCountySpatialIntake(
  { sbl: '101.01-1-1' },
  { fetchImpl: fallbackFetch, observedAt: '2026-08-28T12:31:00Z' }
);

assert.equal(fallbackCalls.length, 3, 'missing direct BUILDING join should perform parcel, exact building, then diagnostic spatial-candidate query');
const fallbackAttributeQuery = new URL(fallbackCalls[1]);
const fallbackSpatialQuery = new URL(fallbackCalls[2]);
assert.equal(fallbackAttributeQuery.searchParams.get('where'), "PIN='140200-101-01-001.000'");
assert.equal(fallbackAttributeQuery.searchParams.has('geometry'), false, 'exact BUILDING lookup must not be a spatial guess');
assert.equal(fallbackSpatialQuery.searchParams.get('spatialRel'), 'esriSpatialRelIntersects');
assert.ok(fallbackSpatialQuery.searchParams.get('geometry'), 'diagnostic spatial query must use the already-resolved parcel polygon');

assert.equal(fallbackResult.countyRecord.buildingFootprintCount, 0, 'spatial-only candidate must never count as an accepted parcel building footprint');
assert.equal(fallbackResult.countyRecord.buildingCandidateCount, 1, 'spatial-only candidate may be retained for diagnosis');
assert.equal(fallbackResult.countyRecord.buildingMatchStrategy, 'spatial-candidates-unverified');
assert.equal(fallbackResult.twin.structure.buildingGeometry, null, 'spatial-only candidate must not enter the property twin');
assert.equal(fallbackResult.twin.structure.source.authority, '', 'rejected candidate must not supply authoritative structure lineage');
assert.equal(fallbackResult.twin.structure.source.recordId, '');
assert.equal(fallbackResult.twin.verification.geography, 'verified');
assert.equal(fallbackResult.twin.verification.physical, 'unverified', 'physical truth must fail closed without a parcel-linked building footprint');
assert.equal(fallbackResult.twin.verification.verifiedSpatialTwin, false);
assert.equal(fallbackResult.twin.verification.fullyVerified, false);
assert.equal(fallbackResult.provenance.spatialCandidateRecordIds.length, 1, 'candidate record ID should be retained for diagnosis');
assert.match(fallbackResult.sourceLimitations.join(' '), /retained only as unverified candidates and are not used/i);

console.log('Erie County spatial intake safety checks passed: exact parcel-linked BUILDING geometry may be partial physical evidence; spatial-intersection-only polygons fail closed as diagnostic candidates, with reference-only rights, no owner mailing data, and no legal/title effect.');
