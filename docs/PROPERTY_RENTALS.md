# Voxel Vault Property Rentals

Voxel Vault rentals are a **private digital companion to a real lease**, not a replacement for landlord-tenant law, a property manager, an e-signature provider, or the authoritative lease document.

## Simple renter flow

```text
Verified property
      |
      v
Real rental offer / lease provider
      |
      v
Tenant reviews + signs real rental agreement
      |
      v
Provider / authorized reviewer verifies executed lease
      |
      v
Rented property appears in My Vault
      |
      +--> monthly rent status
      |
      +--> tenant-only voxel layer
      |       |
      |       +--> renter's separately owned minted voxels
      |
      v
Lease remains current / late / notice / legal process
      |
      v
Lawful termination verified
      |
      v
Tenant layer becomes archived/read-only
```

The consumer UI stays condensed as:

`LEASE → PAY MONTHLY → DECORATE → MOVE OUT`

## Real lease is authoritative

A Voxel Vault rental must not become `current` merely because a user clicks a button or mints a token. Activation requires a real lease/provider record and an executed-agreement hash verified through the owner/provider reconciliation path.

The agreement itself, tenant identity documents, bank information and other confidential lease material must remain private and must never be placed in public NFT metadata.

A future production e-sign adapter must return a provider-verified execution event/reference before the lease can become active. Until such a provider is configured, Voxel Vault records only reviewed/provider-reconciled lease state; it does not pretend to execute a legal lease.

## Monthly rent

The lease record stores the agreed monthly amount, currency and due day. Individual payment periods can be reconciled as:

- `upcoming`
- `due`
- `paid`
- `late`
- `disputed`

Production collection must remain with a reviewed property manager/payment provider until Voxel Vault has an approved integration. The platform must not invent payment confirmations from a client-side button.

A late payment may move the workflow from `current` to `late`, but **late rent does not automatically end tenancy**.

## No automatic eviction

Rental workflow states are:

`pending-verification → current ↔ late → notice → legal-process → ended`

Routes may also return from `notice` or `legal-process` to `current` when the real-world situation is cured/resolved.

`ended` is fail-closed: it requires verified termination evidence and a reference hash. The application must never implement `late → automatic eviction`, automatic lockout, automatic possession transfer, or automatic destruction of tenant rights based only on an unpaid digital balance.

Actual notices, termination, eviction, possession and move-out obligations are governed by the executed lease and applicable law/provider/court process.

## Tenant voxel layer

An active verified tenant gets a private **Tenant Layer** associated with the canonical property identity.

Permanent tenant-layer associations require a minted VoxelPop asset in that same signed-in account. Examples:

- furniture
- art
- pets/characters
- plants
- appliances
- collectibles
- other personal 3D voxels

An attachment is only a spatial/digital association. It does not become part of the deed, verified building geometry, landlord property, leasehold estate, security deposit, or physical premises.

When the lease ends lawfully:

- the tenant layer becomes archived/read-only;
- tenant placement records are archived;
- the renter's separately owned voxel/token is **not burned, transferred or deleted**;
- the renter can continue to hold/use that voxel elsewhere subject to its normal digital-asset rights.

## Rental Pass direction

A future Rental Pass may mirror the verified lease status as a non-transferable or tightly restricted digital credential. It must not be presented as the lease itself and must not create occupancy rights independently of the authoritative agreement.

If implemented, it should be issued only after executed-lease verification and should expire/archive only after the corresponding real lease has lawfully ended.

## Current V1 limitations

This implementation provides:

- private lease/payment/tenant-layer storage;
- owner/provider reconciliation APIs;
- a signed-in renter Vault view;
- monthly payment status display;
- tenant attachment of account-confirmed minted voxels;
- fail-closed lawful-termination gating.

It does **not** yet provide:

- a production e-signature provider;
- live rent collection/autopay;
- automated legal notices;
- court filing or eviction execution;
- a mainnet Rental Pass mint;
- public tenant or lease metadata.

Those capabilities must remain disabled until the exact provider, legal, privacy, payment and jurisdiction requirements are reviewed and connected.
