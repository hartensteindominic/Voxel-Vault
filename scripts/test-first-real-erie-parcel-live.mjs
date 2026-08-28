import assert from 'node:assert/strict';
import {
  FIRST_REAL_ERIE_PARCEL,
  fetchFirstRealErieParcel,
} from '../lib/real-estate/erie-county-evidence.js';
import { ERIE_COUNTY_PARCEL_LAYER } from '../lib/real-estate/erie-county-gis.js';
import {
  NYS_ERIE_LIDAR_COLLECTION,
  NYS_ERIE_LIDAR_INDEX_LAYER,
  fetchNysErieLidarCoverage,
} from '../lib/real-estate/nys-lidar-evidence.js';
import {
  PROPERTY_RIGHT_TYPES,
  PROPERTY_TRUTH_STATES,
  assertSpatialInvariants,
} from '../lib/real-estate/property-twin.js';

async function discoverAddressCandidates() {
  const url = new URL(`${ERIE_COUNTY_PARCEL_LAYER}/query`);
  url.searchParams.set('f', 'json');
  url.searchParams.set('where', "ADDRESS LIKE '%618%MAIN%'");
  url.searchParams.set('outFields', 'OBJECTID,PIN,SBL,ADDNAME,ADDRESS,CITYTOWN,LOCALZIP');
  url.searchParams.set('returnGeometry', 'false');
  url.searchParams.set('resultRecordCount', '25');
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  const body = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, body };
}

async function loadWithRetry() {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetchFirstRealErieParcel();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  if (lastError?.code === 'PARCEL_NOT_FOUND') {
    const diagnostic = await discoverAddressCandidates().catch((error) => ({ diagnosticError: error instanceof Error ? error.message : String(error) }));
    console.error('ERIE_IDENTIFIER_DIAGNOSTIC', JSON.stringify(diagnostic, null, 2));
  }
  throw lastError;
}

async function loadLidarWithRetry(point) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetchNysErieLidarCoverage(point);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw lastError;
}

const result = await loadWithRetry();
const { twin, countyRecord, provenance, truthLabels, identifierCrossReference } = result;

assert.equal(result.ok, true, 'official Erie County intake must succeed for the forcing-function parcel');
assert.equal(countyRecord.sbl, FIRST_REAL_ERIE_PARCEL.countySbl, 'county result must match the formatted Erie County SBL');
assert.equal(countyRecord.pin, FIRST_REAL_ERIE_PARCEL.pin, 'county result must match the exact known PIN');
assert.equal(identifierCrossReference.cityScheduleRawSbl, FIRST_REAL_ERIE_PARCEL.cityScheduleRawSbl, 'raw City schedule SBL must remain preserved as a separate cross-reference');
assert.notEqual(FIRST_REAL_ERIE_PARCEL.cityScheduleRawSbl, FIRST_REAL_ERIE_PARCEL.countySbl, 'raw City schedule SBL must not be reused as the County query representation');
assert.match(countyRecord.parcelAddress || '', /618/i, 'county result must still identify street number 618');
assert.match(countyRecord.parcelAddress || '', /MAIN/i, 'county result must still identify Main Street');
assert.match(countyRecord.municipality || '', /Buffalo/i, 'county result must identify City of Buffalo');

assert.ok(twin.location.parcelGeometry, 'official parcel polygon must be present');
assert.ok(['Polygon', 'MultiPolygon'].includes(twin.location.parcelGeometry.type), 'parcel geometry must be polygonal');
assert.ok(twin.structure.buildingGeometry, 'official building footprint must be present for the first parcel');
assert.ok(['Polygon', 'MultiPolygon'].includes(twin.structure.buildingGeometry.type), 'building footprint must be polygonal');
assert.ok(countyRecord.buildingFootprintCount > 0, 'at least one building footprint must match the parcel');

assert.equal(twin.verification.geography, PROPERTY_TRUTH_STATES.VERIFIED, 'the live county record must pass geographic truth');
assert.equal(twin.verification.physical, PROPERTY_TRUTH_STATES.PARTIAL, 'physical truth must remain partial until measured height exists');
assert.equal(twin.verification.heightStatus, 'explicitly_unavailable', 'height absence must be explicit rather than silent');
assert.equal(twin.structure.heightMeters, null, 'no height may be invented');
assert.match(twin.structure.heightUnavailableReason, /no authoritative measured building height/i);
assert.equal(twin.verification.verifiedSpatialTwin, false, 'no full spatial verification without measured height');

