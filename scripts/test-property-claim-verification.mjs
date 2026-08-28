import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildPublicClaimSummary,
  canonicalizePropertyIdentity,
  evaluatePropertyClaim,
  propertyFingerprint,
  PROPERTY_REVIEW_RULES,
} from '../lib/vault/property-claim.js';
import {
  authoritativePropertyFingerprint,
  canonicalizeAuthoritativePropertyIdentity,
} from '../lib/vault/verified-property-identity.js';

const first = {
  countryCode: 'us',
  subdivisionCode: 'ny',
  countyCode: 'Erie County',
  parcelId: '12-34.500',
  address: '123 Main Street',
};
const sameParcelDifferentFormatting = {
  countryCode: 'US',
  subdivisionCode: 'NY',
  countyCode: 'ERIE-COUNTY',
  parcelId: '12 34 500',
  address: '123 MAIN ST.',
};

const identity = canonicalizePropertyIdentity(first);
assert.equal(identity.canonicalKey, 'US:NY:ERIECOUNTY:1234500');
assert.equal(propertyFingerprint(first), propertyFingerprint(sameParcelDifferentFormatting), 'Formatting differences must converge on one parcel fingerprint.');

const sameParcelDifferentAddressText = { ...sameParcelDifferentFormatting, address: 'Completely Different Address Text' };
assert.equal(propertyFingerprint(first), propertyFingerprint(sameParcelDifferentAddressText), 'Street-address text must not control the canonical property identity.');

const freeTextAliasA = { ...first, countyCode: 'ERIE' };
const freeTextAliasB = { ...first, countyCode: 'ERIE COUNTY' };
assert.notEqual(propertyFingerprint(freeTextAliasA), propertyFingerprint(freeTextAliasB), 'Candidate fingerprints may diverge when claimants use different free-text jurisdiction aliases.');

const authoritativeA = canonicalizeAuthoritativePropertyIdentity({
  namespace: 'US-NY-FIPS-029',
  parcelId: '12-34.500',
});
const authoritativeB = canonicalizeAuthoritativePropertyIdentity({
  namespace: 'us ny fips 029',
  parcelId: '12 34 500',
});
assert.equal(authoritativeA.canonicalKey, 'USNYFIPS029:1234500');
assert.equal(
  authoritativePropertyFingerprint(authoritativeA),
  authoritativePropertyFingerprint(authoritativeB),
  'Reviewer-supplied official jurisdiction namespace + parcel must converge despite formatting differences.',
);
assert.throws(() => canonicalizeAuthoritativePropertyIdentity({ namespace: '', parcelId: '123' }), /jurisdiction namespace/i);
assert.throws(() => canonicalizeAuthoritativePropertyIdentity({ namespace: 'US-NY-FIPS-029', parcelId: '' }), /parcel\/APN/i);

assert.throws(() => canonicalizePropertyIdentity({ countryCode: 'US', countyCode: 'ERIE', parcelId: '123' }), /state\/subdivision/i, 'U.S. claims require a state/subdivision.');
assert.throws(() => canonicalizePropertyIdentity({ countryCode: 'US', subdivisionCode: 'NY', parcelId: '123' }), /assessor jurisdiction\/county/i, 'Claims require an assessor jurisdiction.');
assert.throws(() => canonicalizePropertyIdentity({ countryCode: 'USA', subdivisionCode: 'NY', countyCode: 'ERIE', parcelId: '123' }), /two-letter country code/i);

const evidenceTypes = ['parcel-record', 'ownership-or-control', 'model-capture-rights'];
const unauthorized = evaluatePropertyClaim({ ...first, claimantRole: 'owner', ownerAuthorized: false, evidenceTypes });
assert.equal(unauthorized.canEnterOfficialReview, false);
assert.equal(unauthorized.status, 'needs-evidence');
assert.equal(unauthorized.autoVerified, false);
assert.equal(unauthorized.canonicalMintAllowed, false);

const hostileStringFalse = evaluatePropertyClaim({ ...first, claimantRole: 'owner', ownerAuthorized: 'false', evidenceTypes });
assert.equal(hostileStringFalse.ownerAuthorized, false, 'String "false" must never satisfy the authorization gate.');
assert.equal(hostileStringFalse.canEnterOfficialReview, false, 'Only exact boolean true may attest owner authorization.');

const incomplete = evaluatePropertyClaim({ ...first, claimantRole: 'owner', ownerAuthorized: true, evidenceTypes: ['parcel-record'] });
assert.equal(incomplete.status, 'needs-evidence');
assert.equal(incomplete.autoVerified, false);
assert.equal(incomplete.hasRequiredEvidenceMetadata, false);

