const clean = (value) => String(value ?? '').trim();
const finite = (value) => value !== null && value !== undefined && clean(value) !== '' && Number.isFinite(Number(value));

export const PROPERTY_RIGHT_TYPES = Object.freeze({
  REFERENCE_ONLY: 'reference_only',
  PROVIDER_FRACTIONAL_SECURITY: 'provider_fractional_security',
  DIRECT_TITLE: 'direct_title',
});

export const PROPERTY_TRUTH_STATES = Object.freeze({
  UNVERIFIED: 'unverified',
  PARTIAL: 'partial',
  VERIFIED: 'verified',
});

function validCoordinate(value, min, max) {
  return finite(value) && Number(value) >= min && Number(value) <= max;
}

function validPolygonGeometry(value) {
  if (!value || typeof value !== 'object') return false;
  const geometry = value.type === 'Feature' ? value.geometry : value;
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return false;
  return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0;
}

function validLineageSource(source = {}) {
  return Boolean(clean(source.authority) && clean(source.recordId) && clean(source.observedAt));
}

function stateFromChecks(checks) {
  const values = Object.values(checks);
  if (values.every(Boolean)) return PROPERTY_TRUTH_STATES.VERIFIED;
  if (values.some(Boolean)) return PROPERTY_TRUTH_STATES.PARTIAL;
  return PROPERTY_TRUTH_STATES.UNVERIFIED;
}

function normalizeRights(rights = {}) {
  const type = clean(rights.type).toLowerCase() || PROPERTY_RIGHT_TYPES.REFERENCE_ONLY;
  if (!Object.values(PROPERTY_RIGHT_TYPES).includes(type)) {
    throw new Error(`Unsupported property rights type: ${type}`);
  }

  const provider = clean(rights.provider);
  const providerSecurityId = clean(rights.providerSecurityId);
  const providerPositionId = clean(rights.providerPositionId);
  const legalEntity = clean(rights.legalEntity);
  const titleRecordId = clean(rights.titleRecordId);
  const verifiedAt = clean(rights.verifiedAt);

  if (type === PROPERTY_RIGHT_TYPES.PROVIDER_FRACTIONAL_SECURITY) {
    if (!provider || !providerSecurityId || !providerPositionId || !verifiedAt) {
      throw new Error('A provider fractional property position requires provider, security ID, position ID and provider verification time.');
    }
  }

  if (type === PROPERTY_RIGHT_TYPES.DIRECT_TITLE) {
    if (!legalEntity || !titleRecordId || !verifiedAt) {
      throw new Error('Direct-title property ownership requires the legal owning entity, authoritative title record ID and verification time.');
    }
  }

  return {
    type,
    provider,
    providerSecurityId,
    providerPositionId,
    legalEntity,
    titleRecordId,
    verifiedAt,
    ownershipPercent: finite(rights.ownershipPercent) ? Number(rights.ownershipPercent) : null,
  };
}

