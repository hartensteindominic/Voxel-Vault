import assert from 'node:assert/strict';
import {
  buildCanonicalPropertyPassport,
  buildDigitalBuildingEdition,
  propertyPurchaseProgression,
  REAL_WORLD_VOXEL_POLICY,
} from '../lib/vault/property-passport.js';

const passport = buildCanonicalPropertyPassport({
  propertyKey: 'PARCEL-TEST-001',
  title: 'Test property',
  ownerAuthorized: true,
  propertyVerified: true,
  titleVerified: true,
  entityVerified: true,
  testnetAnchored: true,
  canonicalMinted: true,
  modelVersion: 3,
  estimatedValueUsd: 400000,
  valuationSource: 'test comparable sales',
});

assert.equal(REAL_WORLD_VOXEL_POLICY.canonicalTwinPerProperty, 1, 'Only one canonical twin is allowed per property identity.');
assert.equal(REAL_WORLD_VOXEL_POLICY.canonicalTwinIsDeed, false, 'Canonical twin must never be described as the deed.');
assert.equal(REAL_WORLD_VOXEL_POLICY.collectibleConveysPropertyRights, false, 'Collectibles must not silently convey real property rights.');
assert.equal(REAL_WORLD_VOXEL_POLICY.realPropertyPurchaseRequiresClosing, true, 'Real property purchase must retain a normal legal closing.');
assert.equal(REAL_WORLD_VOXEL_POLICY.unattendedPropertyPurchaseAllowed, false, 'Unattended property spending remains locked.');
assert.equal(REAL_WORLD_VOXEL_POLICY.liveRentDistributionReady, false, 'Live real-property rent distribution must remain fail-closed.');
assert.ok(REAL_WORLD_VOXEL_POLICY.premiumCanonicalTwinStartingPriceUsd >= 299, 'Verified canonical twin pricing must remain premium.');

assert.equal(passport.canonicalMintSupply, 1);
assert.equal(passport.modelVersion, 3, 'Model refreshes should version the existing canonical identity.');
assert.equal(passport.truth.canonicalTwinIsDeed, false);
assert.equal(passport.truth.collectibleConveysPropertyRights, false);
assert.equal(passport.truth.actualRentRequiresLegalEconomicRights, true);
assert.equal(passport.pricing.propertyPurchasePriceUsd, 400000, 'Real-world valuation remains separate from the twin service price.');
assert.equal(passport.pricing.propertyPurchaseExecutable, false, 'A Property Passport must not create a hidden buy-property execution route.');
assert.equal(passport.liveLegalInterestReady, false, 'The current product must not imply live legal-interest issuance.');

const authorizedEdition = buildDigitalBuildingEdition({
  canonicalPropertyKey: passport.propertyKey,
  creatorAuthorized: true,
  addressLinked: true,
  supply: 25,
});
assert.equal(authorizedEdition.verifiedLink, true);
assert.equal(authorizedEdition.conveysDeed, false);
assert.equal(authorizedEdition.conveysActualRent, false);
assert.equal(authorizedEdition.digitalRentalEligible, true);

assert.throws(
  () => buildDigitalBuildingEdition({ canonicalPropertyKey: passport.propertyKey, creatorAuthorized: false, addressLinked: true }),
  /requires property-owner or authorized-controller permission/,
  'An unapproved person cannot create an address-linked official edition.'
);

const creativeEdition = buildDigitalBuildingEdition({ creatorAuthorized: false, addressLinked: false, supply: 1 });
assert.equal(creativeEdition.verifiedLink, false, 'Creative house art can exist without impersonating a verified property.');

const progression = propertyPurchaseProgression();
assert.ok(progression.some((step) => step.includes('recorded deed')), 'The real-world closing path must preserve recorded deed authority.');
assert.ok(progression.some((step) => step.includes('verified Property Passport')), 'Property Passport linkage must happen after closing evidence.');
assert.ok(progression.findIndex((step) => step.includes('recorded deed')) < progression.findIndex((step) => step.includes('verified Property Passport')), 'The Property Passport cannot outrun the deed/closing sequence.');

console.log('Property Passport truth tests passed.');
