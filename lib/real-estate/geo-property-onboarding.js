const clean = (value) => String(value ?? '').trim();
const finite = (value) => value !== null && value !== undefined && clean(value) !== '' && Number.isFinite(Number(value));

export const GEO_BRAND_STATUS = Object.freeze({
  workingName: 'GEO',
  trademarkClearance: 'pending',
  note: 'GEO is a working product name only. Trademark clearance is required before launch or filing.',
});

export const GEO_3D_STATES = Object.freeze({
  NONE: 'none',
  ILLUSTRATIVE: 'illustrative',
  SOURCE_BACKED_REFERENCE: 'source_backed_reference',
  VERIFIED_SPATIAL_TWIN: 'verified_spatial_twin',
});

export const GEO_INVESTMENT_STATES = Object.freeze({
  NOT_OFFERED: 'not_offered',
  GOAL_ONLY: 'goal_only',
  PROVIDER_HANDOFF: 'provider_handoff',
  VERIFIED_POSITION: 'verified_position',
});

export const GLOBAL_REFERENCE_SOURCES = Object.freeze({
  overture: Object.freeze({
    id: 'overture',
    name: 'Overture Maps buildings',
    role: 'global_reference_geometry',
    authoritativeParcelBoundary: false,
    establishesTitle: false,
    accessMode: 'cloud_bbox_or_pmtiles',
  }),
  openstreetmap: Object.freeze({
    id: 'openstreetmap',
    name: 'OpenStreetMap / Overpass',
    role: 'global_reference_geometry',
    authoritativeParcelBoundary: false,
    establishesTitle: false,
    accessMode: 'on_demand_reference_query',
  }),
});

function coordinate(value, min, max, label) {
  if (!finite(value)) return null;
  const number = Number(value);
  if (number < min || number > max) throw new Error(`${label} is outside its valid range.`);
  return number;
}

function code(value, max = 32) {
  return clean(value).toUpperCase().replace(/\s+/g, '').slice(0, max);
}

export function normalizeGeoPropertyIntake(input = {}) {
  const latitude = coordinate(input.latitude, -90, 90, 'Latitude');
  const longitude = coordinate(input.longitude, -180, 180, 'Longitude');
  const address = clean(input.address).replace(/\s+/g, ' ').slice(0, 280);
  const countryCode = code(input.countryCode || 'US', 2);
  const subdivisionCode = code(input.subdivisionCode, 12);
  const countyCode = code(input.countyCode, 40);
  const parcelId = code(input.parcelId, 80);
  const pin = code(input.pin, 80);
  const sbl = code(input.sbl, 80);

  if (!address && (latitude === null || longitude === null) && !parcelId && !pin && !sbl) {
    throw new Error('Add an address, coordinates, or a jurisdiction parcel identifier.');
  }

  const hasCoordinates = latitude !== null && longitude !== null;
  const hasJurisdictionIdentity = Boolean(countryCode && subdivisionCode && countyCode && (parcelId || pin || sbl));

  return {
    address,
    latitude,
    longitude,
    countryCode,
    subdivisionCode,
    countyCode,
    parcelId,
    pin,
    sbl,
    hasCoordinates,
    hasJurisdictionIdentity,
  };
}

export function overtureBboxForPoint(latitude, longitude, radiusMeters = 80) {
  const lat = coordinate(latitude, -90, 90, 'Latitude');
  const lon = coordinate(longitude, -180, 180, 'Longitude');
  if (lat === null || lon === null) return null;
  const radius = Math.max(10, Math.min(500, Number(radiusMeters) || 80));
  const latDelta = radius / 111320;
  const lonScale = Math.max(0.15, Math.cos(lat * Math.PI / 180));
  const lonDelta = radius / (111320 * lonScale);
  return [lon - lonDelta, lat - latDelta, lon + lonDelta, lat + latDelta].map((value) => Number(value.toFixed(7)));
}