export function normalizePropertyTwin(input = {}) {
  const identity = {
    countryCode: clean(input.identity?.countryCode).toUpperCase(),
    subdivisionCode: clean(input.identity?.subdivisionCode).toUpperCase(),
    countyCode: clean(input.identity?.countyCode).toUpperCase(),
    parcelId: clean(input.identity?.parcelId),
    fingerprint: clean(input.identity?.fingerprint),
  };

  const location = {
    latitude: finite(input.location?.latitude) ? Number(input.location.latitude) : null,
    longitude: finite(input.location?.longitude) ? Number(input.location.longitude) : null,
    parcelGeometry: input.location?.parcelGeometry || null,
    source: {
      authority: clean(input.location?.source?.authority),
      recordId: clean(input.location?.source?.recordId),
      observedAt: clean(input.location?.source?.observedAt),
      sourceUrl: clean(input.location?.source?.sourceUrl),
    },
  };

  const structure = {
    buildingGeometry: input.structure?.buildingGeometry || null,
    heightMeters: finite(input.structure?.heightMeters) ? Number(input.structure.heightMeters) : null,
    heightUnavailableReason: clean(input.structure?.heightUnavailableReason),
    heightSourceMethod: clean(input.structure?.heightSourceMethod),
    floors: finite(input.structure?.floors) ? Number(input.structure.floors) : null,
    grossAreaSqFt: finite(input.structure?.grossAreaSqFt) ? Number(input.structure.grossAreaSqFt) : null,
    yearBuilt: finite(input.structure?.yearBuilt) ? Number(input.structure.yearBuilt) : null,
    source: {
      authority: clean(input.structure?.source?.authority),
      recordId: clean(input.structure?.source?.recordId),
      observedAt: clean(input.structure?.source?.observedAt),
      sourceUrl: clean(input.structure?.source?.sourceUrl),
    },
  };

  const rights = normalizeRights(input.rights);

  const geographyChecks = {
    canonicalParcelIdentity: Boolean(identity.countryCode && identity.countyCode && identity.parcelId),
    coordinates: validCoordinate(location.latitude, -90, 90) && validCoordinate(location.longitude, -180, 180),
    parcelBoundary: validPolygonGeometry(location.parcelGeometry),
    authoritativeSource: validLineageSource(location.source),
  };

  const hasMeasuredHeight = structure.heightMeters !== null && structure.heightMeters > 0;
  const hasExplicitUnavailableHeight = Boolean(structure.heightUnavailableReason);
  const buildingFootprint = validPolygonGeometry(structure.buildingGeometry);
  const physicalSource = validLineageSource(structure.source);

  const physicalChecks = {
    buildingFootprint,
    buildingHeightMeasured: hasMeasuredHeight,
    buildingHeightExplicitlyUnavailable: hasExplicitUnavailableHeight,
    authoritativeSource: physicalSource,
  };

  const rightsChecks = {
    referenceOnly: rights.type === PROPERTY_RIGHT_TYPES.REFERENCE_ONLY,
    providerVerified: rights.type === PROPERTY_RIGHT_TYPES.PROVIDER_FRACTIONAL_SECURITY && Boolean(rights.verifiedAt),
    titleVerified: rights.type === PROPERTY_RIGHT_TYPES.DIRECT_TITLE && Boolean(rights.verifiedAt),
  };

  const geographyState = stateFromChecks(geographyChecks);
  let physicalState;
  if (buildingFootprint && physicalSource && hasMeasuredHeight) {
    physicalState = PROPERTY_TRUTH_STATES.VERIFIED;
  } else if (buildingFootprint && physicalSource && hasExplicitUnavailableHeight) {
    physicalState = PROPERTY_TRUTH_STATES.PARTIAL;
  } else {
    physicalState = stateFromChecks({
      buildingFootprint,
      buildingHeightMeasured: hasMeasuredHeight,
      authoritativeSource: physicalSource,
    });
  }

  const rightsState = rights.type === PROPERTY_RIGHT_TYPES.REFERENCE_ONLY
    ? PROPERTY_TRUTH_STATES.UNVERIFIED
    : (rightsChecks.providerVerified || rightsChecks.titleVerified ? PROPERTY_TRUTH_STATES.VERIFIED : PROPERTY_TRUTH_STATES.UNVERIFIED);

  const verifiedSpatialTwin = geographyState === PROPERTY_TRUTH_STATES.VERIFIED
    && physicalState === PROPERTY_TRUTH_STATES.VERIFIED
    && hasMeasuredHeight;
  const verifiedOwnership = rightsState === PROPERTY_TRUTH_STATES.VERIFIED;

  const twin = {
    propertyId: clean(input.propertyId),
    label: clean(input.label),
    addressLabel: clean(input.addressLabel),
    identity,
    location,
    structure,
    rights,
    economics: {
      valuationUsd: finite(input.economics?.valuationUsd) ? Number(input.economics.valuationUsd) : null,
      grossRentMonthlyUsd: finite(input.economics?.grossRentMonthlyUsd) ? Number(input.economics.grossRentMonthlyUsd) : null,
      operatingExpensesMonthlyUsd: finite(input.economics?.operatingExpensesMonthlyUsd) ? Number(input.economics.operatingExpensesMonthlyUsd) : null,
      reserveMonthlyUsd: finite(input.economics?.reserveMonthlyUsd) ? Number(input.economics.reserveMonthlyUsd) : null,
      netDistributableMonthlyUsd: finite(input.economics?.netDistributableMonthlyUsd) ? Number(input.economics.netDistributableMonthlyUsd) : null,
      valuationSource: clean(input.economics?.valuationSource),
      observedAt: clean(input.economics?.observedAt),
    },
    verification: {
      geography: geographyState,
      physical: physicalState,
      rights: rightsState,
      verifiedSpatialTwin,
      verifiedOwnership,
      fullyVerified: verifiedSpatialTwin && verifiedOwnership,
      heightStatus: hasMeasuredHeight
        ? 'measured'
        : hasExplicitUnavailableHeight
          ? 'explicitly_unavailable'
          : 'missing',
      geographyChecks,
      physicalChecks,
      rightsChecks,
    },
  };

  assertSpatialInvariants(twin);
  return twin;
}

