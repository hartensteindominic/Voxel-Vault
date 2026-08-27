# Voxel Vault Real Property Pilot

Voxel Vault is being expanded from a 3D/NFT product into a real-property digital-twin and legally linked ownership platform, with a longer-term goal of operating many kinds of rentable real-world assets through one auditable system.

This repository intentionally treats the blockchain as an ownership/economic-rights layer **on top of** ordinary real-estate, company, contract and title systems. A token does not replace the recorded deed, vehicle title, lease, local property registry or other legally authoritative record.

## Product direction: the Global Rent Engine

The proposed operating flywheel is:

```text
Profile capital
      |
      v
Global opportunity scan
      |
      v
Jurisdiction + title + compliance gate
      |
      v
Acquire approved asset through real-world provider/entity
      |
      v
Collect rent / usage revenue
      |
      v
Pay operating costs + taxes + insurance + maintenance + reserves
      |
      v
Eligible net cash
      |
      v
Reinvestment balance
      |
      +--------------------------> next approved asset
```

The pilot ranks **verified affordable income-producing assets**, not simply the lowest sticker price. A low purchase price cannot override title uncertainty, foreign-ownership restrictions, poor rental demand, high operating costs, uninsurable risk or an unverified legal structure.

`lib/real-estate/global-asset-engine.js` contains the simulation-only allocation engine. `LIVE_ACQUISITION_ENABLED` is deliberately `false`.

`lib/real-estate/jurisdiction-gate.js` requires a reviewed acquisition record to pass all of these categories before a future live engine could consider it eligible:

- foreign ownership path
- local entity structure
- title and lien process
- rental use
- tax treatment
- funds / FX path
- insurance
- property or asset management
- sanctions / KYC path

No country is globally auto-approved by this pilot.

## Pilot architecture

```text
Recorded deed / local title system
            |
            v
Dedicated property entity
            |
            | operating agreement / subscription documents
            v
Permissioned property-interest token
            |
            +--------------------+
            |                    |
            v                    v
Approved holder ledger      Net-income distributions
                                 |
                                 v
                         Approved holder wallets
```

### On-chain contracts

- `PropertyRegistry.sol` links a platform property ID to the issuer entity, permissioned token, public metadata URI and hashes of diligence/title references. New records start **unverified and inactive**.
- `PropertyInterestToken.sol` is a 0-decimal ERC-20-style unit ledger with a hard supply cap, owner-controlled pause and an allowlist enforced on both sender and recipient.
- `PropertyDistributionVault.sol` stores funded distribution epochs. Each epoch references an approved accounting-statement hash and a Merkle root produced from a compliant cap-table snapshot. Holders use pull-based claims rather than a gross-rent push.

None of these contracts, by themselves, establish a deed transfer, LLC membership right, securities-law exemption, investor eligibility or permission to acquire foreign property.

## Rent pools

Two concepts are intentionally separated:

### Single-owner compound pool

Assets owned for one account can eventually send eligible net cash into that account's reinvestment balance. This is the simplest compounding model and avoids mixing unrelated investor money.

### Multi-investor rent pools

A pool where several people contribute money and expect profit from assets acquired or managed by Voxel Vault needs its own securities, custody, KYC/AML, tax, transfer and jurisdiction analysis. The pilot models this concept but does **not** enable it.

## Future rentable-asset adapters

The architecture is designed to add asset classes through adapters rather than hard-coding everything as real estate. Examples include:

- homes, apartment buildings and land
- parking and garages
- storage units and lockers
- rentable rooms, desks and commercial space
- scooters, bikes and vehicle fleets through future rental-company integrations
- tools, machinery and business equipment

Each adapter must normalize at least:

```text
asset identity
legal owner / contracting entity
jurisdiction
acquisition cost
revenue source
utilization / occupancy
maintenance obligations
insurance status
operating expenses
reserve policy
net distributable cash
provider reconciliation records
```

Partner integrations never become trusted merely because an API exists. Their ownership, custody, revenue and reconciliation model must be reviewed first.

## Financial flow

The intended property operating model is:

```text
Tenant pays rent normally
        |
        v
Property entity / property manager
        |
        +--> mortgage / debt service (if applicable)
        +--> taxes
        +--> insurance
        +--> repairs / management
        +--> operating reserve
        |
        v
Approved net distributable income
        |
        v
Distribution epoch + accounting statement hash
        |
        v
Eligible holder claims or approved reinvestment balance
```

The smart-contract distribution layer must never be used as a substitute for property accounting.

## Live-money launch gates

The first implementation is deliberately fail-closed. `app/api/property-platform/status/route.ts` hardcodes `productionInvestmentImplementationReady = false`, so environment variables cannot enable live investing.

Before a future production implementation changes that constant, the project should have at minimum:

1. Property-specific real-estate/title counsel and a title company review.
2. Securities counsel approval of the exact offering, exemption/registration pathway and marketing flow where investor capital is involved.
3. Executed property-entity operating/subscription documents that explicitly define any token-linked rights.
4. KYC/AML, sanctions and investor-eligibility controls where required.
5. Transfer restrictions and appropriate transfer-agent/recordkeeping procedures where required.
6. Production custody/on-off-ramp/payment architecture that does not casually make Voxel Vault custodian of user funds.
7. Property accounting, reserve policy, tax reporting and distribution operations.
8. Independent smart-contract audit and production incident/pause procedures.
9. Privacy design separating public metadata/hashes from confidential deeds, leases, IDs and tenant information.
10. A jurisdiction-specific acquisition gate for every country and asset class enabled in production.
11. Provider-level reconciliation for every rental-company or external asset adapter.

## Testnet deployment

The pilot deployment script refuses every chain except Base Sepolia (`84532`).

```bash
npm install
npm run chain:compile
npm run chain:test:property
npm run test:property-platform
npm run test:global-rent
npm run chain:deploy:property-pilot
```

Optional testnet metadata variables:

```text
PILOT_PROPERTY_ID=PILOT-0001
PILOT_LEGAL_ENTITY_REFERENCE=123 Main Street Property LLC
PILOT_DEED_REFERENCE=county-recording-reference
PILOT_LEGAL_AGREEMENT_REFERENCE=executed-operating-agreement-hash-source
PILOT_PROPERTY_METADATA_URI=ipfs://...
PILOT_PROPERTY_MAX_UNITS=100000
```

Do not place private deeds, tenant information, SSNs, bank information, private keys or confidential closing documents in public token metadata or GitHub.

## First real-world pilot

Start with **one jurisdiction, one inexpensive asset, one entity/ownership structure, one operator and one cash-flow ledger**. The useful milestone is not “mint an NFT”; it is proving that title/property professionals, the operator and the accounting system can trace the full linkage from the legally owned asset through revenue collection, expenses, reserves and approved distributions or reinvestment.

Only after that loop works should additional countries or asset categories be turned on. Until then, keep acquisitions simulated, keep property records unverified, keep the token paused/unissued as appropriate, and do not accept pooled investment money.
