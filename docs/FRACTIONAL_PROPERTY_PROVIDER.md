# Fractional Property Provider Strategy

## Product goal

Voxel Vault should let a user start with a modest balance, hold legally linked fractional interests in multiple rental properties, view those properties as 3D digital twins, receive net rental distributions into a reinvestment wallet and automatically buy additional eligible interests when the wallet balance reaches the configured minimum.

## Current reference model

As of August 2026, Lofty is the closest public reference for the desired underlying investment rails:

- property-specific LLC interests rather than pretending a blockchain token is the county deed;
- fractional share prices commonly around $50 or less;
- daily rental-income distributions;
- blockchain-based marketplace settlement using USDC;
- KYC / identity verification before investing;
- investor governance over property decisions;
- a 24/7 secondary marketplace;
- published purchase/sale fees and property underwriting.

Sources reviewed during product research:

- https://www.lofty.ai/help/articles/8844547-why-am-i-not-able-to-stake-tokens-into-a-liquidity-pool-for-a-property-i-own
- https://www.lofty.ai/terms
- https://www.lofty.ai/real-estate-investing/tokenized-real-estate

This reference does **not** mean Voxel Vault is affiliated with Lofty, that Lofty endorses Voxel Vault, or that Voxel Vault is authorized to trade through Lofty.

## Why not RealT as the production model

RealT historically demonstrated weekly stablecoin rent distributions and automatic rent reinvestment, but its 2026 U.S. liquidation and Detroit property-management problems are a warning that token mechanics do not replace real-world asset operations, title diligence, maintenance, taxes, reserves or governance. Voxel Vault should treat physical-asset verification and independent operating data as first-class risk controls.

## $1,000 pilot policy

The simulation defaults to:

- $1,000 starting balance;
- 10% protected cash reserve;
- no more than 25% of initial investable capital in one property;
- small fractional share purchases;
- modeled purchase fee of 2.5% for conservative planning;
- net rental distributions credited daily to a reinvestment wallet;
- automatic simulated share purchase only when the wallet can afford the share plus fees;
- cash remains unspent if no eligible share passes the diversification/risk gate.

Demo prices and yields are fictional and are not recommendations or forecasts.

## Required production adapter

A real provider adapter must expose supported, authenticated capabilities such as:

1. investor/KYC eligibility status;
2. available offerings and legally authoritative ownership description;
3. current share price, fees, liquidity and property underwriting;
4. purchase quote / order creation with explicit authorization;
5. distribution transaction feed;
6. sell / transfer workflow and restrictions;
7. tax-document and cost-basis references;
8. account-level controls for automatic reinvestment.

The adapter must never use scraped credentials, hidden browser automation or an unofficial trading path. If the provider does not offer a supported API/partnership for automatic execution, Voxel Vault may rank opportunities and prepare a proposed order, but the user must complete the investment through the provider's approved interface.

## Fail-closed requirements

Live reinvestment remains disabled until all of the following are true:

- provider-approved API or partnership exists;
- securities counsel approves Voxel Vault's role in the flow;
- user has completed provider KYC / investor eligibility;
- explicit auto-invest authorization and limits are recorded;
- custody/payment responsibilities are defined;
- transaction receipts and ownership records reconcile independently;
- each target property passes legal/title/operating-data gates;
- a kill switch and maximum daily/monthly investment limits are in place.

The blockchain is an ownership/audit rail. It does not replace title systems, legal agreements, property management or investor-protection obligations.