export function buildGlobalReferenceRequest(input = {}) {
  const intake = normalizeGeoPropertyIntake(input);
  const bbox = intake.hasCoordinates ? overtureBboxForPoint(intake.latitude, intake.longitude) : null;
  return {
    mode: 'on_demand',
    predownloadEntirePlanet: false,
    cacheAfterLookup: true,
    coordinatesRequiredForGlobalGeometry: !intake.hasCoordinates,
    bbox,
    primaryReferenceSource: GLOBAL_REFERENCE_SOURCES.overture,
    runtimeReferenceSource: GLOBAL_REFERENCE_SOURCES.openstreetmap,
    rules: [
      'Global map geometry is reference evidence and never substitutes for a jurisdiction cadastral parcel boundary.',
      'A source-reported or derived height may render a 3D reference scene but cannot create VERIFIED SPATIAL TWIN status by itself.',
      'No global geometry source establishes deed, title, LLC membership, rent rights, or a securities position.',
    ],
  };
}

export function buildGeoPropertyReadiness({ intake: input = {}, twin = null, globalReference = null, investment = null } = {}) {
  const intake = normalizeGeoPropertyIntake(input);
  const verifiedSpatialTwin = twin?.verification?.verifiedSpatialTwin === true;
  const verifiedOwnership = twin?.verification?.verifiedOwnership === true;
  const sourceBackedGeometry = Boolean(globalReference?.geometry && globalReference?.source?.authority);
  const illustrativeGeometry = Boolean(globalReference?.geometry || globalReference?.illustrativeGeometry);

  const threeDState = verifiedSpatialTwin
    ? GEO_3D_STATES.VERIFIED_SPATIAL_TWIN
    : sourceBackedGeometry
      ? GEO_3D_STATES.SOURCE_BACKED_REFERENCE
      : illustrativeGeometry
        ? GEO_3D_STATES.ILLUSTRATIVE
        : GEO_3D_STATES.NONE;

  let investmentState = GEO_INVESTMENT_STATES.NOT_OFFERED;
  if (verifiedOwnership && twin?.rights?.type === 'provider_fractional_security') investmentState = GEO_INVESTMENT_STATES.VERIFIED_POSITION;
  else if (investment?.providerHandoffReady === true) investmentState = GEO_INVESTMENT_STATES.PROVIDER_HANDOFF;
  else if (investment?.goalEnabled === true) investmentState = GEO_INVESTMENT_STATES.GOAL_ONLY;

  return {
    brand: GEO_BRAND_STATUS,
    intake,
    threeD: {
      state: threeDState,
      verified: threeDState === GEO_3D_STATES.VERIFIED_SPATIAL_TWIN,
      sourceBackedReference: threeDState === GEO_3D_STATES.SOURCE_BACKED_REFERENCE,
      label: threeDState === GEO_3D_STATES.VERIFIED_SPATIAL_TWIN
        ? 'VERIFIED 3D SPATIAL TWIN'
        : threeDState === GEO_3D_STATES.SOURCE_BACKED_REFERENCE
          ? 'SOURCE-BACKED 3D REFERENCE'
          : threeDState === GEO_3D_STATES.ILLUSTRATIVE
            ? 'ILLUSTRATIVE 3D'
            : '3D DATA NOT FOUND',
    },
    investment: {
      state: investmentState,
      ownershipCreatedByGoal: false,
      verifiedOwnership,
      label: investmentState === GEO_INVESTMENT_STATES.VERIFIED_POSITION
        ? 'FRACTIONAL POSITION VERIFIED'
        : investmentState === GEO_INVESTMENT_STATES.PROVIDER_HANDOFF
          ? 'VERIFIED PROVIDER CHECKOUT REQUIRED'
          : investmentState === GEO_INVESTMENT_STATES.GOAL_ONLY
            ? 'PROPERTY GOAL · NO OWNERSHIP YET'
            : 'NOT OFFERED FOR INVESTMENT',
    },
    boundaries: {
      globalReferenceCreatesParcelRights: false,
      listingCreatesOwnership: false,
      digitalAssetCreatesPropertyEquity: false,
      goalContributionCreatesPropertyEquity: false,
      verifiedOwnershipRequiresLegalRightsEvidence: true,
    },
  };
}
