import assert from 'node:assert/strict';
import {
  PROPERTY_RIGHT_TYPES,
  PROPERTY_TRUTH_STATES,
  assertSpatialInvariants,
  makeReferenceOnlyDemoTwin,
  normalizePropertyTwin,
  propertyRightsLabel,
  spatialTruthLabels,
} from '../lib/real-estate/property-twin.js';

const referenceOnly = normalizePropertyTwin({
  propertyId: 'DEMO-0001',
  label: 'Unverified demo parcel',
  identity: { countryCode: 'US', subdivisionCode: 'NY', countyCode: 'ERIE', parcelId: 'DEMO' },
  rights: { type: PROPERTY_RIGHT_TYPES.REFERENCE_ONLY },
});

assert.equal(referenceOnly.location.latitude, null);
assert.equal(referenceOnly.location.longitude, null);
assert.equal(referenceOnly.verification.geographyChecks.coordinates, false);
assert.equal(referenceOnly.verification.geography, PROPERTY_TRUTH_STATES.PARTIAL);
assert.equal(referenceOnly.verification.physical, PROPERTY_TRUTH_STATES.UNVERIFIED);
assert.equal(referenceOnly.verification.rights, PROPERTY_TRUTH_STATES.UNVERIFIED);
assert.equal(referenceOnly.verification.fullyVerified, false);
assert.equal(propertyRightsLabel(referenceOnly), 'REFERENCE ONLY');

const demo = makeReferenceOnlyDemoTwin({
  propertyId: 'PRETTY-HOUSE',
  label: 'Pretty generic house',
  location: { latitude: 42.9, longitude: -78.8 },
  structure: { heightMeters: 12 },
});
assert.equal(demo.rights.type, PROPERTY_RIGHT_TYPES.REFERENCE_ONLY);
assert.equal(demo.verification.verifiedSpatialTwin, false);
assert.equal(demo.verification.verifiedOwnership, false);
assert.equal(demo.verification.heightStatus, 'explicitly_unavailable');
assert.equal(spatialTruthLabels(demo).spatialTwin, 'NOT A VERIFIED SPATIAL TWIN');
assert.equal(spatialTruthLabels(demo).rights, 'REFERENCE ONLY');
assertSpatialInvariants(demo);

const footprintOnly = normalizePropertyTwin({
  propertyId: 'ERIE-PARTIAL',
  identity: {
    countryCode: 'US',
    subdivisionCode: 'NY',
    countyCode: 'ERIE',
    parcelId: '1113800003008000',
  },
  location: {
    latitude: 42.8864,
    longitude: -78.8784,
    parcelGeometry: {
      type: 'Polygon',
      coordinates: [[[-78.879, 42.886], [-78.878, 42.886], [-78.878, 42.887], [-78.879, 42.887], [-78.879, 42.886]]],
    },
    source: {
      authority: 'Erie County Office of GIS',
      recordId: 'SBL:1113800003008000',
      observedAt: '2026-08-28T12:00:00Z',
    },
  },
  structure: {
    buildingGeometry: {
      type: 'Polygon',
      coordinates: [[[-78.8788, 42.8862], [-78.8784, 42.8862], [-78.8784, 42.8866], [-78.8788, 42.8866], [-78.8788, 42.8862]]],
    },
    heightMeters: null,
    heightUnavailableReason: 'County BUILDING layer contains no authoritative measured height.',
    heightSourceMethod: 'county_none',
    source: {
      authority: 'Erie County Office of GIS — BUILDING layer',
      recordId: 'BLDG-1',
      observedAt: '2026-08-28T12:00:00Z',
    },
  },
  rights: { type: PROPERTY_RIGHT_TYPES.REFERENCE_ONLY },
});
assert.equal(footprintOnly.verification.geography, PROPERTY_TRUTH_STATES.VERIFIED);
assert.equal(footprintOnly.verification.physical, PROPERTY_TRUTH_STATES.PARTIAL);
assert.equal(footprintOnly.verification.heightStatus, 'explicitly_unavailable');
assert.equal(footprintOnly.verification.verifiedSpatialTwin, false);
assert.equal(footprintOnly.verification.verifiedOwnership, false);
assert.match(spatialTruthLabels(footprintOnly).physical, /HEIGHT UNAVAILABLE/);
assertSpatialInvariants(footprintOnly);

const verified = normalizePropertyTwin({
  propertyId: 'TEST-VERIFIED',
  identity: {
    countryCode: 'US',
    subdivisionCode: 'NY',
    countyCode: 'ERIE',
    parcelId: 'TEST-123',
  },
  location: {
    latitude: 42.8864,
    longitude: -78.8784,
    parcelGeometry: {
      type: 'Polygon',
      coordinates: [[[-78.879, 42.886], [-78.878, 42.886], [-78.878, 42.887], [-78.879, 42.887], [-78.879, 42.886]]],
    },
    source: {
      authority: 'TEST ASSESSOR',
      recordId: 'TEST-123',
      observedAt: '2026-08-28T12:00:00Z',
    },
  },
  structure: {
    buildingGeometry: {
      type: 'Polygon',
      coordinates: [[[-78.8788, 42.8862], [-78.8784, 42.8862], [-78.8784, 42.8866], [-78.8788, 42.8866], [-78.8788, 42.8862]]],
    },
    heightMeters: 8.2,
    heightUnavailableReason: '',
    heightSourceMethod: 'lidar_max_return_minus_bare_earth',
    source: {
      authority: 'TEST BUILDING HEIGHT SOURCE',
      recordId: 'BLDG-1',
      observedAt: '2026-08-28T12:00:00Z',
    },
  },
  rights: {
    type: PROPERTY_RIGHT_TYPES.DIRECT_TITLE,
    legalEntity: 'Example Property LLC',
    titleRecordId: 'TITLE-TEST-1',
    verifiedAt: '2026-08-28T12:00:00Z',
    ownershipPercent: 100,
  },
});

assert.equal(verified.verification.geography, PROPERTY_TRUTH_STATES.VERIFIED);
assert.equal(verified.verification.physical, PROPERTY_TRUTH_STATES.VERIFIED);
assert.equal(verified.verification.heightStatus, 'measured');
assert.equal(verified.verification.rights, PROPERTY_TRUTH_STATES.VERIFIED);
assert.equal(verified.verification.verifiedSpatialTwin, true);
assert.equal(verified.verification.verifiedOwnership, true);
assert.equal(verified.verification.fullyVerified, true);
assert.equal(propertyRightsLabel(verified), 'DIRECT PROPERTY OWNERSHIP VERIFIED');
assertSpatialInvariants(verified);

const badCoordinates = normalizePropertyTwin({
  propertyId: 'BAD-COORDS',
  identity: { countryCode: 'US', subdivisionCode: 'NY', countyCode: 'ERIE', parcelId: 'BAD' },
  location: {
    latitude: 200,
    longitude: -78.8784,
    parcelGeometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
    source: { authority: 'TEST', recordId: 'BAD', observedAt: '2026-08-28T12:00:00Z' },
  },
  rights: { type: PROPERTY_RIGHT_TYPES.REFERENCE_ONLY },
});
assert.notEqual(badCoordinates.verification.geography, PROPERTY_TRUTH_STATES.VERIFIED);

assert.throws(
  () => normalizePropertyTwin({
    rights: {
      type: PROPERTY_RIGHT_TYPES.PROVIDER_FRACTIONAL_SECURITY,
      provider: 'Example Provider',
    },
  }),
  /requires provider, security ID, position ID and provider verification time/
);

console.log('property twin truth model: explicit height state, demo fail-closed behavior and spatial/ownership invariants ok');
