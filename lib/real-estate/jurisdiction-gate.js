export const GLOBAL_ACQUISITION_POLICY_VERSION = '2026-08-pilot';

export const requiredJurisdictionChecks = [
  'foreignOwnershipPathVerified',
  'localEntityStructureVerified',
  'titleAndLienProcessVerified',
  'rentalUsePermitted',
  'taxTreatmentReviewed',
  'fundsAndFxPathReviewed',
  'insurancePathVerified',
  'propertyManagementPathVerified',
  'sanctionsAndKycPathVerified',
];

export function evaluateJurisdictionGate(checks = {}) {
  const missing = requiredJurisdictionChecks.filter((key) => checks[key] !== true);
  return {
    policyVersion: GLOBAL_ACQUISITION_POLICY_VERSION,
    eligible: missing.length === 0,
    missing,
    note: missing.length === 0
      ? 'Jurisdiction gate passed for this reviewed acquisition record.'
      : 'Acquisition blocked until every local legal, title, tax, rental and compliance check is verified.',
  };
}

export function acquisitionRecord({ country, region, checks = {}, reviewedBy = '', reviewedAt = '' } = {}) {
  const gate = evaluateJurisdictionGate(checks);
  return {
    country: String(country || ''),
    region: String(region || ''),
    reviewedBy: String(reviewedBy || ''),
    reviewedAt: String(reviewedAt || ''),
    ...gate,
  };
}
