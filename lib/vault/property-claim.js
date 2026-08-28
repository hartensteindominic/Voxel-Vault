import { createHash } from 'node:crypto';

const clean = (value) => String(value ?? '').trim();
const compactUpper = (value) => clean(value).toUpperCase().replace(/[^A-Z0-9]/g, '');

export const PROPERTY_CLAIM_STATUSES = Object.freeze({
  NEEDS_EVIDENCE: 'needs-evidence',
  UNDER_REVIEW: 'under-review',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
});

export const OFFICIAL_CLAIM_ROLES = Object.freeze(['owner', 'authorized-controller']);
export const PROPERTY_EVIDENCE_TYPES = Object.freeze([
  'parcel-record',
  'ownership-or-control',
  'model-capture-rights',
]);

export function canonicalizePropertyIdentity(input = {}) {
  const countryCode = compactUpper(input.countryCode);
  const subdivisionCode = compactUpper(input.subdivisionCode);
  const countyCode = compactUpper(input.countyCode);
  const parcelId = compactUpper(input.parcelId);

  if (countryCode.length !== 2) throw new Error('A two-letter country code is required.');
  if (!parcelId) throw new Error('An assessor/parcel identifier is required.');

  // Address text is intentionally excluded. Postal formatting and street aliases are
  // not stable enough to enforce the one-canonical-twin rule.
  const canonicalKey = [countryCode, subdivisionCode || '-', countyCode || '-', parcelId].join(':');

  return {
    countryCode,
    subdivisionCode,
    countyCode,
    parcelId,
    canonicalKey,
  };
}

export function propertyFingerprint(input = {}) {
  const identity = canonicalizePropertyIdentity(input);
  return createHash('sha256').update(`voxel-vault-property-v1:${identity.canonicalKey}`).digest('hex');
}

export function normalizeEvidenceTypes(types = []) {
  const allowed = new Set(PROPERTY_EVIDENCE_TYPES);
  return [...new Set((Array.isArray(types) ? types : []).map((value) => clean(value).toLowerCase()).filter((value) => allowed.has(value)))];
}

export function evaluatePropertyClaim(input = {}) {
  const identity = canonicalizePropertyIdentity(input);
  const claimantRole = clean(input.claimantRole).toLowerCase();
  const ownerAuthorized = Boolean(input.ownerAuthorized);
  const evidenceTypes = normalizeEvidenceTypes(input.evidenceTypes);
  const evidence = new Set(evidenceTypes);

  const roleEligible = OFFICIAL_CLAIM_ROLES.includes(claimantRole);
  const hasRequiredEvidenceMetadata = PROPERTY_EVIDENCE_TYPES.every((type) => evidence.has(type));
  const canEnterOfficialReview = roleEligible && ownerAuthorized;

  return {
    identity,
    fingerprint: propertyFingerprint(identity),
    claimantRole,
    ownerAuthorized,
    evidenceTypes,
    roleEligible,
    canEnterOfficialReview,
    status: canEnterOfficialReview && hasRequiredEvidenceMetadata
      ? PROPERTY_CLAIM_STATUSES.UNDER_REVIEW
      : PROPERTY_CLAIM_STATUSES.NEEDS_EVIDENCE,
    autoVerified: false,
    canonicalMintAllowed: false,
    note: canEnterOfficialReview
      ? 'Claim metadata can enter human verification. It cannot self-verify or mint the canonical Property Passport.'
      : 'Official address/parcel linkage requires the owner or an authorized controller. Unverified building art remains a separate collectible path.',
  };
}

export function buildPublicClaimSummary(claim = {}) {
  const fingerprint = clean(claim.propertyFingerprint || claim.fingerprint);
  return {
    id: clean(claim.id),
    status: clean(claim.status || PROPERTY_CLAIM_STATUSES.NEEDS_EVIDENCE),
    claimantRole: clean(claim.claimantRole),
    propertyFingerprintSuffix: fingerprint ? fingerprint.slice(-10) : '',
    propertyLabel: clean(claim.propertyLabel),
    locality: clean(claim.locality),
    evidenceTypes: normalizeEvidenceTypes(claim.evidenceTypes),
    verified: clean(claim.status) === PROPERTY_CLAIM_STATUSES.VERIFIED,
    autoVerified: false,
    canonicalMintAllowed: clean(claim.status) === PROPERTY_CLAIM_STATUSES.VERIFIED && Boolean(claim.registryVerified),
  };
}
