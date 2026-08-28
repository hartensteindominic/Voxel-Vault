import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildPublicClaimSummary,
  canonicalizePropertyIdentity,
  evaluatePropertyClaim,
  propertyFingerprint,
} from '../lib/vault/property-claim.js';

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

assert.throws(() => canonicalizePropertyIdentity({ countryCode: 'US', countyCode: 'ERIE', parcelId: '123' }), /state\/subdivision/i, 'U.S. claims require a state/subdivision.');
assert.throws(() => canonicalizePropertyIdentity({ countryCode: 'US', subdivisionCode: 'NY', parcelId: '123' }), /assessor jurisdiction\/county/i, 'Claims require an assessor jurisdiction.');

const unauthorized = evaluatePropertyClaim({ ...first, claimantRole: 'owner', ownerAuthorized: false, evidenceTypes: ['parcel-record','ownership-or-control','model-capture-rights'] });
assert.equal(unauthorized.canEnterOfficialReview, false);
assert.equal(unauthorized.status, 'needs-evidence');
assert.equal(unauthorized.autoVerified, false);
assert.equal(unauthorized.canonicalMintAllowed, false);

const incomplete = evaluatePropertyClaim({ ...first, claimantRole: 'owner', ownerAuthorized: true, evidenceTypes: ['parcel-record'] });
assert.equal(incomplete.status, 'needs-evidence');
assert.equal(incomplete.autoVerified, false);

const reviewReady = evaluatePropertyClaim({ ...first, claimantRole: 'authorized-controller', ownerAuthorized: true, evidenceTypes: ['parcel-record','ownership-or-control','model-capture-rights'] });
assert.equal(reviewReady.status, 'under-review', 'Complete claim metadata may only enter review.');
assert.equal(reviewReady.autoVerified, false, 'Self-submitted evidence metadata must never auto-verify a property.');
assert.equal(reviewReady.canonicalMintAllowed, false, 'A review-ready claim cannot mint a canonical Passport.');

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

const migration = fs.readFileSync(new URL('../supabase/migrations/015_property_identity_claims.sql', import.meta.url), 'utf8');
assert.match(migration, /property_fingerprint text not null unique/i, 'Database must enforce one canonical identity per fingerprint.');
assert.match(migration, /unique \(property_identity_id, user_id\)/i, 'A user cannot fork duplicate claims for the same identity.');
assert.match(migration, /enable row level security/i);
assert.match(migration, /users read own property claims/i);
assert.doesNotMatch(migration, /for insert to authenticated/i, 'Clients must not be able to insert official claims directly around server verification logic.');

const route = fs.readFileSync(new URL('../app/api/vault/property-claims/route.ts', import.meta.url), 'utf8');
assert.match(route, /requireVoxelVaultUser/);
assert.match(route, /upsert\(identityInsert, \{ onConflict: 'property_fingerprint' \}\)/, 'Concurrent duplicate claims must converge on the unique fingerprint.');
assert.match(route, /Human verification must validate the evidence/i);
assert.doesNotMatch(route, /mintVerifiedPassport\s*\(/, 'Claim API must not mint the Passport.');
assert.doesNotMatch(route, /setVerified\s*\(/, 'Claim API must not verify the on-chain registry.');

const page = fs.readFileSync(new URL('../app/vault/properties/claim/page.js', import.meta.url), 'utf8');
assert.match(page, /One real parcel/i);
assert.match(page, /Do not paste deeds, IDs, bank information or private documents here/i);
assert.match(page, /still only moves the claim to human review/i);
assert.match(page, /does not create rent rights/i);

const registry = fs.readFileSync(new URL('../contracts/PropertyRegistry.sol', import.meta.url), 'utf8');
const passport = fs.readFileSync(new URL('../contracts/PropertyPassport.sol', import.meta.url), 'utf8');
assert.match(registry, /PropertyAlreadyRegistered/);
assert.match(passport, /PassportAlreadyMinted/);
assert.match(passport, /PassportNonTransferable/);

console.log('Property claim verification tests passed.');
