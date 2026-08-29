# Voxel Vault

**Voxel Vault turns an authorized property photo into a reviewed 3D preview and then a movable VoxelPop voxel.**

[Live product](https://www.voxelvault.io) · [Public no-login demo](https://www.voxelvault.io/demo) · [Privacy](https://www.voxelvault.io/privacy) · [Terms](https://www.voxelvault.io/terms)

> Current consumer promise: **property photo → $4.99 digital creation → recognizable 3D preview → user approval → local movable voxel → optional map / save / mint**.

The source property photo is designed to remain on the user's device during normal creation, and the local voxel build does not require Meshy credits.

## What this repository currently ships

The public product is intentionally narrower than the full research repository.

### Primary product

A signed-in user can:

1. choose a property photo they took or have permission to use, or reopen an eligible saved property photo from the same device;
2. pay **$4.99** for one VoxelPop digital creation;
3. see a recognizable photo-based **3D preview first**;
4. explicitly approve that preview;
5. build and rotate the separate local **3D voxel**;
6. save it to My Properties / My World;
7. optionally add source-backed map context; and
8. optionally mint the finished **digital voxel** through the separate wallet flow.

A verified paid creation can resume without a second creation charge. If the browser cannot retain the private photo cache through checkout, the user may be asked to re-select the same authorized photo after payment.

### Public demo

`/demo` is available before sign-in or payment. It demonstrates the exact product order using a built-in illustration:

```text
PHOTO
  -> 3D PREVIEW
  -> USER REVIEW / APPROVAL
  -> VOXEL
  -> OPTIONAL MINT
```

The built-in demo is an illustration of the workflow, not a customer result and not a guarantee that every source photo produces identical geometry.

## The four product states

| State | Meaning |
| --- | --- |
| **$4.99 DIGITAL** | One paid VoxelPop digital creation. No physical-property rights. |
| **DEMO** | Sandbox only. Fake demo credit is not money and creates no property rights. |
| **PARTNER** | A financial/investment action is live only through the required approved provider, eligibility, settlement, disclosure, and verification path. |
| **TITLE** | Real-property ownership changes only through normal closing and recorded title. |

These states are deliberately separated in both product language and implementation. Research code does not make a regulated or title-based feature live.

## What the $4.99 purchase buys

The **$4.99 payment buys one digital VoxelPop creation**.

It does **not** buy or create:

- the physical house or land;
- deed or title ownership;
- property equity;
- rent, occupancy, tenancy, mortgage, or lien rights;
- a fractional real-estate investment;
- a bank account, deposit, security, or custody relationship; or
- guaranteed appreciation, yield, or income.

One property photo is also not treated as a survey, complete architectural reconstruction, appraisal, inspection, title record, or full digital twin of unseen geometry.

## Product architecture

The focused property flow lives primarily in:

- `app/property/PropertyJourneyExact.js` — strict photo → pay → 3D preview → approval → voxel → optional mint journey;
- `app/property/PhotoReliefModelViewer.js` — photo-based 3D preview stage;
- `app/property/LocalVoxelModelViewer.js` — movable local voxel viewer;
- `app/api/property-photo-upload/` — paid-generation verification / resume boundary;
- `app/api/property-local-voxel/` — local voxel registration boundary;
- `app/world/` — optional source-backed map / My World context;
- `app/vault/` — saved digital items and clearly separated verified records; and
- `app/more/` — advanced sandbox, provider, legal, and research surfaces kept away from the consumer front door.

### Tech stack

- **Next.js 16 + React 19**
- **Three.js** for 3D experiences
- **Stripe** for the paid creation checkout path
- **Supabase** for configured account/application persistence
- **ethers + Hardhat** for optional/testnet-oriented blockchain infrastructure
- **Map / PMTiles / vector-tile tooling** for source-backed place context

## Privacy posture

Normal VoxelPop property creation is designed so the authorized source photo remains device-local. The browser may retain a private on-device copy for paid-flow resume or saved-property reuse.

Derived records such as a voxel recipe, account draft, payment-session reference, map context, digital collectible record, or optional mint record are separate from the original source photo.

Do not commit or publish:

- private keys or seed phrases;
- bank or payment credentials;
- identity documents;
- tenant PII;
- private deeds or leases;
- confidential closing documents; or
- unredacted customer support data.

See the current [Privacy notice](https://www.voxelvault.io/privacy) for the public-facing description.

## Real estate and money features

The repository contains ambitious research and sandbox systems. Their presence in source code must not be confused with live customer availability.

- **Property investments** fail closed unless an approved provider supports the exact offering, user, eligibility, disclosures, settlement, and verification path.
- **Income** should be displayed as actual income only when it is observed or provider-reported.
- **Direct ownership** requires ordinary diligence, closing, and recorded title.
- **Crypto / USD rails** require the appropriate wallet, banking/payment, exchange, custody, and compliance providers before customer money movement becomes live.

Voxel Vault is **not itself a bank, broker, exchange, custodian, escrow service, title company, or deed registry**.

## Blockchain posture

The repository contains testnet-oriented smart-contract infrastructure for research and controlled pilots. That infrastructure does not make live real-estate investing available.

A blockchain token does not replace a county deed or the ordinary land-title system. Any future token-linked property or security rights would come from the actual legal instrument, offering, entity records, approved providers, and applicable compliance structure—not from the token alone.

## Verification

Common focused checks:

```bash
npm install
npm run test:simple-property-world
npm run test:property-platform
npm run test:mobile
npm run build
```

The repository also contains targeted regression and contract checks for commerce, routes, WebGL, property safety, account generation, blockchain pilots, and other research systems.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Keep the consumer promise narrow, preserve the 3D-preview-before-voxel approval gate, and fail closed when a provider, payment, title, or regulated prerequisite is missing.

## License

This repository is publicly visible but is **not offered under an open-source license** unless a separate written license says otherwise. See [`LICENSE`](./LICENSE).

## Product truth in one sentence

**Voxel Vault is a property-photo-to-3D VoxelPop creator first; maps, Vault, optional minting, sandboxes, provider integrations, and research systems are downstream or separate—not competing definitions of the product.**
