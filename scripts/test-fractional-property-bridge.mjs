import assert from 'node:assert/strict';
import {
  FRACTIONAL_POSITION_VERIFIER_IMPLEMENTATION_READY,
  LIVE_FRACTIONAL_PROPERTY_EXECUTION_READY,
  OWNER_REAL_PROPERTY_PILOT_MAX_USD,
  buildFractionalPropertyHandoff,
  evaluateFractionalPositionClaim,
  publicFractionalBridgeStatus,
} from '../lib/real-estate/fractional-property-bridge.js';

assert.equal(OWNER_REAL_PROPERTY_PILOT_MAX_USD, 700);
assert.equal(FRACTIONAL_POSITION_VERIFIER_IMPLEMENTATION_READY, false);
assert.equal(LIVE_FRACTIONAL_PROPERTY_EXECUTION_READY, false);

const handoff = buildFractionalPropertyHandoff({ providerId: 'lofty', budgetUsd: 25 });
assert.equal(handoff.budgetUsd, 25);
assert.equal(handoff.maxPilotBudgetUsd, 700);
assert.equal(handoff.automatedTradingEnabled, false);
assert.equal(handoff.scrapingEnabled, false);
assert.equal(handoff.requiresExternalProviderCheckout, true);
assert.equal(handoff.provider.publicExecutionApiVerified, false);
assert.equal(handoff.provider.scrapingPermitted, false);
assert.equal(handoff.provider.automaticTradingPermittedByVoxelVault, false);
assert.match(handoff.provider.officialMarketplaceUrl, /^https:\/\/www\.lofty\.ai\//);

assert.throws(
  () => buildFractionalPropertyHandoff({ providerId: 'lofty', budgetUsd: 700.01 }),
  /cannot exceed 700/,
  'the owner pilot budget must remain hard-capped at $700'
);

const evaluation = evaluateFractionalPositionClaim({
  providerId: 'lofty',
  propertyAddress: '10 Example Street, Example City, NY 10001',
  legalEntity: '10 Example Street DAO LLC',
  purchaseAmountUsd: 50,
  quantity: 1,
  blockchainAssetId: '123456789',
  transactionId: 'EXAMPLE-TRANSACTION-ID',
  providerReceiptRef: 'provider-receipt-001',
  walletAddress: 'EXAMPLE-PUBLIC-WALLET',
  providerKycCompleted: true,
  purchaseCompleted: true,
  userConfirmedNoSecrets: true,
  parcel: {
    countryCode: 'US',
    subdivisionCode: 'NY',
    countyCode: 'EXAMPLE',
    parcelId: 'PARCEL-001',
  },
});

assert.equal(evaluation.claim.purchaseCompleted, true);
assert.equal(evaluation.claim.providerKycCompleted, true);
assert.equal(evaluation.claim.parcel.bound, true);
assert.equal(evaluation.status, 'needs-provider-verification');
assert.equal(evaluation.rightsType, 'reference_only');
assert.equal(evaluation.targetRightsType, 'provider_fractional_security');
assert.equal(evaluation.verifiedProviderPosition, false);
assert.equal(evaluation.verifiedPropertyRights, false);
assert.equal(evaluation.canDisplayAsOwnedProperty, false);
assert.equal(evaluation.canDisplayAsPendingPosition, true);
assert.equal(evaluation.canAutoReinvest, false);
assert.equal(evaluation.canExecuteTrade, false);
assert.ok(evaluation.blockers.includes('approved provider/on-chain verifier not implemented'));
assert.ok(evaluation.blockers.includes('public production provider API/partnership not verified'));
assert.ok(Object.values(evaluation.legalEffects).every((value) => value === false));
assert.match(evaluation.claim.positionFingerprint, /^[a-f0-9]{64}$/);

assert.throws(
  () => evaluateFractionalPositionClaim({
    providerId: 'lofty',
    propertyAddress: '10 Example Street',
    legalEntity: 'Example LLC',
    purchaseAmountUsd: 50,
    quantity: 1,
    transactionId: 'seed phrase alpha beta gamma',
    providerKycCompleted: true,
    purchaseCompleted: true,
    userConfirmedNoSecrets: true,
  }),
  /must never contain wallet credentials/,
  'secret-looking wallet credentials must be rejected from references'
);

assert.throws(
  () => evaluateFractionalPositionClaim({
    providerId: 'lofty',
    propertyAddress: '10 Example Street',
    legalEntity: 'Example LLC',
    purchaseAmountUsd: 50,
    quantity: 1,
    transactionId: 'TX-1',
    providerKycCompleted: true,
    purchaseCompleted: true,
    userConfirmedNoSecrets: true,
    parcel: { subdivisionCode: 'NY', countyCode: '', parcelId: 'ABC' },
  }),
  /requires state\/subdivision, county\/assessor jurisdiction and parcel ID together/,
  'partial parcel identity must not create an ambiguous canonical property binding'
);

const status = publicFractionalBridgeStatus();
assert.equal(status.liveExecutionReady, false);
assert.equal(status.positionVerifierImplementationReady, false);
assert.equal(status.automatedTradingEnabled, false);
assert.equal(status.scrapingEnabled, false);
assert.equal(status.providers[0].executionMode, 'external-provider-interface-only');

console.log('Fractional-property ownership bridge safety checks passed: $700 hard cap, external provider checkout only, no scraping, no automated execution/reinvestment, no secret credentials, user-entered proof cannot self-verify ownership, and exact parcel binding remains separately required.');
