import assert from 'node:assert/strict';
import {
  GEO_3D_STATES,
  GEO_BRAND_STATUS,
  GEO_INVESTMENT_STATES,
  buildGeoPropertyReadiness,
  buildGlobalReferenceRequest,
} from '../lib/real-estate/geo-property-onboarding.js';
import {
  STARTER_INVESTMENT_PRESETS_CENTS,
  buildDigitalAssetToPropertyPlan,
  buildPropertyOwnershipGoal,
  evaluatePropertyCashAction,
  evaluateStarterPropertyInvestment,
} from '../lib/real-estate/property-ownership-goal.js';
import {
  PROPERTY_FACT_SOURCE_KINDS,
  PROPERTY_FACT_STATUSES,
  factCheckProperty,
} from '../lib/real-estate/property-fact-check.js';
import { fetchGlobalBuildingReference } from '../lib/real-estate/global-building-reference.js';

const penny = buildPropertyOwnershipGoal({ targetPropertyPriceCents: 10_000_000, savedCents: 0, contributionCents: 1 });
assert.equal(penny.contributionCents, 1);
assert.equal(penny.nextSavedCents, 1);
assert.equal(penny.ownershipCreated, false);
assert.equal(penny.securityPurchased, false);
assert.equal(penny.deedInterestCreated, false);
assert.deepEqual(penny.starterPresetsCents, [500, 1000, 2500, 5000]);
assert.deepEqual(STARTER_INVESTMENT_PRESETS_CENTS, [500, 1000, 2500, 5000]);
assert.throws(() => buildPropertyOwnershipGoal({ targetPropertyPriceCents: 1000, savedCents: 0, contributionCents: 0 }), /between 1/);

const noOfferingStarter = evaluateStarterPropertyInvestment({ amountCents: 1000 });
assert.equal(noOfferingStarter.state, 'goal_only');
assert.equal(noOfferingStarter.canOpenProviderCheckout, false);
assert.equal(noOfferingStarter.ownershipCreated, false);
assert.equal(noOfferingStarter.fundsTransferredByThisCheck, false);

const belowMinimumStarter = evaluateStarterPropertyInvestment({
  amountCents: 1000,
  providerMinimumCents: 2500,
  providerOfferingVerified: true,
  providerExecutionReady: true,
  userEligible: true,
  userAuthorizedPurchase: true,
});
assert.equal(belowMinimumStarter.state, 'below_provider_minimum');
assert.equal(belowMinimumStarter.meetsProviderMinimum, false);
assert.equal(belowMinimumStarter.canOpenProviderCheckout, false);
assert.equal(belowMinimumStarter.verifiedPropertyPosition, false);

const readyStarter = evaluateStarterPropertyInvestment({
  amountCents: 2500,
  providerMinimumCents: 2500,
  providerOfferingVerified: true,
  providerExecutionReady: true,
  userEligible: true,
  userAuthorizedPurchase: true,
});
assert.equal(readyStarter.state, 'provider_handoff_ready');
assert.equal(readyStarter.meetsProviderMinimum, true);
assert.equal(readyStarter.canOpenProviderCheckout, true);
assert.equal(readyStarter.ownershipCreated, false);
assert.equal(readyStarter.securityPurchasedByThisCheck, false);
assert.equal(readyStarter.verifiedPropertyPosition, false);

const assetPlan = buildDigitalAssetToPropertyPlan({ settledAssetProceedsCents: 1000, earmarkCents: 500, providerOfferingVerified: false, providerExecutionReady: false, userAuthorizedPurchase: true });
assert.equal(assetPlan.canMoveToPropertyGoal, true);
assert.equal(assetPlan.canPurchasePropertyPosition, false);
assert.equal(assetPlan.createsPropertyEquityByHoldingDigitalAsset, false);

const lockedCash = evaluatePropertyCashAction({ action: 'reinvest', settledCashCents: 500, pendingCashCents: 500, projectedIncomeCents: 5000, requestedCents: 600, providerReinvestmentReady: true, userOptIn: true });
assert.equal(lockedCash.availableNowCents, 500);
assert.equal(lockedCash.projectedProfitSpendable, false);
assert.equal(lockedCash.canExecute, false);
const readyCash = evaluatePropertyCashAction({ action: 'reinvest', settledCashCents: 500, requestedCents: 500, providerReinvestmentReady: true, userOptIn: true });
assert.equal(readyCash.canReinvest, true);
assert.equal(readyCash.profitGuaranteed, false);

