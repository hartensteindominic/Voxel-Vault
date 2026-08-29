# Voxel Vault Architecture

This document describes the durable product architecture. It is intentionally shorter than release-closeout notes and should be updated only when a core boundary changes.

## 1. Primary consumer journey

```text
PUBLIC DEMO
   |
   v
SIGN IN
   |
   v
AUTHORIZED PHOTO
   |
   v
$4.99 CREATION CHECKOUT
   |
   v
3D PREVIEW
   |
   | user reviews
   v
MOVABLE VOXEL 3D
   |
   +----> WORLD / MAP CONTEXT
   |
   +----> VAULT / ACCOUNT RECORD
   |
   +----> OPTIONAL MINT
```

The public demo is synthetic and requires no account.

## 2. Visual creation layer

The core Property creator uses the authorized photo to guide a digital VoxelPop result. The normal property flow is designed to keep the source photo on-device across checkout and local creation and to avoid a Meshy-credit dependency.

The visual result is a digital approximation. One photo does not establish unseen geometry, exact dimensions, structural condition, title, ownership or property value.

## 3. Place / map layer

A user-entered address can be resolved into source-backed place/building data. This layer provides map context and may include a building footprint or other geographic references.

Map evidence is not visual reconstruction evidence and is not ownership evidence.

```text
photo-derived visual model != source-backed map/building record
```

## 4. Account / Vault layer

Supabase-backed account records and local browser records can preserve creations, purchases and World items. A successful local creation should remain usable even if account persistence temporarily fails; persistence failure must not be presented as creation failure.

The Vault can contain several legally different record types. UI labels must keep them distinct.

## 5. Payment layer

Stripe is used for explicit checkout flows. The core $4.99 payment buys one digital VoxelPop creation. Other optional purchases must be separately labeled and must not silently become prerequisites for viewing or using an already-paid creation.

Payment does not prove physical-property ownership.

## 6. Wallet / mint layer

Wallet connection and minting are optional downstream actions for eligible finished digital assets. Public mint and regulated token behavior should remain fail-closed by default.

NFT ownership means only what the applicable digital-asset contract and metadata actually define. It does not replace a deed.

## 7. Regulated / title layer

Financial, securities, custody, exchange, banking, escrow, lease-income and direct real-property ownership workflows are not part of the core creator.

They may become live only when the exact required provider, eligibility, disclosure, transaction, settlement, verification and legal/title requirements are satisfied.

```text
DIGITAL MODEL
    != MAP EVIDENCE
    != WALLET / NFT RECORD
    != PROVIDER FINANCIAL POSITION
    != RECORDED DEED / TITLE
```

## 8. Route hierarchy

Primary:

- `/` — product landing page
- `/demo` — public synthetic proof-of-quality
- `/property` — paid creator
- `/world` — mapped saved creations
- `/vault` — saved digital items and property sources

Secondary:

- `/more` — optional digital tools and advanced/provider-gated surfaces
- `/about` — product status and public support path
- `/privacy`
- `/terms`

Experimental/legacy routes should not define the public positioning of the product.

## 9. Change rule

Any change that alters one of these statements should update this document, the README, public metadata and the regression tests in the same PR:

- what $4.99 buys;
- whether the source photo leaves the device in the normal flow;
- whether Meshy or another metered provider is required;
- whether the user sees the 3D preview before voxel conversion;
- whether minting is required;
- what World/Vault records mean;
- whether a financial or title workflow is actually live.
