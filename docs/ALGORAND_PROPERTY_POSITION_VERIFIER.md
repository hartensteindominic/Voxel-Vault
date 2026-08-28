# Algorand Property Position Verifier

## Purpose

Voxel Vault needs a way to verify blockchain evidence for property-specific fractional positions without ever receiving a seed phrase, private key, signing authority or custody access.

This verifier handles only the first blockchain fact:

> Does this public Algorand address currently hold a positive quantity of this exact Algorand asset ID?

That fact is useful evidence. It is **not** enough to prove that the authenticated Voxel Vault user controls the wallet, that the asset represents a particular property-owning entity, or that the holder has legally enforceable real-property/security rights.

## Official API shape

The implementation follows Algorand's current public Indexer API shapes:

- `GET /v2/accounts/{account-id}/assets?asset-id={asset-id}` — lookup an account's asset holdings for a specific asset ID.
- `GET /v2/assets/{asset-id}` — lookup the asset metadata/creator for a specific asset ID.

Official references reviewed August 28, 2026:

- https://dev.algorand.co/reference/rest-api/indexer/operations/lookupaccountassets/
- https://dev.algorand.co/reference/rest-api/indexer/operations/lookupassetbyid/

Voxel Vault does not hardcode an unofficial third-party hosted Indexer. A trusted HTTPS Indexer endpoint must be configured privately in the deployment environment.

## Server-only configuration

```text
ALGORAND_INDEXER_BASE_URL=
ALGORAND_INDEXER_API_TOKEN=
ALGORAND_INDEXER_API_TOKEN_HEADER=X-Indexer-API-Token
ALGORAND_READONLY_POSITION_VERIFICATION_ENABLED=false
```

The API token is optional because some approved Indexer deployments may not require one. If used, it stays server-side and is never returned by the status API or sent to the browser.

The enable switch controls only **read-only public-chain lookups**. It cannot enable buying, selling, signing, reinvestment or legal ownership verification.

## Owner routes

- Console: `/admin/fractional-property/algorand-verifier`
- API: `/api/admin/fractional-property/algorand-verify`

Both use the existing Voxel Vault owner/admin authentication boundary. The API is private/no-store.

## Verification states

The current proof chain is intentionally separated:

```text
Public Algorand address + asset ID
        |
        v
ON-CHAIN HOLDING VERIFIED
        |
        | future signed wallet-control challenge
        v
WALLET CONTROL VERIFIED
        |
        | approved issuer/entity/property mapping
        v
ISSUER + PROPERTY MAPPING VERIFIED
        |
        | canonical parcel + legal rights evidence
        v
FRACTIONAL POSITION VERIFIED
```

Current implementation readiness:

- Read-only on-chain holding verifier: **implemented**
- Wallet-control verifier: **not implemented**
- Approved issuer/legal-entity/property mapping verifier: **not implemented**
- Legal property-rights promotion: **disabled**
- Trade execution: **disabled**
- Automatic reinvestment: **disabled**

## Address and asset safety

The verifier:

- accepts a public Algorand address only;
- validates the 58-character Base32 structure and Algorand checksum;
- accepts a positive uint64 asset ID only;
- requests the exact asset holding and exact asset metadata;
- confirms a positive non-deleted holding before setting `onChainHoldingVerified=true`;
- does not ask for or accept a transaction signature;
- does not place an order;
- does not transfer funds;
- does not upgrade `rightsType` beyond `reference_only`.

## What on-chain verification does not prove

A positive asset balance does not, by itself, prove:

- the Voxel Vault user controls that wallet;
- the wallet holder is the legally recognized investor;
- the asset is mapped to the provider position the user claims;
- the asset is mapped to the stated LLC/entity;
- the LLC/entity owns the stated deed/parcel;
- the interest is legally transferable to the holder;
- title is clear;
- rent or valuation figures are accurate;
- the asset will appreciate.

Those facts need separate authoritative evidence and reconciliation.

## Next verifier

The next safe proof step is a **wallet-control challenge** that asks the wallet to sign a one-time challenge without moving funds. After that, Voxel Vault still needs an approved issuer/provider registry mapping:

```text
Algorand asset ID
  -> issuer / property entity
  -> legally defined holder rights
  -> canonical parcel identity
  -> title / property evidence
```

Only after those mappings are independently verified should the property truth model be allowed to promote a position from `REFERENCE ONLY` to `FRACTIONAL POSITION VERIFIED`.
