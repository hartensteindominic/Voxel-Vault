# Voxel Vault · Real World Voxel

## Product thesis

Voxel Vault is building a spatial real-world asset layer: the familiar exploration and ownership feeling of a metaverse, but attached to verified physical buildings and normal legal property systems.

The visual experience can be highly on-chain and highly 3D. The legal meaning must remain exact.

## One canonical Property Passport per property

A verified physical property may have exactly one canonical Voxel Vault Property Passport identity.

The canonical identity can point to a versioned 3D model:

```text
property identity
  -> 3D model v1
  -> renovation / rescan
  -> 3D model v2
  -> later verified update
  -> 3D model v3
```

A rescan does not create a second official property token.

The stable key should ultimately derive from durable verified property identifiers such as jurisdiction + parcel/APN/title references, stored or hashed in a privacy-conscious way. A street-address string alone is not sufficient proof.

The Property Passport is not the recorded deed.

## Three value layers

Voxel Vault keeps three prices conceptually separate.

### 1. Real property value

This is the economic value of the land/building itself.

Production values must be sourced from real evidence such as verified listing/contract data, comparable sales, appraisal, tax/assessment records and independent diligence. A display estimate must always include source and date/provenance.

This is the value relevant to a real USD property purchase.

### 2. Canonical verified twin product price

The verified 3D twin is a premium digital product and verification service.

Initial policy:

- verified canonical twin: starting at **$299**,
- verified renovation/rescan model refresh: **$99**,
- the service remains premium rather than competing for the cheapest mint.

These prices do not represent the value of the underlying real estate.

### 3. Digital building collectible/license value

A property owner or authorized creator may release separate limited digital editions linked to the canonical Property Passport.

Those editions can have their own market value, supply and licensing terms. Their trading price can move independently of the physical building.

A collectible edition does not convey:

- the deed,
- land ownership,
- tenancy rights,
- mortgage rights,
- actual property rent,
- voting rights in a property entity,
- any other real-property economic interest unless a separately documented legal instrument explicitly grants one.

## Friends' houses and third-party buildings

Voxel Vault distinguishes creative modeling from verified identity.

A user may create a stylized voxel building as ordinary digital art without claiming it is the official representation of a real property.

To connect a model to a real property identity/address and call it verified/canonical, Voxel Vault requires:

- property-owner or authorized-controller permission,
- property identity verification,
- duplicate canonical-ID prevention,
- provenance evidence.

This prevents users from minting an unrelated person's property as though they controlled its official digital identity.

## Two rental systems

### Digital rental

A digital building collectible may grant temporary display/use rights in a Voxel Vault room, game, gallery, neighborhood or compatible experience.

This can eventually use time-limited smart-contract or signed-license mechanics.

Digital rental is a license to use the digital asset. It is not a real residential/commercial lease.

### Actual property rent

Real tenants pay real rent under real leases.

Real property income may only be attributed to a Voxel Vault holder if the holder has verified legal economic rights through the property owner/entity or another compliant structure.

The accounting path must preserve the real property waterfall:

```text
gross collected rent
- debt service
- taxes
- insurance
- repairs / capex
- management
- reserves
= approved net distributable income
```

The current live-rent distribution feature remains locked.

## Buying a real building with USD

Voxel Vault may eventually provide a spatial USD purchase workflow, but the property transfer remains a normal legal transaction.

Required progression:

```text
verified property / negotiated transaction
-> independent valuation + diligence
-> buyer/entity approval and compliant USD funding
-> signed contract
-> escrow/title/attorney closing
-> recorded deed
-> verified closing evidence
-> canonical Property Passport linkage
-> only then: any eligible property-interest/token layer
```

The blockchain can anchor provenance, permissions, economic-interest records and distributions. It does not replace the jurisdiction's land-title system.

## Market-comparable display rules

Production property cards must never invent a price because a 3D building looks expensive.

Every displayed physical-property valuation should carry:

- amount,
- currency,
- source type,
- source/provider,
- as-of date,
- confidence/verification state,
- whether it is asking price, contract price, appraisal, assessment or modeled estimate.

Collectible price and physical-property value must never share the same label.

## Current execution state

The first `/vault/properties` room is a demonstration and truth model.

Current production truths:

- one-canonical-twin policy is encoded,
- duplicate address-linked official editions are blocked by the model,
- premium twin pricing is encoded,
- digital building editions are explicitly non-deed/non-rent assets,
- real-property purchase remains non-executable,
- unattended property spending remains disabled,
- live real-property rent distribution remains disabled,
- Property Passport does not claim to be the deed,
- direct legal-interest issuance remains locked.

## Graduation requirements

Before the direct-property layer can move beyond demo/testnet, Voxel Vault needs verified integrations and professional review covering at least:

- property identity / parcel resolution,
- listing and valuation provenance,
- owner authorization,
- title/escrow/closing workflow,
- property-owning entity structure,
- securities analysis where economic interests are offered,
- KYC/AML and eligibility where required,
- custody/payment controls,
- property accounting and reserves,
- rental/lease/property-management data,
- distribution reconciliation,
- audit trail and incident controls.

The experience can look futuristic while these gates remain conservative and fail-closed.
