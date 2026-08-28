import { createHash } from 'node:crypto';
import { FIRST_REAL_ERIE_PARCEL } from './erie-county-evidence.js';

export const FIRST_REAL_ERIE_LIDAR_ALGORITHM = 'nys-las-roof-p95-minus-ground-median-v1';
export const FIRST_REAL_ERIE_LIDAR_TILE = 'e1383n2335_2019.las';
export const MAX_ACCEPTED_LIDAR_HEIGHT_UNCERTAINTY_METERS = 3;

function clean(value) {
  return String(value ?? '').trim();
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return value;
}

export function sha256CanonicalJson(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(`LiDAR height evidence rejected: ${message}`);
}

function requireFalse(value, label) {
  requireCondition(value === false, `${label} must be explicitly false`);
}

export function validateFirstRealErieLidarHeightEvidence(evidence = {}, currentTwin = null) {
  const property = evidence.property || {};
  const measurement = evidence.measurement || {};
  const algorithm = evidence.algorithm || {};
  const statistics = evidence.statistics || {};
  const sources = evidence.sources || {};
  const lasTile = sources.lasTile || {};
  const footprintSource = sources.buildingFootprint || {};
  const parcelSource = sources.parcel || {};
  const legalEffects = evidence.legalEffects || {};

  requireCondition(Number(evidence.schemaVersion) === 1, 'schemaVersion must equal 1');
  requireCondition(clean(property.propertyId) === `ERIE:${FIRST_REAL_ERIE_PARCEL.pin}`, 'propertyId does not match the first real Erie parcel');
  requireCondition(clean(property.pin) === FIRST_REAL_ERIE_PARCEL.pin, 'PIN does not match 618 Main');
  requireCondition(clean(property.countySbl) === FIRST_REAL_ERIE_PARCEL.countySbl, 'County SBL does not match 618 Main');

  requireCondition(clean(algorithm.id) === FIRST_REAL_ERIE_LIDAR_ALGORITHM, 'measurement algorithm is not the reviewed algorithm');
  requireCondition(clean(algorithm.roofCandidateMethod) === 'classification_6_building', 'automatic verification requires class-6 building returns; fallback roof candidates remain review-only');

  const heightMeters = finiteNumber(measurement.heightMeters);
  const uncertaintyMeters = finiteNumber(measurement.uncertaintyMeters);
  requireCondition(clean(measurement.status) === 'measured', 'measurement status must be measured');
  requireCondition(measurement.qualityGatePassed === true, 'quality gate must pass');
  requireCondition(heightMeters !== null && heightMeters >= 2 && heightMeters <= 120, 'height must be a finite 2-120 meter measurement');
  requireCondition(uncertaintyMeters !== null && uncertaintyMeters >= 0 && uncertaintyMeters <= MAX_ACCEPTED_LIDAR_HEIGHT_UNCERTAINTY_METERS, 'uncertainty exceeds the accepted limit');
  requireCondition(Number.isFinite(Date.parse(clean(measurement.measuredAt))), 'measuredAt must be an ISO timestamp');

  requireCondition(Number(statistics.groundPointCount) >= 50, 'ground point count is insufficient');
  requireCondition(Number(statistics.preferredBuildingClassPointCount) >= 100, 'class-6 building point count is insufficient');
  requireCondition(Number(statistics.usableRoofPointCount) >= 100, 'usable roof point count is insufficient');

  requireCondition(clean(lasTile.filename) === FIRST_REAL_ERIE_LIDAR_TILE, 'LAS filename does not match the reviewed 618 Main tile');
  requireCondition(/^https:\/\/gisdata\.ny\.gov\//i.test(clean(lasTile.directDownloadUrl)), 'LAS source must be the official gisdata.ny.gov HTTPS host');
  requireCondition(clean(lasTile.directDownloadUrl).endsWith(`/${FIRST_REAL_ERIE_LIDAR_TILE}`), 'LAS URL does not end in the reviewed tile filename');
  requireCondition(/^[a-f0-9]{64}$/i.test(clean(lasTile.sha256)), 'LAS SHA-256 is missing or invalid');
  requireCondition(Number(lasTile.downloadedBytes) > 100_000_000, 'downloaded LAS byte count is implausibly small');

  requireCondition(/Erie County/i.test(clean(footprintSource.authority)), 'building footprint authority must remain Erie County');
  requireCondition(/^https:\/\/gis\.erie\.gov\//i.test(clean(footprintSource.sourceUrl)), 'building footprint must retain the official Erie County source URL');
  requireCondition(/Erie County/i.test(clean(parcelSource.authority)), 'parcel authority must remain Erie County');
  requireCondition(/^https:\/\/gis\.erie\.gov\//i.test(clean(parcelSource.sourceUrl)), 'parcel must retain the official Erie County source URL');
  requireCondition(/^[a-f0-9]{64}$/i.test(clean(footprintSource.geometrySha256)), 'building footprint geometry hash is required');
  requireCondition(/^[a-f0-9]{64}$/i.test(clean(parcelSource.geometrySha256)), 'parcel geometry hash is required');

  requireFalse(legalEffects.isLegalSurvey, 'isLegalSurvey');
  requireFalse(legalEffects.establishesDeedOwnership, 'establishesDeedOwnership');
  requireFalse(legalEffects.establishesTitle, 'establishesTitle');
  requireFalse(legalEffects.createsInvestmentRights, 'createsInvestmentRights');
  requireFalse(legalEffects.createsBlockchainRights, 'createsBlockchainRights');

  if (currentTwin) {
    requireCondition(clean(currentTwin.propertyId) === clean(property.propertyId), 'current property twin ID no longer matches the measurement');
    requireCondition(currentTwin.structure?.buildingGeometry, 'current property twin has no building footprint');
    requireCondition(currentTwin.location?.parcelGeometry, 'current property twin has no parcel geometry');
    requireCondition(
      sha256CanonicalJson(currentTwin.structure.buildingGeometry) === clean(footprintSource.geometrySha256),
      'current building footprint geometry differs from the measured footprint',
    );
    requireCondition(
      sha256CanonicalJson(currentTwin.location.parcelGeometry) === clean(parcelSource.geometrySha256),
      'current parcel geometry differs from the measured parcel',
    );
  }

  return Object.freeze({
    accepted: true,
    heightMeters,
    uncertaintyMeters,
    measuredAt: clean(measurement.measuredAt),
    method: FIRST_REAL_ERIE_LIDAR_ALGORITHM,
    lasTile: FIRST_REAL_ERIE_LIDAR_TILE,
    lasSha256: clean(lasTile.sha256).toLowerCase(),
    roofCandidateMethod: clean(algorithm.roofCandidateMethod),
    evidence,
  });
}
