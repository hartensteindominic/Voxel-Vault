const finiteCount = (value, max = 1_000_000) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(max, Math.floor(number));
};

export const WORLD_STEWARDSHIP_POLICY = Object.freeze({
  policyVersion: '2026-08-28-v1',
  baseAnnualCents: 100,
  globalLinearIncrementCents: 25,
  regionalLinearIncrementCents: 75,
  maxNextClaimAnnualCents: 25_000,
  regionalClaimCapPerAccount: 20,
  globalClaimCapPerAccount: 10_000,
  regionGridDegrees: 0.05,
  ownerOrAdminExemption: false,
  billingEnabled: false,
});

export const WORLD_STEWARDSHIP_DISCLOSURE =
  'Voxel Vault stewardship is a digital-atlas platform mechanic, not a government property tax, deed, title, tenancy, rent right, or ownership of the physical Earth.';

export function worldStewardshipRegionId(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return '';
  }
  const size = WORLD_STEWARDSHIP_POLICY.regionGridDegrees;
  const latIndex = Math.floor((lat + 90) / size);
  const lonIndex = Math.floor((lon + 180) / size);
  return `atlas:${size.toFixed(2)}:${latIndex}:${lonIndex}`;
}

export function quoteWorldStewardship(input = {}) {
  const existingGlobalClaims = finiteCount(input.existingGlobalClaims, WORLD_STEWARDSHIP_POLICY.globalClaimCapPerAccount + 1);
  const existingRegionalClaims = finiteCount(input.existingRegionalClaims, WORLD_STEWARDSHIP_POLICY.regionalClaimCapPerAccount + 1);

  const uncappedAnnualCents = WORLD_STEWARDSHIP_POLICY.baseAnnualCents
    + existingGlobalClaims * WORLD_STEWARDSHIP_POLICY.globalLinearIncrementCents
    + existingRegionalClaims * WORLD_STEWARDSHIP_POLICY.regionalLinearIncrementCents;
  const nextClaimAnnualCents = Math.min(WORLD_STEWARDSHIP_POLICY.maxNextClaimAnnualCents, uncappedAnnualCents);

  const blockers = [];
  if (existingGlobalClaims >= WORLD_STEWARDSHIP_POLICY.globalClaimCapPerAccount) {
    blockers.push('Global digital-stewardship claim cap reached for this account.');
  }
  if (existingRegionalClaims >= WORLD_STEWARDSHIP_POLICY.regionalClaimCapPerAccount) {
    blockers.push('Local concentration cap reached in this atlas region.');
  }

  return {
    policyVersion: WORLD_STEWARDSHIP_POLICY.policyVersion,
    existingGlobalClaims,
    existingRegionalClaims,
    nextClaimAnnualCents,
    nextClaimMonthlyEquivalentCents: Math.round(nextClaimAnnualCents / 12),
    schedule: 'linear-marginal',
    formula: `$${(WORLD_STEWARDSHIP_POLICY.baseAnnualCents / 100).toFixed(2)} base + $${(WORLD_STEWARDSHIP_POLICY.globalLinearIncrementCents / 100).toFixed(2)} per existing global claim + $${(WORLD_STEWARDSHIP_POLICY.regionalLinearIncrementCents / 100).toFixed(2)} per existing claim in the same region`,
    allowed: blockers.length === 0,
    blockers,
    regionalClaimCapPerAccount: WORLD_STEWARDSHIP_POLICY.regionalClaimCapPerAccount,
    globalClaimCapPerAccount: WORLD_STEWARDSHIP_POLICY.globalClaimCapPerAccount,
    billingEnabled: WORLD_STEWARDSHIP_POLICY.billingEnabled,
    ownerOrAdminExemption: WORLD_STEWARDSHIP_POLICY.ownerOrAdminExemption,
    economicEffect: WORLD_STEWARDSHIP_POLICY.billingEnabled
      ? 'A disclosed Voxel Vault platform stewardship fee would be due under the current policy.'
      : 'Quote only. No stewardship fee is currently collected or transferred.',
    rightsEffect: {
      createsPhysicalPropertyOwnership: false,
      createsTitle: false,
      createsTaxLien: false,
      createsGovernmentTaxObligation: false,
      grantsExclusiveMapDataOwnership: false,
    },
    disclosure: WORLD_STEWARDSHIP_DISCLOSURE,
  };
}
