import { fetchErieCountySpatialIntake } from './erie-county-gis.js';
import {
  assertSpatialInvariants,
  normalizePropertyTwin,
  spatialTruthLabels,
} from './property-twin.js';

export const FIRST_REAL_ERIE_PARCEL = Object.freeze({
  slug: 'erie-618-main',
  sbl: '1113800003008000',
  pin: '1402001113800003008000',
  expectedStreetNumber: '618',
  expectedStreetName: 'MAIN',
  referenceLabel: '618 Main Street · Buffalo, NY',
  identifierSource: 'City of Buffalo current charter/property schedule published in 2026',
});

export function enrichErieCountyEvidence(result) {
  if (!result?.twin) throw new Error('Erie County intake result did not contain a property twin.');

  const hasFootprint = Boolean(result.twin.structure?.buildingGeometry);
  const heightUnavailableReason = hasFootprint
    ? 'Erie County BUILDING supplies source-backed footprint geometry but no authoritative measured building height is attached to this twin yet.'
    : 'No source-backed building footprint was returned for this parcel, so no building height can be attached.';

  const twin = normalizePropertyTwin({
    ...result.twin,
    structure: {
      ...result.twin.structure,
      heightMeters: null,
      heightUnavailableReason,
      heightSourceMethod: 'county_none',
    },
  });

  assertSpatialInvariants(twin);

  return {
    ...result,
    twin,
    truthLabels: spatialTruthLabels(twin),
    sourceLimitations: [
      ...(Array.isArray(result.sourceLimitations) ? result.sourceLimitations : []),
      heightUnavailableReason,
    ].filter((value, index, values) => values.indexOf(value) === index),
  };
}

export async function fetchErieCountyEvidence(input = {}, options = {}) {
  const result = await fetchErieCountySpatialIntake(input, options);
  return enrichErieCountyEvidence(result);
}

export async function fetchFirstRealErieParcel(options = {}) {
  return fetchErieCountyEvidence({ sbl: FIRST_REAL_ERIE_PARCEL.sbl }, options);
}
