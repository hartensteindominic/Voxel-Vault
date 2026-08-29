# Contributing to Voxel Vault

Thanks for helping improve Voxel Vault.

## Start with the product boundary

The primary consumer product is:

```text
house photo -> $4.99 digital creation -> 3D preview -> movable voxel -> World/Vault -> optional mint
```

Keep these records distinct:

- visual 3D creation;
- map/building/place evidence;
- wallet/NFT ownership of a digital item;
- provider-backed financial positions;
- recorded physical-property title.

A photo, map marker, payment, voxel, NFT, wallet record, Property Passport or demo slice must never be presented as a deed or as proof of physical-property ownership.

## Before opening a PR

1. Keep the main Create → World → Vault journey understandable on iPhone-sized screens.
2. Put optional/experimental/provider-gated features under clearly labeled secondary surfaces.
3. Preserve fail-closed behavior for regulated, title, custody, exchange and public-mint features.
4. Do not add a new external dependency to the normal Property creation flow without a clear user benefit and failure mode.
5. Do not reintroduce Meshy-credit dependency into the normal local Property creator unless the product intentionally changes and all public copy/tests change with it.
6. Run the focused tests for the area you changed plus the production build.

Typical verification:

```bash
npm install
npm run test:property-platform
npm run test:simple-property-world
npm run build
```

## Public repository safety

Never commit or paste into an issue/PR:

- passwords or account tokens;
- private keys or seed phrases;
- payment-card or bank information;
- identity documents;
- private deeds, leases, closing documents or tenant PII;
- production secrets or private provider credentials.

Use synthetic/sample data in public tests and screenshots whenever possible.

## Documentation

Prefer updating a small number of durable docs over adding another release-closeout note. Architecture decisions that materially change the core flow should update `docs/ARCHITECTURE.md` and the README.

## License status

This repository does not currently publish a software license. Do not assume permission to reuse or redistribute the code beyond what GitHub access itself permits. A license should be selected intentionally by the repository owner.
