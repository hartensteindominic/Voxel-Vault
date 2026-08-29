# Voxel Vault

**Turn an authorized house photo into a digital VoxelPop 3D preview and movable voxel.**

Live product: **https://www.voxelvault.io**  
Public no-login sample: **https://www.voxelvault.io/demo**

![Illustrative VoxelPop public demo house](public/voxelpop/demo-house.svg)

> The image above is built-in demo artwork, not a customer property or a claim of photogrammetric accuracy.

## What this repo currently ships

The primary consumer product is deliberately narrow:

1. See the public sample without creating an account.
2. Sign in with Google when you want to create your own.
3. Choose a property photo you took or have permission to use.
4. Pay **$4.99** for one digital VoxelPop creation.
5. Inspect the recognizable textured **3D preview first**.
6. Explicitly approve it.
7. Build the separate movable **3D voxel** locally in the browser.
8. Optionally pair the finished creation with source-backed map context, save it to World/Vault, or mint the finished **digital voxel**.

The normal property creation flow does **not** require Meshy credits. The source photo is designed to stay on the user’s device rather than becoming a public property-photo archive.

## Product promise

```text
HOUSE PHOTO
  -> $4.99 DIGITAL CREATION
  -> TEXTURED 3D PREVIEW
  -> USER APPROVAL
  -> MOVABLE VOXEL
  -> OPTIONAL MAP / VAULT / MINT
```

A one-photo creation preserves the photographed view; it does not pretend to reconstruct unseen walls, exact dimensions, survey geometry, appraisal value, or legal ownership.

## Four product states

| State | Meaning |
| --- | --- |
| **$4.99 DIGITAL** | One paid VoxelPop digital creation. No physical-property rights. |
| **DEMO** | Sandbox/demo only. Fake demo credit is not money and creates no property rights. |
| **PARTNER** | A financial/investment action is live only through the required approved provider, eligibility, settlement, and verification path. |
| **TITLE** | Real-property ownership changes only through normal closing and recorded title. |

**Map ≠ collectible ≠ investment ≠ deed.**

## Architecture at a glance

| Layer | Current role |
| --- | --- |
| **Next.js / React** | App routes, server APIs, account-gated creation flow, public demo, Vault/World UI. |
| **Three.js** | Textured photo-relief preview and local movable voxel rendering. |
| **Browser / IndexedDB** | Best-effort private on-device retention of the authorized source photo across checkout. |
| **Supabase** | Account-scoped product state and saved-library synchronization where configured. |
| **Stripe** | Server-verified paid creation and eligible separate checkout flows. |
| **Source-backed map services** | Optional place/building context kept separate from visual reconstruction and legal ownership. |
| **ethers / Hardhat** | Optional reviewed blockchain/testnet infrastructure; not required for the core $4.99 creation. |

### Core creation modules

- `app/property/PropertyJourneyExact.js` — strict photo → payment → 3D preview → approval → voxel → optional mint journey.
- `app/property/PhotoReliefModelViewer.js` — textured Three.js preview using the actual selected image.
- `app/property/LocalVoxelModelViewer.js` — local source-derived voxel geometry with bounded mobile rendering.
- `app/api/property-generation/checkout/route.ts` — account-bound creation checkout.
- `app/api/property-local-voxel/route.ts` — account-bound local voxel registration and reopening.
- `app/property/mint/page.js` — optional downstream digital-voxel mint flow.
- `app/demo/page.js` — public no-login product sample using the same production preview/viewer components.

## Vault and World

- **Vault** puts saved/purchased property sources first and gives each one a clear path back into **Create 3D Voxel**.
- **World** is optional map/place context for finished creations.
- Neither screen converts a digital item, payment, map marker, or NFT into physical-property title.

## $1.99 Digital Property market

The separate `/vault/estates` market offers low-cost 3D **digital property collectibles**. Its stylized 2,016-modeled-square-foot founder reference is exactly **$1.99**; the other catalog prices are calculated from that anchor with one disclosed server-side formula.

- Checkout receives only the catalog ID and reloads the exact price server-side.
- USD checkout is account-first; a crypto wallet is optional.
- Base USDC is independently verified for exact token, sender, recipient, amount and reservation.
- NFT minting is an optional portability/provenance step after purchase.
- `/vault/money` shows USD-provider, self-custody crypto, and property/NFT layers together without inventing a bank balance or guaranteed conversion.

These collectibles do not include a deed, appraisal, rent, equity, investment rights, or a claim on a physical address. NFT-to-cash requires an actual sale and buyer; crypto-to-USD requires an approved regulated off-ramp.

## Privacy boundary

The source property photo used by the normal VoxelPop creation flow is processed in the browser. When browser storage is available, a private on-device copy may be retained so a paid creation can resume after checkout. If that cache is unavailable, the user can re-select the image without paying the creation charge again.

The original source photo is not intentionally placed in public NFT metadata.

See the live `/privacy` and `/terms` pages for the current product notices.

## Repo scope

This repository also contains **experimental, research, testnet, provider-gated, and legacy-adjacent systems** such as property evidence tooling, investment/provider bridges, blockchain contracts, AI licensing, hunts, and other spatial experiments.

Those systems are **not the primary public product** and should not be treated as live financial, banking, title, or real-estate ownership functionality merely because code exists in the repository. Public customer navigation intentionally keeps them outside the core Create → World → Vault journey unless their real dependencies and required safeguards are satisfied.

## Safety posture

- Paid VoxelPop creation is explicitly a **digital-creation purchase**.
- The $1.99 property comparison is a **sandbox with demo credit only**.
- Map evidence is not converted into an ownership claim.
- Wallet holdings, provider positions, property title, and digital collectibles remain separate records.
- Live investing stays disabled unless the exact provider/legal gates are satisfied.
- Voxel Vault is **not itself a bank, broker, exchange, custodian, escrow service, or deed registry**.
- No private keys, seed phrases, payment credentials, investor identity documents, tenant PII, confidential deeds/leases, or private closing documents belong in the public repository or token metadata.

## Tech stack

- Next.js 16
- React 19
- Three.js
- Supabase
- Stripe
- ethers
- Hardhat / OpenZeppelin
- PMTiles / vector-tile and source-backed map tooling

## Local verification

```bash
npm install
npm run test:property-platform
npm run test:simple-property-world
npm run test:vault
npm run build
```

The broader quality workflow also runs route integrity, commerce, mobile WebGL, provider-binding, property-safety, contract, and other regression suites.

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request. Core consumer changes should preserve the short product story and the fail-closed legal/provider boundaries.

## License

No open-source license is currently declared in this repository. Public source visibility by itself does not grant reuse rights. Choose and add an explicit license before treating this project as open source.
