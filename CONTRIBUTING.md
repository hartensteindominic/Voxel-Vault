# Contributing to Voxel Vault

Thanks for helping improve Voxel Vault.

## Keep the public product focused

The current consumer promise is:

```text
authorized property photo
  -> $4.99 digital creation
  -> recognizable 3D preview
  -> explicit user approval
  -> local movable voxel
  -> optional save / map / mint
```

Do not reintroduce older product identities into the homepage, metadata, README, or primary navigation unless the product has intentionally changed.

## Product-truth rules

Changes must preserve these boundaries:

- the $4.99 purchase is a digital VoxelPop creation only;
- a VoxelPop item, NFT, payment, map marker or Property Passport is not a deed or title record;
- one photo is not a survey, appraisal or complete reconstruction of unseen geometry;
- minting is optional and downstream of a finished voxel;
- demo credit is not money;
- provider-backed financial or investment features fail closed unless the exact required provider, eligibility, settlement, disclosure and verification path is active;
- physical-property ownership changes only through ordinary legal closing and recorded title; and
- no private keys, seed phrases, bank details, identity documents, tenant PII, confidential deeds/leases or private closing materials belong in the public repository.

## UX rules

- Show public value before requiring sign-in when possible.
- Keep the 3D preview before the voxel approval gate.
- Never fabricate a generic house when the source photo lacks enough real building evidence; fail clearly instead.
- Preserve iPhone / coarse-pointer usability and graceful lower-end-device behavior.
- Keep advanced research tools under secondary surfaces instead of competing with Create.

## Pull requests

Keep changes small enough to review. Explain:

1. what user-facing problem is being fixed;
2. what safety/product boundary is preserved;
3. what tests were run; and
4. whether payment, map, wallet, mint, provider or legal behavior changed.

## Verification

For property-front-door changes, run at least:

```bash
npm run test:simple-property-world
npm run test:mobile
npm run build
```

For changes touching property/provider/legal behavior, also run:

```bash
npm run test:property-platform
```

Add or update focused regression tests when changing a critical user journey.

## Security

Do not commit secrets or sensitive customer data. Use environment variables and provider secret stores for credentials. If a change could bypass payment verification, authentication, wallet ownership, provider eligibility, or a fail-closed gate, treat it as a security-sensitive change and add regression coverage.
