# Voxel Vault Spatial Income Center

## Purpose

`/vault/income` is the personal, spatial history layer for income/payment records that Voxel Vault can actually source and attribute to the signed-in user.

The first live data source is the same user-bound Dinari sandbox account used by the personal Digital REIT wing in `/vault`.

This page is intentionally **not** a yield calculator, rent simulator or projection dashboard.

## Current source of truth

The Income Center calls:

```text
GET /api/vault/digital-reits
Authorization: Bearer <Supabase user access token>
```

That endpoint requires:

1. a verified Voxel Vault Google/Supabase user,
2. `supabase/migrations/014_provider_account_bindings.sql` applied to the connected Supabase project,
3. a server-controlled verified provider-account binding for that exact user,
4. a provider snapshot from the bound Dinari account.

If any identity-binding requirement is missing, the Income Center shows no personal provider payments.

It must never fall back to the globally configured owner/pilot `DINARI_ACCOUNT_ID` as a personal ownership or income claim.

## What appears in the room

The first spatial objects represent positive dividend-payment records returned by the provider for the bound account and the provider-confirmed Digital REIT/security catalog.

Each record keeps its reported:

- security symbol,
- amount,
- currency,
- payable date,
- provider status,
- provider/environment provenance.

A Digital REIT dividend is a security payment. It is **not** labeled property rent and it is not treated as a deed-linked property distribution.

## Currency rule

Voxel Vault does not invent FX rates inside the Income Center.

USD records can be totaled as USD. Other currencies are shown separately. A multi-currency account must not be collapsed into a single dollar figure unless a future approved pricing/FX source and accounting policy explicitly supports that conversion.

## Sandbox rule

When Dinari reports `sandbox`, the UI must visibly state that the records are test-environment data and are not real-money income.

The personal provider endpoint remains read-only and forcibly disables:

- sandbox order execution,
- sandbox faucet actions,
- production trading.

The Income Center itself has no provider-write action.

## Direct-property distribution chamber

The amber direct-property chamber is deliberately locked.

A future direct-property distribution can enter the Income Center only after the platform can prove the full chain:

```text
legally owned/operated property
→ ordinary property cash receipt
→ expense/debt/tax/insurance/management accounting
→ required reserves
→ approved net distributable income
→ holder entitlement/snapshot reconciliation
→ distribution record
→ personal Income Center
```

A Property Passport, NFT, testnet token or simulated rent entry is not enough to unlock this chamber.

## Spatial behavior

`IncomeCenterCanvas` turns the provider payment history into an explorable Three.js room. The 3D representation is a visualization of the underlying records; it does not create or alter the financial rights represented by those records.

If WebGL is unavailable, the underlying provider records remain usable in the normal page layout.

## Release tests

`npm run test:income-center` asserts that:

- personal income reads use `/api/vault/digital-reits`,
- the global pilot endpoint is not used for personal income,
- zero/negative non-income values do not become spatial income objects,
- USD and non-USD totals stay separate,
- yield projection and invented FX are explicitly rejected,
- security dividends and direct-property rent remain distinct,
- the direct-property distribution chamber remains locked,
- My Vault exposes a persistent route into the Income Center.

The quality gate runs this test before `next build`.
