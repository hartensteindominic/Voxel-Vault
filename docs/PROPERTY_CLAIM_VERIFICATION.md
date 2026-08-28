# Voxel Vault Property Claim Verification

## Purpose

This milestone turns the Real World Voxel / Property Passport concept into a controlled property-claim workflow without allowing a user to self-declare ownership, duplicate an official property identity, mint a deed-like NFT, or create rent rights.

The workflow is:

```text
real assessor jurisdiction + parcel/APN
→ server-normalized canonical property fingerprint
→ user-bound official claim
→ evidence-category completeness
→ human/admin evidence review
→ one verified claim per property identity
→ later controlled registry anchoring
→ only then: eligible non-transferable Property Passport mint
```

The Property Passport remains a digital identity/provenance NFT. It is not the recorded deed and it does not itself convey the property, tenancy, rent, or an investment interest.

## Canonical identity

Street addresses are not used as the unique property key. Addresses are display/search information and can vary by spelling, abbreviation, renaming, or postal formatting.

The application canonicalizes:

- country code,
- state/subdivision code for U.S. properties,
- assessor jurisdiction/county code,
- assessor parcel/APN identifier.

Formatting punctuation and whitespace are removed before the server derives a SHA-256 property fingerprint.

The database enforces a unique `property_fingerprint`, so differently formatted submissions for the same normalized parcel converge on the same `vault_property_identities` row.

This protects the one-real-property / one-canonical-twin rule before the property reaches the blockchain registry.

## User claim route

`/vault/properties/claim`

A signed-in user may submit an official claim only when they attest that they are:

- the property owner, or
- an authorized controller/agent.

The server requires `ownerAuthorized === true` as an exact boolean. String values such as `"false"` do not pass the authorization gate.

A friend, fan or creator may still make an unverified digital building elsewhere in Voxel Vault, but cannot use this route to make that model the official parcel-linked twin.

The form intentionally does not accept raw deeds, government IDs, bank information, or private documents. This milestone stores only property identity fields and evidence categories.

The required evidence categories are:

- parcel record,
- ownership/control evidence,
- model/capture rights.

Checking all categories moves a valid owner-authorized claim to `under-review`. It never produces `verified` automatically.

## Admin review route

`/admin/property-claims`

The reviewer console is protected by the existing Voxel Vault admin allowlist (`VOXEL_VAULT_ADMIN_EMAILS`, `VOXEL_VAULT_ADMIN_USER_IDS`, or compatible owner aliases).

A reviewer must:

1. independently inspect the external evidence,
2. provide a written reviewer note of at least 20 characters,
3. explicitly check the confirmation that the evidence was actually reviewed,
4. then choose Verify, Needs Evidence, or Reject.

The user-supplied evidence category checkmarks are metadata only; they are not proof.

Verification and rejection use the service-role-only PostgreSQL function `admin_review_property_claim`. It locks the claim and canonical identity rows with `FOR UPDATE`, so competing approvals cannot race each other or leave the claim and identity in contradictory states.

A verified claim is immutable in this pilot. Future suspension/revocation should be a separate governed workflow with audit history.

## Duplicate and dispute behavior

Multiple users may submit claims tied to the same canonical property identity so disputes can be reviewed rather than silently overwritten.

However:

- one user may have only one claim for a given property identity,
- the property identity fingerprint is globally unique,
- a partial unique database index permits only one `verified` claim per property identity,
- the canonical identity records one `verified_claim_id`,
- the transactional review function refuses a second competing verified claim.

Therefore competing claims can coexist in review, but only one can graduate to the verified canonical claim.

## Blockchain boundary

The existing `PropertyRegistry.sol` already rejects a second registration for the same `propertyId`.

The existing `PropertyPassport.sol` already:

- requires the registry record to be verified,
- rejects a second Passport mint for the same `propertyId`,
- makes the Passport non-transferable.

The user claim API and admin review API deliberately do **not** call:

- `PropertyRegistry.setVerified`,
- `PropertyPassport.mintVerifiedPassport`.

A successful off-chain claim review still reports:

```text
onchainRegistryVerified: false
passportMinted: false
deedChanged: false
propertyRightsCreated: false
```

The admin review transaction also deliberately does not set `registry_verified = true`.

Registry anchoring remains a separate controlled/testnet milestone. This prevents a reviewer click from silently creating an on-chain property identity.

## Rent and purchase boundary

A verified property claim does not:

- transfer the deed,
- authorize purchase of the property,
- move USD or crypto,
- issue a property-interest security,
- create tenant rent rights,
- distribute property income.

Actual property purchase remains contract + escrow/title/attorney closing + recorded deed.

Actual property rent remains available only to the legally entitled owner/entity/economic-interest structure after property accounting and distribution controls are implemented.

## Database prerequisites

This milestone requires both migrations, in order:

```text
supabase/migrations/015_property_identity_claims.sql
supabase/migrations/016_property_claim_admin_review.sql
```

Migration 015 creates:

- `vault_property_identities`,
- `vault_property_claims`,
- RLS for users to read only their own claims,
- server-only mutation behavior,
- unique canonical fingerprints,
- one verified claim per property identity.

Migration 016 adds:

- `verified_claim_id`, `verified_at`, and `verified_by` to the canonical identity,
- transactional claim/identity review locking,
- service-role-only execution permission for the review function,
- an explicit block against a second competing verified claim,
- no on-chain registry mutation or Passport mint.

Until migrations 015 and 016 are actually applied to the connected Supabase project, the claim/review APIs return `setupRequired: true` where required and fail closed. Merging this code does not apply those migrations remotely.

## Release tests

`npm run test:property-claims` verifies:

- parcel-format normalization,
- address text is excluded from the canonical identity,
- U.S. state + assessor jurisdiction requirements,
- string `"false"` cannot bypass authorization,
- no self-verification,
- no claim-triggered Passport mint,
- no claim-triggered on-chain registry verification,
- safe public claim summaries,
- server-only database mutation,
- one verified claim per property identity,
- transactional row locking for approval,
- service-role-only review execution,
- competing-claim rejection,
- admin allowlist usage,
- reviewer-note and explicit evidence-confirmation requirements,
- existing registry duplicate protection,
- existing non-transferable, one-per-property Passport protection.

The GitHub Quality Gate runs this test before the Next.js build.