const reviewReady = evaluatePropertyClaim({ ...first, claimantRole: 'authorized-controller', ownerAuthorized: true, evidenceTypes });
assert.equal(reviewReady.status, 'under-review', 'Complete claim metadata may only enter review.');
assert.equal(reviewReady.autoVerified, false, 'Self-submitted evidence metadata must never auto-verify a property.');
assert.equal(reviewReady.canonicalMintAllowed, false, 'A review-ready claim cannot mint a canonical Passport.');
assert.equal(reviewReady.hasRequiredEvidenceMetadata, true);

assert.equal(PROPERTY_REVIEW_RULES.humanApprovalRequired, true);
assert.equal(PROPERTY_REVIEW_RULES.approvalCreatesDeed, false);
assert.equal(PROPERTY_REVIEW_RULES.approvalMintsPassport, false);
assert.equal(PROPERTY_REVIEW_RULES.approvalSetsOnchainRegistryVerified, false);
assert.ok(PROPERTY_REVIEW_RULES.reviewerNoteMinLength >= 20);

const summary = buildPublicClaimSummary({
  id: 'claim-1',
  status: 'under-review',
  claimantRole: 'owner',
  propertyFingerprint: reviewReady.fingerprint,
  propertyLabel: 'My home',
  locality: 'Buffalo, NY',
  evidenceTypes: reviewReady.evidenceTypes,
  registryVerified: false,
});
assert.equal(summary.propertyFingerprintSuffix.length, 10);
assert.equal('propertyFingerprint' in summary, false, 'The browser summary must not expose the full canonical fingerprint.');
assert.equal('parcelId' in summary, false, 'The browser summary must not expose the normalized parcel identifier.');
assert.equal(summary.canonicalMintAllowed, false);

const migration015 = fs.readFileSync(new URL('../supabase/migrations/015_property_identity_claims.sql', import.meta.url), 'utf8');
assert.match(migration015, /property_fingerprint text not null unique/i, 'Database must enforce one canonical identity per fingerprint.');
assert.match(migration015, /unique \(property_identity_id, user_id\)/i, 'A user cannot fork duplicate claims for the same identity.');
assert.match(migration015, /where claim_status = 'verified'/i, 'Only one verified claim may exist per canonical property identity.');
assert.match(migration015, /enable row level security/i);
assert.match(migration015, /users read own property claims/i);
assert.doesNotMatch(migration015, /for insert to authenticated/i, 'Clients must not be able to insert official claims directly around server verification logic.');

const migration016 = fs.readFileSync(new URL('../supabase/migrations/016_property_claim_admin_review.sql', import.meta.url), 'utf8');
assert.match(migration016, /verified_claim_id uuid/i, 'Canonical identity must remember the single approved claim.');
assert.match(migration016, /for update/i, 'Approval must lock the claim and identity rows transactionally.');
assert.match(migration016, /PROPERTY_ALREADY_VERIFIED_BY_ANOTHER_CLAIM/i, 'Competing verified claims must fail closed.');
assert.match(migration016, /claim_status = 'verified'/i);
assert.match(migration016, /canonical_state = 'verified'/i);
assert.doesNotMatch(migration016, /registry_verified\s*=\s*true/i, 'Human review must never silently mark the blockchain registry verified.');

const migration018 = fs.readFileSync(new URL('../supabase/migrations/018_authoritative_verified_property_identity.sql', import.meta.url), 'utf8');
assert.match(migration018, /verified_property_fingerprint text/i, 'Verified identities need a second authoritative property fingerprint.');
assert.match(migration018, /unique index[\s\S]*verified_property_fingerprint/i, 'Authoritative property fingerprints must be unique across canonical identities.');
assert.match(migration018, /drop function if exists public\.admin_review_property_claim\(uuid, text, uuid, text\)/i, 'The legacy approval signature must be removed so it cannot bypass the authoritative key gate.');
assert.match(migration018, /AUTHORITATIVE_PROPERTY_FINGERPRINT_REQUIRED/i);
assert.match(migration018, /PROPERTY_AUTHORITATIVE_IDENTITY_CONFLICT/i);
assert.match(migration018, /p_authoritative_fingerprint text/i);
assert.match(migration018, /verified_property_fingerprint = v_fingerprint/i);
assert.doesNotMatch(migration018, /registry_verified\s*=\s*true/i, 'Authoritative identity approval must remain off-chain.');
assert.match(migration018, /revoke all on function public\.admin_review_property_claim.*authenticated/is, 'Authenticated clients must not call the privileged authoritative review function directly.');
assert.match(migration018, /grant execute on function public\.admin_review_property_claim.*service_role/is, 'Only the server service role may execute the authoritative review transaction.');

