# Voxel Vault

Voxel Vault is a 3D property and digital-asset app.

The current property product lets a signed-in user:

- choose a property photo they took or have permission to use;
- pay **$4.99** for one VoxelPop digital creation;
- keep the source photo on the device instead of uploading it for generation;
- build the VoxelPop image and movable 3D model locally without Meshy credits;
- map the address into source-backed 3D context;
- place the digital property in My World;
- optionally buy an eligible mapped **digital VoxelPop collectible** through a separate checkout;
- organize digital assets and separately verified positions in My Vault.

## Four product states

| State | Meaning |
| --- | --- |
| **$4.99 DIGITAL** | One paid VoxelPop digital creation. No physical-property rights. |
| **DEMO** | Sandbox only. No real money, security purchase, or property rights move. |
| **PARTNER** | A financial/investment action is live only through the required approved provider, eligibility, settlement, and verification path. |
| **TITLE** | Real-property ownership changes only through the normal legal closing and recorded-title process. |

## Current VoxelPop property flow

```text
SIGN IN
   ↓
AUTHORIZED PHOTO
   ↓
$4.99 DIGITAL CREATION CHECKOUT
   ↓
PAID SESSION VERIFIED
   ↓
LOCAL VOXEL IMAGE + MOVABLE 3D
   ↓
SOURCE-BACKED PROPERTY MAP
   ↓
MY WORLD
   ↓
OPTIONAL SEPARATE DIGITAL COLLECTIBLE CHECKOUT
   ↓
VAULT
   ↓
OPTIONAL SEPARATE VERIFY + MINT FLOW
```

The source photo remains device-local during the creation flow. The local VoxelPop engine does not require Meshy credits. If a verified payment is resumed, the app should not charge the user again for the same paid creation.

The local visual model and the mapped property record are different evidence layers. One photo is not treated as a survey, complete physical replica, title record, ownership record, or property valuation.

## What the $4.99 purchase buys

The **$4.99 payment buys one digital VoxelPop creation** built by Voxel Vault's local generation engine.

It does not buy:

- the physical house or land;
- deed or title ownership;
- equity in the property;
- rent or occupancy rights;
- a fractional real-estate investment;
- guaranteed appreciation or income.

After the digital creation is mapped to an eligible source-backed building, the user may be offered a **separate optional collectible checkout**. That second purchase is also for a digital asset only and does not create physical-property rights.

## $1.99 Property Demo

The `$1.99 Property Demo` is a sandbox using fake demo balances and proportional property math.

It does not transfer customer money, reserve real property, purchase a security, create equity, mint a real-estate security, or create deed, rent, or occupancy rights.

A real small-dollar property investment can replace the demo only if an actual verified offering supports the exact amount and all required provider, eligibility, settlement, disclosure, custody, and position-verification steps are live.

## Real estate and money features

Voxel Vault can organize real-estate and money-related workflows in one interface, but the underlying legal roles remain separate.

- **Property investments** — fail closed unless an approved provider supports the exact offering, user, eligibility, transaction, settlement, and verification path.
- **Income** — only observed/provider-reported payments should be shown as actual income.
- **Direct ownership** — requires ordinary diligence, closing, and recorded title.
- **Crypto / USD rails** — require the appropriate wallet, banking/payment, exchange, custody, and compliance providers before customer money movement becomes live.

Voxel Vault is **not itself a bank, broker, exchange, custodian, escrow service, or deed registry**.

## Blockchain pilot

The repository contains testnet-oriented smart-contract infrastructure for research and controlled pilots, including property registry, token, and distribution components.

That infrastructure does not make live real-estate investing available. Any regulated property-investment path must remain fail-closed until the exact legal, provider, compliance, custody, and reconciliation gates are satisfied.

A blockchain token does not replace a county deed or the ordinary land-title system. Any future token-linked property or security rights would come from the actual legal instrument, offering, entity records, and applicable provider/compliance structure—not from the token alone.

## Safety posture

- Paid VoxelPop creation is explicitly a digital-creation purchase.
- Optional digital property collection is a separate, digital-only purchase.
- Map evidence is not converted into an ownership claim.
- Wallet holdings, provider positions, property title, and digital collectibles remain separate records.
- Live investing stays disabled unless the exact provider/legal gates are satisfied.
- No private keys, investor identity documents, bank information, tenant PII, confidential deeds/leases, or private closing documents belong in the public repository or token metadata.

## Local verification

```bash
npm install
npm run test:property-platform
npm run test:simple-property-world
npm run build
```

For the regulated-pilot architecture and launch gates, see `docs/REAL_ESTATE_PILOT.md`, `docs/UNIFIED_PROPERTY_MONEY_VAULT.md`, and the legal-review documentation under `docs/`.