assert.equal(twin.rights.type, PROPERTY_RIGHT_TYPES.REFERENCE_ONLY, 'county GIS must never create ownership rights');
assert.equal(twin.verification.rights, PROPERTY_TRUTH_STATES.UNVERIFIED);
assert.equal(twin.verification.verifiedOwnership, false);
assert.equal(twin.verification.fullyVerified, false);
assert.equal(truthLabels.geography, 'GEO VERIFIED');
assert.match(truthLabels.physical, /PHYSICAL PARTIAL/);
assert.equal(truthLabels.ownership, 'OWNERSHIP NOT VERIFIED');
assertSpatialInvariants(twin);

assert.match(twin.location.source.authority, /Erie County/i, 'parcel lineage must name Erie County');
assert.match(twin.structure.source.authority, /Erie County/i, 'building lineage must name Erie County');
assert.ok(twin.location.source.recordId, 'parcel lineage record ID must be populated');
assert.ok(twin.structure.source.recordId, 'building lineage record ID must be populated');
assert.ok(twin.location.source.observedAt, 'parcel observation time must be populated');
assert.ok(twin.structure.source.observedAt, 'building observation time must be populated');
assert.ok(provenance?.parcelLayer, 'official parcel layer URL must be retained');
assert.ok(provenance?.buildingLayer, 'official building layer URL must be retained');

const lidar = await loadLidarWithRetry({
  latitude: twin.location.latitude,
  longitude: twin.location.longitude,
});

assert.equal(lidar.ok, true, 'official NYS LiDAR index query must succeed for 618 Main');
assert.equal(lidar.collection, NYS_ERIE_LIDAR_COLLECTION, 'the first parcel must use the Erie/Genesee/Livingston 2019 collection');
assert.equal(lidar.coverageStatus, 'covered', 'the 618 Main reference point must intersect at least one official LAS tile');
assert.ok(lidar.tiles.length > 0, 'at least one authoritative LAS tile must cover the parcel reference point');
assert.ok(lidar.tiles.some((tile) => tile.filename), 'covered LAS evidence must include an official filename');
assert.ok(lidar.tiles.some((tile) => tile.directDownloadUrl || tile.ftpPath), 'covered LAS evidence must retain a downloadable source reference');
assert.equal(lidar.heightMeters, null, 'LiDAR coverage alone must not be promoted into a measured building height');
assert.equal(lidar.measurementStatus, 'coverage_only', 'LiDAR must remain coverage-only until point-cloud measurement runs');
assert.equal(lidar.measurementMethod, null, 'no measurement method may be claimed before LAS processing');
assert.equal(lidar.legalEffects.establishesBuildingHeight, false, 'tile discovery alone must not establish building height');
assert.equal(lidar.legalEffects.establishesDeedOwnership, false, 'LiDAR can never establish deed ownership');
assert.equal(lidar.source.sourceUrl, NYS_ERIE_LIDAR_INDEX_LAYER, 'LiDAR lineage must retain the official NYS index layer');

console.log(JSON.stringify({
  forcingFunction: 'first-real-erie-parcel',
  propertyId: twin.propertyId,
  label: twin.label,
  countySbl: countyRecord.sbl,
  cityScheduleRawSbl: identifierCrossReference.cityScheduleRawSbl,
  pin: countyRecord.pin,
  address: countyRecord.parcelAddress,
  municipality: countyRecord.municipality,
  buildingFootprintCount: countyRecord.buildingFootprintCount,
  geography: twin.verification.geography,
  physical: twin.verification.physical,
  heightStatus: twin.verification.heightStatus,
  verifiedSpatialTwin: twin.verification.verifiedSpatialTwin,
  ownership: twin.verification.verifiedOwnership,
  parcelSource: twin.location.source,
  buildingSource: twin.structure.source,
  lidar: {
    collection: lidar.collection,
    coverageStatus: lidar.coverageStatus,
    measurementStatus: lidar.measurementStatus,
    tileCount: lidar.tiles.length,
    tiles: lidar.tiles,
    source: lidar.source,
  },
}, null, 2));
