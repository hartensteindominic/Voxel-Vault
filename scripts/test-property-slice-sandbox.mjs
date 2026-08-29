import assert from 'node:assert/strict';
import {
  DEFAULT_PROPERTY_SLICE_CENTS,
  buildPropertySliceSandbox,
  buildUnifiedAssetConversionPreview,
} from '../lib/real-estate/property-slice-sandbox.js';

const equalPrice = buildPropertySliceSandbox({
  propertyReferencePriceCents: 10_000_000,
  benchmarkReferencePriceCents: 10_000_000,
});

assert.equal(equalPrice.amountCents, DEFAULT_PROPERTY_SLICE_CENTS);
assert.equal(equalPrice.amountCents, 199);
assert.equal(equalPrice.benchmarkAnchorAmountCents, 199);
assert.equal(equalPrice.adjustedTestPriceCents, 199);
assert.equal(equalPrice.relativePropertyPriceIndex, 1);
assert.equal(equalPrice.relativeSliceWeight, 1);
assert.equal(equalPrice.benchmarkEquivalentCents, 199);
assert.equal(equalPrice.pricingModel.sameProportionalSliceAcrossProperties, true);
assert.equal(equalPrice.legalEffects.transfersFunds, false);
assert.equal(equalPrice.legalEffects.createsDeedOwnership, false);
assert.equal(equalPrice.legalEffects.createsLlcInterest, false);
assert.equal(equalPrice.legalEffects.purchasesSecurity, false);
assert.equal(equalPrice.legalEffects.mintsRealEstateSecurity, false);

const doublePrice = buildPropertySliceSandbox({
  amountCents: 199,
  propertyReferencePriceCents: 20_000_000,
  benchmarkReferencePriceCents: 10_000_000,
});

assert.equal(doublePrice.relativePropertyPriceIndex, 2);
assert.equal(doublePrice.relativeSliceWeight, 0.5);
assert.equal(doublePrice.adjustedTestPriceCents, 398);
assert.equal(doublePrice.benchmarkEquivalentCents, 199);
assert.equal(doublePrice.hypotheticalPercent, equalPrice.hypotheticalPercent);
assert.equal(doublePrice.sandboxOnly, true);

const halfPrice = buildPropertySliceSandbox({
  amountCents: 199,
  propertyReferencePriceCents: 5_000_000,
  benchmarkReferencePriceCents: 10_000_000,
});
assert.equal(halfPrice.adjustedTestPriceCents, 100);
assert.equal(halfPrice.relativePropertyPriceIndex, 0.5);
// Currency pricing is cent-denominated, so a half-priced property rounds $0.995 to $1.00.
// Verify the resulting proportional slice stays within the unavoidable one-cent rounding error.
const halfPriceIdealCents = 199 * 0.5;
assert.ok(Math.abs(halfPrice.adjustedTestPriceCents - halfPriceIdealCents) <= 0.5);
assert.ok(Math.abs(halfPrice.benchmarkEquivalentCents - 199) <= 1);

const unified = buildUnifiedAssetConversionPreview({
  settledUsdCents: 500,
  estimatedCryptoValueCents: 2_000,
  estimatedNftValueCents: 3_000,
  propertyGoalCents: 1_000,
});

assert.equal(unified.balances.estimatedTotalCents, 6_500);
assert.equal(unified.spendableNowCents, 500);
assert.equal(unified.legalEffects.executesTrade, false);
assert.equal(unified.legalEffects.cashesOutNft, false);
assert.equal(unified.legalEffects.cashesOutCrypto, false);
assert.equal(unified.legalEffects.createsDepositAccount, false);
assert.equal(unified.legalEffects.createsPropertyOwnership, false);
assert.equal(unified.conversionRoutes.length, 4);

console.log('property slice sandbox checks passed');
