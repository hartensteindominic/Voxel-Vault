# Voxel Vault

Voxel Vault is a 3D property and digital-asset app.

The current product lets a signed-in user:

- turn an authorized property photo into a local VoxelPop-style preview;
- map the address into source-backed interactive 3D context;
- place the digital property preview in My World;
- optionally buy the eligible **digital VoxelPop collectible**;
- organize digital assets and separately verified positions in My Vault;
- try clearly labeled property and finance demos without confusing them with live ownership.

## Product status

| Status | Meaning |
| --- | --- |
| **LIVE DIGITAL** | Digital/map-backed features that work now. They do not create real-property rights. |
| **DEMO** | Sandbox only. No real money, security purchase, or property rights move. |
| **PARTNER REQUIRED** | Requires an approved external provider, eligibility, settlement, and independent verification before live execution. |
| **TITLE REQUIRED** | Real-property ownership changes only through the normal legal closing and recorded-title process. |

## Current property flow

```text
SIGN IN
   ↓
AUTHORIZED PHOTO
   ↓
LOCAL VOXELPOP PREVIEW
   ↓
SOURCE-BACKED 3D MAP
   ↓
MY WORLD
   ↓
OPTIONAL DIGITAL COLLECTIBLE CHECKOUT
   ↓
VAULT
   ↓
OPTIONAL SEPARATE VERIFY + MINT FLOW
```

Creation itself does not require Meshy credits or a pre-generation checkout. The local visual preview and source-backed map are separate: one photo is not treated as a survey or complete physical replica.

## What a digital property collectible is

A VoxelPop property collectible is a **digital asset** associated with a mapped World reference.

Buying or minting one does **not** buy the physical house or land and does not create:

- deed or title ownership;
- equity in the property;
- rent or occupancy rights;
- a fractional real-estate investment;
- guaranteed appreciation or income.

The checkout route re-verifies the mapped building identity, uses a server-authoritative price, and explicitly records the purchase as digital-only.

## Real estate and money features

Voxel Vault can organize real-estate and money-related workflows in one interface, but the underlying legal roles remain separate.

- **$1.99 Property Demo** — sandbox math with fake demo USD only.
- **Property investments** — fail closed unless an approved provider supports the exact offering, user, transaction, and verification path.
- **Income** — only observed/provider-reported payments should be shown as actual income.
- **Direct ownership** — requires ordinary diligence, closing, and recorded title.
- **Crypto / USD rails** — require the appropriate wallet, banking/payment, exchange, custody, and compliance providers before customer money movement becomes live.

Voxel Vault is **not itself a bank, broker, exchange, custodian, escrow service, or deed registry**.

## Blockchain pilot

The repository still contains testnet-only smart-contract infrastructure for research and controlled pilots, including property registry, token, and distribution components.

That infrastructure does not make live real-estate investing available. The property pilot is designed to fail closed, and deployment remains limited to Base Sepolia where specified by the safety guards.

A blockchain token does not replace a county deed or the ordinary land-title system. Any future token-linked property or security rights would have to come from the actual legal instrument, offering, entity records, and applicable provider/compliance structure.

## Safety posture

- Live property investing stays disabled unless the exact provider/legal gates are satisfied.
- Digital property purchases are explicitly digital-only.
- Map evidence is not converted into an ownership claim.
- Wallet holdings, provider positions, property title, and digital collectibles remain separate records.
- No private keys, investor identity documents, bank information, tenant PII, confidential deeds/leases, or private closing documents belong in the public repository or token metadata.

## Local verification

```bash
npm install
npm run test:property-platform
npm run test:simple-property-world
npm run build
```

For the regulated-pilot architecture and launch gates, see `docs/REAL_ESTATE_PILOT.md`, `docs/UNIFIED_PROPERTY_MONEY_VAULT.md`, and the legal-review documentation under `docs/`.
