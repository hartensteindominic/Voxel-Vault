# Fractional Property Provider Strategy

## Product goal

Voxel Vault should let a user with modest capital hold legally meaningful fractional interests in specific rental properties, see each underlying parcel/building as a source-backed 3D Spatial Vault, receive provider-reported net rental distributions, and eventually reinvest under explicit user controls when an approved production integration exists.

The blockchain layer must never be presented as if it replaces the recorded deed, the property-owning entity, the operating agreement, title records, property accounting or investor-protection obligations.

## Current reference provider: Lofty

As reviewed on August 28, 2026, Lofty's public materials are the closest current reference for the desired property-specific ownership experience. Lofty currently describes:

- direct fractional ownership in a property-specific LLC;
- property shares commonly priced around $50 or less;
- daily rental-income distributions;
- a 24/7 property-share marketplace;
- blockchain / USDC settlement;
- provider identity verification before investing;
- investor voting on property decisions;
- separate property financials, inspection/diligence material and ownership documents.

Official references reviewed:

- https://www.lofty.ai/how-it-works
- https://www.lofty.ai/marketplace
- https://www.lofty.ai/terms
- https://www.lofty.ai/real-estate-investing/tokenized-real-estate

This is a **reference-provider / external-handoff model**, not an affiliation, endorsement, recommendation, or approved Voxel Vault trading integration. Lofty states on its site that Lofty AI, Inc. is not a registered broker-dealer or investment adviser and does not provide investment recommendations. Eligibility, offering terms and the legal meaning of a particular position must come from the provider's current documents and the investor's own legal/tax review where appropriate.

## Important integration boundary

Voxel Vault must not scrape Lofty's interface or imitate an undocumented private API. Lofty's May 1, 2026 Terms of Service list data mining, robots, scraping and similar extraction from its Products as prohibited activity.

As of the August 28, 2026 review, Voxel Vault has **not verified a public production developer API or partnership that authorizes automatic Lofty order execution**. Therefore the production-safe V1 path is:

```text
Voxel Vault owner console
        |
        | choose pilot amount / prepare handoff
        v
Provider-approved interface
        |
        | provider KYC + explicit user purchase
        v
Provider / blockchain purchase references
        |
        | safe reference-only intake
        v
Voxel Vault pending position claim
        |
        | independent provider/on-chain + legal-property mapping verifier
        v
FRACTIONAL POSITION VERIFIED
        |
        v
Exact parcel + 3D Spatial Vault + financial ledger
```

Until the independent verifier exists, user-entered receipts, transaction IDs, wallet addresses or asset IDs remain **evidence leads only**. They cannot self-promote a property to verified ownership.

## $700 owner pilot policy

The current owner bridge hard-caps a single pilot at **$700**. The default planning amount is $25 so the system does not encourage spending the full available balance merely because the cap permits it.

Current controls:

- maximum bridge planning/purchase claim amount: $700;
- no automatic provider purchase;
- no scraping or hidden browser automation;
- no auto-reinvestment;
- no pooled public investor money;
- no Voxel Vault custody of provider wallet credentials;
- every current provider purchase is completed by the user through the provider-approved interface;
- provider and property risks must be reviewed before the user decides to invest.

The $700 cap is a safety limit, not an investment recommendation or suggestion to invest that amount.

## Ownership proof model

A property-specific position should eventually require all of the following before the Spatial Vault displays `FRACTIONAL POSITION VERIFIED`:

1. **User identity binding** — the authenticated Voxel Vault user is the same investor whose provider/on-chain position is being verified.
2. **Provider eligibility** — required provider KYC/investor checks are complete.
3. **Provider position proof** — quantity and active ownership are independently returned by an approved provider or permitted on-chain verifier.
4. **Issuer/entity mapping** — the asset/position is tied to the exact property-owning LLC/entity described by authoritative offering/operating documents.
5. **Canonical parcel binding** — state/subdivision + county/assessor jurisdiction + parcel identifier resolve to one canonical physical property.
6. **Spatial truth** — parcel geometry and building data have provenance and pass Voxel Vault's geographic/physical truth gates.
7. **Rights description** — the legal/economic rights represented by the position are explicit and current.
8. **Reconciliation** — distributions, sales and ownership changes reconcile to provider/on-chain records instead of being inferred from Voxel Vault UI state.

A public wallet balance by itself is not enough to prove the legal property mapping. A property address by itself is not enough to establish canonical parcel identity.

## Current implementation

The owner-only bridge is implemented at:

- `/admin/fractional-property`
- `/api/admin/fractional-property/bridge`

The bridge can prepare an external provider handoff and evaluate safe post-purchase references. It intentionally does **not** persist the entered position in V1 and does not label it as owned property.

Current code locks:

- `FRACTIONAL_POSITION_VERIFIER_IMPLEMENTATION_READY = false`
- `LIVE_FRACTIONAL_PROPERTY_EXECUTION_READY = false`
- `OWNER_REAL_PROPERTY_PILOT_MAX_USD = 700`

The target promotion is:

```text
REFERENCE ONLY
      |
      | approved independent provider/on-chain + legal mapping verification
      v
FRACTIONAL POSITION VERIFIED
```

## Future approved provider adapter

A real automated adapter must expose supported, authenticated capabilities such as:

1. investor/KYC eligibility status;
2. available offerings and legally authoritative ownership description;
3. property/entity identifiers that can be mapped to authoritative parcel records;
4. current share price, fees, liquidity and property underwriting;
5. purchase quote / order creation with explicit user authorization;
6. provider-confirmed position and transaction receipts;
7. distribution transaction feed;
8. sell / transfer workflow and restrictions;
9. tax-document and cost-basis references;
10. account-level controls for automatic reinvestment.

The adapter must never use scraped credentials, hidden browser automation or an unofficial trading path. If a provider does not offer a supported API/partnership for automatic execution, Voxel Vault may prepare a handoff and later verify an already-completed position, but the purchase itself remains on the provider's approved interface.

## Fail-closed requirements before live automated reinvestment

Live property-specific execution/reinvestment remains disabled until all of the following are true:

- provider-approved API or partnership exists;
- securities/property counsel approves Voxel Vault's exact role in the flow;
- user has completed provider KYC / investor eligibility;
- explicit auto-invest authorization and dollar/time limits are recorded;
- custody/payment responsibilities are defined;
- transaction receipts and ownership records reconcile independently;
- each target property maps to an authoritative parcel and legal entity;
- property operating/title evidence passes the applicable review gates;
- a kill switch and maximum daily/monthly investment limits are in place;
- the provider's current terms permit the exact integration behavior.

The blockchain is an ownership/audit rail only to the extent the legal documents and provider/issuer records make it one. It does not replace title systems, legal agreements, property management or property accounting.
