# Contributing to Voxel Vault

Voxel Vault currently has one primary consumer story:

> **Authorized house photo → $4.99 digital VoxelPop creation → 3D preview → user approval → movable voxel → optional map / Vault / mint.**

Changes to the public product should make that story clearer, faster, safer, or more reliable.

## Before opening a pull request

1. Keep the core Create → World → Vault journey understandable on iPhone-sized screens.
2. Do not add a new payment, wallet, investment, title, or property-rights implication to the normal $4.99 creation flow.
3. Preserve the distinction between a visual model, map evidence, a digital collectible, a financial/provider position, and physical-property title.
4. Do not introduce automatic spending, automatic minting, hidden wallet signatures, or silent regulated-provider execution.
5. Do not commit secrets, private keys, seed phrases, customer payment information, identity documents, tenant PII, private deeds/leases, or private closing material.
6. Prefer small public surfaces. Experimental or provider-gated systems should stay outside the normal customer navigation unless they are actually ready and required.

## Core product files

- `app/page.js` — public positioning and conversion entry point.
- `app/demo/` — no-login public product sample.
- `app/property/PropertyJourneyExact.js` — paid property creation journey.
- `app/property/PhotoReliefModelViewer.js` — textured 3D preview.
- `app/property/LocalVoxelModelViewer.js` — local voxel renderer.
- `app/vault/` — saved property and creation organization.
- `app/world/` — optional source-backed place context.
- `lib/product-map.js` — canonical navigation/product grouping.

## Required checks for core UI or property-flow changes

```bash
npm install
npm run test:property-platform
npm run test:simple-property-world
npm run test:vault
npm run test:mobile
npm run build
```

Run any additional targeted test suite that covers the subsystem you changed.

## UX rules

- Show product value before asking for unnecessary information.
- Keep the $4.99 price consistent wherever the paid creation is described.
- Never call a one-photo model a perfect physical replica.
- Keep touch targets usable on mobile and preserve graceful WebGL fallbacks.
- Prefer clear words such as **Create 3D Voxel**, **3D Preview**, **Demo**, and **Optional Mint** over internal architecture jargon.

## Pull request description

A useful PR description should explain:

- the user-visible problem;
- what changed;
- which legal/provider boundaries were preserved;
- which tests were run;
- any remaining deployment or provider dependency.

## License

This repository does not currently declare an open-source license. Do not assume public visibility grants permission to reuse the code outside the rights provided by applicable law or an explicit future license.
