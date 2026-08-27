# Voxel Vault Real Property Pilot

Voxel Vault is being expanded from a 3D/NFT product into a real-property digital-twin and legally linked ownership platform.

This repository intentionally treats the blockchain as an ownership/economic-rights layer **on top of** the ordinary real-estate title system. A token does not replace the recorded deed.

## Pilot architecture

```text
Recorded deed / county title system
            |
            v
Dedicated property LLC
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

None of these contracts, by themselves, establish a deed transfer, LLC membership right, securities-law exemption or investor eligibility.

## Financial flow

The intended operating model is:

```text
Tenant pays rent normally
        |
        v
Property LLC / property manager
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
Distribution epoch + audited statement hash
        |
        v
Eligible holder claims
```

The smart-contract distribution layer must never be used as a substitute for property accounting.

## Live-money launch gates

The first implementation is deliberately fail-closed. `app/api/property-platform/status/route.ts` hardcodes `productionInvestmentImplementationReady = false`, so environment variables cannot enable live investing.

Before a future production implementation changes that constant, the project should have at minimum:

1. Property-specific real-estate/title counsel and a title company review.
2. Securities counsel approval of the exact offering, exemption/registration pathway and marketing flow.
3. Executed property-entity operating/subscription documents that explicitly define the token-linked rights.
4. KYC/AML, sanctions and investor-eligibility controls.
5. Transfer restrictions and appropriate transfer-agent/recordkeeping procedures where required.
6. Production custody/on-off-ramp/payment architecture that does not casually make Voxel Vault custodian of user funds.
7. Property accounting, reserve policy, tax reporting and distribution operations.
8. Independent smart-contract audit and production incident/pause procedures.
9. Privacy design separating public metadata/hashes from confidential deeds, leases, IDs and tenant information.

## Testnet deployment

The pilot deployment script refuses every chain except Base Sepolia (`84532`).

```bash
npm install
npm run chain:compile
npm run chain:test:property
npm run test:property-platform
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

Start with **one property, one entity and one ownership structure**. The useful milestone is not “mint an NFT”; it is proving that a title professional and securities attorney can trace the full linkage from the recorded property owner, through executed company documents, into an approved token holder record and back again.

Until that is reviewed, keep the property record unverified, keep the token paused/unissued as appropriate, and do not accept investment money.
