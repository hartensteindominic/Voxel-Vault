# Voxel Vault Legal Approval Evidence Specification

## Purpose

This specification defines the records Voxel Vault needs before a real-estate investment gate can be treated as satisfied. It is an engineering control, not a legal opinion, registration, filing or authorization.

No repository commit, founder decision, admin toggle, screenshot or environment variable can make an offering legal. The decision must come from the licensed professional or regulated provider responsible for that gate, and the supporting record must be retained in controlled storage.

## Current implementation state

- Legal clearance claimed: `false`
- Authority evidence verifier implemented: `false`
- Live investor money movement: `blocked`
- Live economic-interest issuance: `blocked`
- Automatic reinvestment: `blocked`

Environment variables are accepted only as operational assertions. Until the verifier is connected, every assertion remains `asserted-unverified` and every launch gate remains unsatisfied.

## Public-safe record shape

Private evidence stays in the controlled legal data room. A future verifier may expose only a public-safe record such as:

```json
{
  "gateId": "registeredIntermediaryAgreementActive",
  "decision": "approved",
  "authorityRole": "registered-intermediary",
  "reviewedAt": "YYYY-MM-DD",
  "nextReviewAt": "YYYY-MM-DD",
  "scope": "offering-id + issuer-id + property-id",
  "jurisdictions": ["US", "US-NY"],
  "controlledRecordId": "opaque-private-record-id",
  "documentSha256": "64-lowercase-hex-characters",
  "registryReference": "official-public-registry-reference",
  "revokedAt": null
}
```

The public record must not contain legal advice, signatures, identity documents, tax IDs, bank details, tenant data, private keys or unredacted title/closing files.

## Acceptance rules

A gate may become authority-evidence verified only when all applicable rules pass:

1. The decision is `approved` by the authority assigned to that exact gate.
2. The approval scope matches the actual issuer, offering, property, product flow and jurisdictions.
3. The controlled record exists and its approved version matches the stored SHA-256 digest.
4. The approval is not expired, superseded, rejected, revoked or limited in a way the product violates.
5. Any required intermediary or provider registration is checked against an official source.
6. A second controlled verification record shows who checked the evidence and when.
7. The production integration passes provider-authoritative end-to-end testing and reconciliation.
8. A reviewed release explicitly enables only the approved scope after the code, security and contract gates pass.

An environment assertion can help operators notice expected configuration. It cannot satisfy any acceptance rule above.

## Required gates and authorities

| Gate | Deciding authority | Minimum controlled evidence |
| --- | --- | --- |
| Registered intermediary agreement | SEC/FINRA-registered intermediary + securities counsel | Official registration, executed agreement, written services scope. |
| Offering authorization | Securities counsel + registered intermediary | Approved exemption path, filing record, disclosures and communications controls. |
| Securities structure | Licensed securities counsel | Written structure, token-rights and investor-flow approval. |
| Property and title | Property/title counsel + title company | Title, liens, parcel and property/entity linkage review. |
| Issuer entity | Issuer counsel + property/title counsel | Good standing, operating authority, capitalization and property-control evidence. |
| Investor eligibility | Intermediary + approved compliance provider | KYC/AML, sanctions, jurisdiction and investor-limit/accreditation workflow. |
| Escrow and settlement | Intermediary + escrow/payment provider | Executed arrangement, closing/refund rules and authoritative settlement states. |
| Custody and wallet rails | Counsel + approved custody/wallet provider | Custody model, wallet binding, account control and recovery rules. |
| Recordkeeping and transfers | Counsel + authoritative recordkeeper | Securityholder authority, transfer rules and cap-table/on-chain reconciliation. |
| Property accounting | Property manager + accounting reviewer | Operating accounts, expenses, reserves and distribution-statement process. |
| Tax reporting | Qualified tax counsel/accounting provider | Issuer treatment, investor reports and digital-asset records. |
| Smart contracts | Independent contract/security reviewer | Final-scope audit, resolved findings and production bytecode review. |
| Privacy and security | Privacy counsel + security reviewer | Data flow, retention, access control and approved notices. |
| Terms and disclosures | Securities/privacy counsel + intermediary | Approved terms, risk disclosures, marketing and investor communications. |
| Incident response | Provider owners + counsel + security reviewer | Pause authority, incident runbook and investor notification/support process. |
| Provider integration | Intermediary + each production provider | End-to-end sandbox evidence, signed event proof, reconciliation and production acceptance. |

## Evidence lifecycle

```text
missing
  -> submitted to authority
  -> authority decision recorded
  -> independently verified
  -> active for exact approved scope
  -> expired, superseded or revoked
```

Any expiry, revocation, scope mismatch, missing provider event or failed reconciliation moves the affected capability back to blocked.

## Production activation boundary

The future activation decision must require all of the following at the same time:

```text
all authority evidence active for the exact scope
AND evidence verifier implementation reviewed
AND provider integration verified
AND production code implementation reviewed
AND security and contract release checks passed
AND explicit release approval present
= controlled live capability for that approved scope only
```

The current repository deliberately cannot satisfy this formula. Implementing the verifier must be a separate reviewed change after counsel and providers define their authoritative records and interfaces.

## Reviewer handoff

Reviewers should start with:

1. [Regulated Launch Packet](./REGULATED_LAUNCH_PACKET.md)
2. [Legal Review Data Room](./LEGAL_REVIEW_DATA_ROOM.md)
3. This evidence specification
4. The actual private issuer, property, provider and offering records

Review decisions should be returned as scoped records, not as informal approval messages.
