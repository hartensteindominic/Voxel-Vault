# Unified Property + Money Vault

Reviewed: August 29, 2026

## Product idea

Voxel Vault can present one spatial account where a user sees:

1. a source-backed 3D property twin;
2. any separately verified legal/economic property position;
3. optional NFTs / digital collectibles;
4. a user-controlled crypto wallet connection;
5. settled USD from an approved banking/payment provider;
6. conversion and reinvestment actions that hand off to the provider legally responsible for the transaction.

The product should feel unified while the legal records and custody rails remain distinct.

## $1.99 Property Slice sandbox

`/geo/slice` uses a default test amount of **$1.99**.

The sandbox compares that amount to a selected property's reference price and to a benchmark property price. It can show:

- the mathematical percentage represented by $1.99 relative to the selected reference price;
- selected-property price divided by benchmark-property price;
- the benchmark-dollar amount that represents the same mathematical fraction.

The sandbox **does not** transfer funds, reserve property, create deed ownership, create an LLC interest, purchase a security, mint a real-estate security, or create rent rights.

A live small-dollar property purchase may replace the sandbox only when the exact offering legitimately supports the amount and all provider, investor-eligibility, settlement, custody and independent ownership-verification gates are satisfied.

## Unified asset conversion model

The first product model distinguishes four values:

- **Settled USD** — the only amount counted as immediately spendable by the preview.
- **Estimated crypto value** — informational until an approved exchange/off-ramp trade settles.
- **Estimated NFT value** — informational until a real marketplace buyer executes a sale and proceeds settle.
- **Property goal / verified position** — a savings/goal balance or a separately verified property/security position; the UI must state which one it is.

Supported product journeys can eventually include:

```text
NFT -> marketplace sale -> crypto or USD proceeds -> settlement -> Vault balance
crypto -> approved exchange/off-ramp -> settled USD -> Vault balance
settled USD -> verified property offering -> provider-confirmed position -> 3D property Vault
verified property distributions -> settled proceeds -> USD/crypto -> optional user-authorized reinvestment
```

No estimated NFT or crypto value should be silently counted as available cash.

## Live-provider boundaries

### USD

Voxel Vault should not present itself as an FDIC-insured bank unless it actually becomes an insured depository institution. A practical fintech path is a disclosed partner-bank/payment-provider integration in which the UI names the actual institution/provider and accurately states whether and how any deposit-insurance eligibility applies.

Official reference: https://www.fdic.gov/resources/consumers/consumer-news/2023-07.html

### Crypto

Prefer a user-controlled wallet for the initial live product. Custody, exchange, transmission, and customer crypto-to-fiat conversion can trigger licensing and compliance obligations, especially for New York users.

Official reference: https://www.dfs.ny.gov/virtual_currency_businesses

### Tokenized property / securities

Tokenization does not change the legal character of an underlying security. If a token represents a property-company share, REIT interest, note, or other security, the securities-law treatment follows the actual instrument and transaction structure.

Official references:

- https://www.sec.gov/newsroom/speeches-statements/corp-fin-statement-tokenized-securities-012826-statement-tokenized-securities
- https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/transactions-involving-crypto-assets
- https://www.sec.gov/rules-regulations/2026/03/s7-2026-09

The SEC also proposed Regulation Crypto Assets on August 18, 2026. It is a proposal, not a blanket authorization to launch tokenized real-estate securities without the applicable offering, broker, exchange, custody, transfer, and investor-protection analysis.

Official reference: https://www.sec.gov/rules-regulations/2026/08/s7-2026-27

## Product-language rule

Use user-facing language such as:

- `Vault`
- `USD balance`
- `Crypto wallet`
- `NFT collection`
- `Property Slice (sandbox)`
- `Verified property position`

Do not call Voxel Vault itself a `bank`, `FDIC-insured`, `broker`, `exchange`, `custodian`, or `deed registry` unless that exact legal status later becomes true.

## Target architecture

```text
                         VOXEL VAULT UI
                              |
        -------------------------------------------------
        |                    |             |            |
     3D GEO              PROPERTY         NFT        MONEY VIEW
        |                 RIGHTS           |            |
 authoritative        provider/legal    wallet /      balances
 spatial data          entity records   collection      |
        |                    |             |      -----------------
        |                    |             |      |               |
        |                    |             |     USD            CRYPTO
        |                    |             |      |               |
        |                    |             | partner bank/   user wallet or
        |                    |             | payment rail    licensed provider
        -------------------------------------------------
                              |
                       unified audit/ledger
```

The unified ledger may link all of these objects, but it must not overwrite the source of legal truth for any object.

## Production gates

Keep live money movement disabled until the exact action has a verified implementation and provider/legal owner:

- customer authentication and KYC where required;
- bank/payment-provider agreement for USD funds;
- accurate deposit-insurance disclosures;
- compliant crypto custody/exchange/transmission path;
- approved marketplace/off-ramp for NFT conversion;
- verified property offering and investor eligibility;
- legal-property/entity mapping;
- independent position reconciliation;
- explicit user authorization for every trade/purchase or separately scoped auto-reinvestment authority;
- ledger reconciliation, audit logging, limits, fraud controls and a kill switch.

The goal is one simple product experience backed by multiple truthful rails, not one database field pretending that every asset is the same thing.
