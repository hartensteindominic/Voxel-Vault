# Voxel Vault — Real Property, Made Spatial

Voxel Vault is now being developed as a real-property digital-twin and legally linked blockchain ownership platform.

The core model is intentionally conservative:

```text
Recorded real-property deed
        |
        v
Dedicated property LLC
        |
        | operating/subscription agreement
        v
Permissioned blockchain interest token
        |
        +-------------------+
        |                   |
        v                   v
Approved holders       Net-income distributions
```

The blockchain does **not** replace the county deed or ordinary land-title system. The enforceable legal documents for the property entity must define what any token-linked economic or membership rights actually mean.

## Current pilot

- New real-property homepage at `/`
- Interactive Three.js property/parcel digital twin
- Property intake checklist at `/real-estate/onboard`
- Fail-closed status endpoint at `/api/property-platform/status`
- `PropertyRegistry.sol` for property/entity/title-reference hashes
- `PropertyInterestToken.sol` for capped, allowlisted ownership-interest units
- `PropertyDistributionVault.sol` for audited Merkle-based net-income distribution epochs
- Base Sepolia-only pilot deployment script
- Safety regression that prevents accidental live-investing enablement

The existing VoxelPop / voxel asset generator is preserved at `/studio` so it can evolve into the 3D digital-twin creation engine.

## Safety posture

Live investing is disabled in code. Environment variables alone cannot unlock it. The pilot deployment script refuses every chain except Base Sepolia (`84532`). New property registry entries are unverified and inactive by default, and interest tokens cannot move to or from wallets that are not explicitly allowlisted.

This is prototype infrastructure, not a public real-estate security offering, title product, escrow service or custody service.

Read [`docs/REAL_ESTATE_PILOT.md`](docs/REAL_ESTATE_PILOT.md) for the operating model and launch gates.

## Local verification

```bash
npm install
npm run test:property-platform
npm run chain:compile
npm run chain:test:property
npm run build
```

## Base Sepolia deployment

Set a Base Sepolia RPC plus a testnet deployer key in your private environment, then run:

```bash
npm run chain:deploy:property-pilot
```

The deploy script creates a registry, one pilot interest token and a distribution vault. It intentionally leaves the property record unverified/inactive.

Never commit a private key, investor identity document, bank information, confidential deed/lease, tenant PII or private closing document to GitHub or public token metadata.