export function propertyRightsLabel(twin = {}) {
  const type = clean(twin?.rights?.type).toLowerCase();
  if (type === PROPERTY_RIGHT_TYPES.DIRECT_TITLE) return 'DIRECT PROPERTY OWNERSHIP VERIFIED';
  if (type === PROPERTY_RIGHT_TYPES.PROVIDER_FRACTIONAL_SECURITY) return 'FRACTIONAL POSITION VERIFIED';
  return 'REFERENCE ONLY';
}

export function spatialTruthLabels(twin = {}) {
  const verification = twin.verification || {};
  const heightStatus = verification.heightStatus || 'missing';
  return {
    geography: verification.geography === PROPERTY_TRUTH_STATES.VERIFIED
      ? 'GEO VERIFIED'
      : verification.geography === PROPERTY_TRUTH_STATES.PARTIAL
        ? 'GEO PARTIAL'
        : 'GEO UNVERIFIED',
    physical: verification.physical === PROPERTY_TRUTH_STATES.VERIFIED
      ? 'PHYSICAL VERIFIED'
      : verification.physical === PROPERTY_TRUTH_STATES.PARTIAL
        ? (heightStatus === 'explicitly_unavailable' ? 'PHYSICAL PARTIAL · HEIGHT UNAVAILABLE' : 'PHYSICAL PARTIAL')
        : 'PHYSICAL UNVERIFIED',
    rights: propertyRightsLabel(twin),
    spatialTwin: verification.verifiedSpatialTwin ? 'VERIFIED SPATIAL TWIN' : 'NOT A VERIFIED SPATIAL TWIN',
    ownership: verification.verifiedOwnership ? 'OWNERSHIP VERIFIED' : 'OWNERSHIP NOT VERIFIED',
    heightStatus,
  };
}

export function assertSpatialInvariants(twin = {}) {
  const verification = twin.verification || {};
  if (verification.verifiedSpatialTwin && !(Number(twin.structure?.heightMeters) > 0)) {
    throw new Error('Invariant: verifiedSpatialTwin requires measured heightMeters > 0.');
  }
  if (verification.verifiedOwnership && twin.rights?.type === PROPERTY_RIGHT_TYPES.REFERENCE_ONLY) {
    throw new Error('Invariant: verifiedOwnership cannot be true for REFERENCE_ONLY rights.');
  }
  if (verification.fullyVerified && (!verification.verifiedSpatialTwin || !verification.verifiedOwnership)) {
    throw new Error('Invariant: fullyVerified requires both verified spatial truth and verified ownership rights.');
  }
  return twin;
}

export function makeReferenceOnlyDemoTwin(input = {}) {
  return normalizePropertyTwin({
    propertyId: clean(input.propertyId) || 'DEMO',
    label: clean(input.label) || 'Reference model',
    addressLabel: clean(input.addressLabel) || 'REFERENCE ONLY',
    identity: {
      countryCode: 'US',
      subdivisionCode: 'XX',
      countyCode: '',
      parcelId: '',
      fingerprint: '',
    },
    location: {
      latitude: null,
      longitude: null,
      parcelGeometry: null,
      source: {},
    },
    structure: {
      buildingGeometry: null,
      heightMeters: null,
      heightUnavailableReason: 'Demo / generic model — no source-backed parcel footprint or measured height.',
      heightSourceMethod: 'demo_none',
      source: {},
    },
    rights: { type: PROPERTY_RIGHT_TYPES.REFERENCE_ONLY },
  });
}

export function publicPropertyTwinSummary(input = {}) {
  const twin = normalizePropertyTwin(input);
  return {
    propertyId: twin.propertyId,
    label: twin.label,
    addressLabel: twin.addressLabel,
    identity: twin.identity,
    location: twin.location,
    structure: twin.structure,
    rights: twin.rights,
    economics: twin.economics,
    verification: twin.verification,
    rightsLabel: propertyRightsLabel(twin),
    truthLabels: spatialTruthLabels(twin),
  };
}