const route = fs.readFileSync(new URL('../app/api/vault/property-claims/route.ts', import.meta.url), 'utf8');
assert.match(route, /requireVoxelVaultUser/);
assert.match(route, /upsert\(identityInsert, \{ onConflict: 'property_fingerprint' \}\)/, 'Concurrent duplicate claims must converge on the unique fingerprint.');
assert.match(route, /\.in\('claim_status', REVIEWABLE_STATUSES\)/, 'Claimant edits must only update non-terminal reviewable states.');
assert.match(route, /The property claim changed during review and could not be refreshed/i, 'Concurrent state changes must fail closed/refetch instead of overwriting review state.');
assert.match(route, /String\(inserted\.error\?\.code \|\| ''\) === '23505'/, 'Concurrent duplicate claim creation must converge on the existing row rather than producing a false duplicate workflow.');
assert.match(route, /This claim is already human-verified and cannot be changed from the claimant form/i, 'Terminal verified claims must return terminal-state guidance.');
assert.match(route, /This claim was rejected and is locked in this pilot/i, 'Rejected claims must not misleadingly appear review-ready after resubmission.');
assert.match(route, /Human verification must validate the evidence/i);
assert.doesNotMatch(route, /mintVerifiedPassport\s*\(/, 'Claim API must not mint the Passport.');
assert.doesNotMatch(route, /setVerified\s*\(/, 'Claim API must not verify the on-chain registry.');

const page = fs.readFileSync(new URL('../app/vault/properties/claim/page.js', import.meta.url), 'utf8');
assert.match(page, /One real parcel/i);
assert.match(page, /Do not paste deeds, IDs, bank information or private documents here/i);
assert.match(page, /still only moves the claim to human review/i);
assert.match(page, /does not create rent rights/i);

const adminRoute = fs.readFileSync(new URL('../app/api/admin/property-claims/route.ts', import.meta.url), 'utf8');
assert.match(adminRoute, /requireVoxelVaultAdmin/);
assert.match(adminRoute, /reviewer note must be between 20 and 1000 characters/i);
assert.match(adminRoute, /evidenceVerified/);
assert.match(adminRoute, /authoritativePropertyFingerprint/);
assert.match(adminRoute, /canonicalizeAuthoritativePropertyIdentity/);
assert.match(adminRoute, /p_authoritative_fingerprint: authoritativeFingerprintValue/);
assert.match(adminRoute, /p_authoritative_namespace: authoritativeNamespace/);
assert.match(adminRoute, /official assessor\/title source/i);
assert.match(adminRoute, /rpc\('admin_review_property_claim'/, 'Approval/rejection must use the transactional database transition.');
assert.match(adminRoute, /\.in\('claim_status', \['needs-evidence', 'under-review'\]\)/, 'Needs-evidence transitions must not overwrite a concurrently terminal claim.');
assert.match(adminRoute, /This claim is no longer reviewable/i, 'Race-lost admin updates must fail closed.');
assert.match(adminRoute, /onchainRegistryVerified: false/);
assert.match(adminRoute, /passportMinted: false/);
assert.match(adminRoute, /deedChanged: false/);
assert.match(adminRoute, /propertyRightsCreated: false/);
assert.doesNotMatch(adminRoute, /mintVerifiedPassport\s*\(/, 'Reviewer API must not mint the Passport.');
assert.doesNotMatch(adminRoute, /setVerified\s*\(/, 'Reviewer API must not set the on-chain registry verified.');

const adminPage = fs.readFileSync(new URL('../app/admin/property-claims/page.js', import.meta.url), 'utf8');
assert.match(adminPage, /Never guess ownership/i);
assert.match(adminPage, /claimant-supplied metadata, not proof/i);
assert.match(adminPage, /AUTHORITATIVE PARCEL KEY/i);
assert.match(adminPage, /Official jurisdiction namespace\/code/i);
assert.match(adminPage, /I independently reviewed the external parcel record/i, 'Verify action must require explicit human evidence confirmation.');
assert.match(adminPage, /PASSPORT MINTS HERE/i);

const registry = fs.readFileSync(new URL('../contracts/PropertyRegistry.sol', import.meta.url), 'utf8');
const passport = fs.readFileSync(new URL('../contracts/PropertyPassport.sol', import.meta.url), 'utf8');
assert.match(registry, /PropertyAlreadyRegistered/);
assert.match(passport, /PassportAlreadyMinted/);
assert.match(passport, /PassportNonTransferable/);

console.log('Property claim verification tests passed.');