const report = factCheckProperty({
  propertyId: 'TEST',
  facts: [
    { field: 'parcel_id', value: 'ABC-1', sourceKind: PROPERTY_FACT_SOURCE_KINDS.JURISDICTION_GIS, authority: 'County GIS', recordId: '1', observedAt: '2026-08-28T00:00:00Z' },
    { field: 'building_footprint', value: { type: 'Polygon', coordinates: [] }, sourceKind: PROPERTY_FACT_SOURCE_KINDS.GLOBAL_MAP, authority: 'Global map', recordId: 'way:1', observedAt: '2026-08-28T00:00:00Z' },
    { field: 'asking_price', value: 100000, sourceKind: PROPERTY_FACT_SOURCE_KINDS.LICENSED_LISTING, authority: 'MLS', recordId: 'MLS-1', observedAt: '2026-08-28T00:00:00Z' },
    { field: 'owner_name', value: 'Example', sourceKind: PROPERTY_FACT_SOURCE_KINDS.USER },
  ],
});
assert.equal(report.facts.find((row) => row.field === 'parcel_id').status, PROPERTY_FACT_STATUSES.VERIFIED_AUTHORITATIVE);
assert.equal(report.facts.find((row) => row.field === 'building_footprint').status, PROPERTY_FACT_STATUSES.SOURCE_REPORTED);
assert.equal(report.facts.find((row) => row.field === 'owner_name').status, PROPERTY_FACT_STATUSES.REFERENCE_ONLY);
assert.equal(report.legalEffects.verifiesDeedOwnership, false);

const conflict = factCheckProperty({ facts: [
  { field: 'parcel_id', value: 'A', sourceKind: PROPERTY_FACT_SOURCE_KINDS.JURISDICTION_GIS, authority: 'GIS 1', recordId: '1', observedAt: '2026-08-28' },
  { field: 'parcel_id', value: 'B', sourceKind: PROPERTY_FACT_SOURCE_KINDS.JURISDICTION_GIS, authority: 'GIS 2', recordId: '2', observedAt: '2026-08-28' },
] });
assert.equal(conflict.hasConflict, true);
assert.ok(conflict.facts.every((row) => row.status === PROPERTY_FACT_STATUSES.CONFLICT));

const reference = { geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] }, source: { authority: 'Global map' } };
const readiness = buildGeoPropertyReadiness({
  intake: { latitude: 42, longitude: -78, countryCode: 'US' },
  globalReference: reference,
  investment: { goalEnabled: true },
});
assert.equal(readiness.threeD.state, GEO_3D_STATES.SOURCE_BACKED_REFERENCE);
assert.equal(readiness.threeD.verified, false);
assert.equal(readiness.investment.state, GEO_INVESTMENT_STATES.GOAL_ONLY);
assert.equal(readiness.investment.ownershipCreatedByGoal, false);
assert.equal(GEO_BRAND_STATUS.trademarkClearance, 'pending');

const globalPlan = buildGlobalReferenceRequest({ latitude: 42, longitude: -78, countryCode: 'US' });
assert.equal(globalPlan.predownloadEntirePlanet, false);
assert.equal(globalPlan.mode, 'on_demand');
assert.equal(globalPlan.primaryReferenceSource.establishesTitle, false);

const fakeFetch = async () => ({
  ok: true,
  json: async () => ({ elements: [{
    type: 'way', id: 123,
    tags: { building: 'yes', 'building:levels': '2' },
    geometry: [
      { lat: 42.0000, lon: -78.0000 },
      { lat: 42.0000, lon: -77.9999 },
      { lat: 42.0001, lon: -77.9999 },
      { lat: 42.0001, lon: -78.0000 },
      { lat: 42.0000, lon: -78.0000 },
    ],
  }] }),
});
const building = await fetchGlobalBuildingReference({ latitude: 42.00005, longitude: -77.99995 }, { fetchImpl: fakeFetch, overpassUrl: 'https://example.test' });
assert.equal(building.found, true);
assert.equal(building.source.recordId, 'way:123');
assert.equal(building.height.referenceHeightMeters, 6);
assert.equal(building.height.heightStatus, 'derived_from_levels');
assert.equal(building.height.measuredHeightAccepted, false);
assert.equal(building.legalEffects.createsOwnership, false);

console.log('GEO property onboarding truth tests passed');
