# Digital REIT Vault — Dinari integration

Voxel Vault's first real tokenized-securities provider adapter targets Dinari's dShares API.

## What is implemented

- `/real-estate/reits` Digital REIT Vault.
- Server-side Dinari API authentication.
- Provider-backed stock/ETF catalog filtering for a configurable real-estate watchlist.
- Provider-backed account portfolio and cash-balance reads.
- Provider-backed dividend-payment reads using Dinari's required date window.
- Dividend records are fail-closed to stock IDs returned in the confirmed real-estate catalog.
- `/api/digital-reits` safe status/snapshot endpoint with no credentials exposed.
- `/api/digital-reits/sandbox-fund` same-origin, sandbox-only faucet route.
- `/api/digital-reits/sandbox-buy` same-origin, sandbox-only managed market-buy route.
- Official sandbox faucet flow mints 1,000 mockUSD test funds to the configured managed account.
- Hard $25 sandbox order cap.
- Production trading and production funding remain hard-disabled in code.

## Dinari environment

Official API base URLs:

- Sandbox: `https://api-enterprise.sandbox.dinari.com/api/v2`
- Live: `https://api-enterprise.sbt.dinari.com/api/v2`

Voxel Vault defaults to sandbox.

## Required sandbox variables

Configure these as server-side Vercel **Preview** environment variables first. Never prefix credentials with `NEXT_PUBLIC_`.

```text
DINARI_ENVIRONMENT=sandbox
DINARI_API_KEY_ID=...
DINARI_API_SECRET_KEY=...
DINARI_ENTITY_ID=...
DINARI_ACCOUNT_ID=...
DINARI_REAL_ESTATE_SYMBOLS=VNQ,SCHH,XLRE,REET,O,PLD,AMT,WELL
DINARI_SANDBOX_FAUCET_ENABLED=false
DINARI_SANDBOX_ORDER_EXECUTION_ENABLED=false
DINARI_PRODUCTION_TRADING_ENABLED=false
```

The watchlist is only a query filter. The UI labels an asset provider-confirmed only when Dinari's API actually returns that symbol.

## Activation order

1. Create the Dinari partner/sandbox account at the official partner dashboard.
2. Generate sandbox API Key ID and API Secret Key.
3. Create or identify a sandbox Entity.
4. Complete Dinari's required sandbox KYC path.
5. Create or identify an Account with a Dinari-managed wallet for the current managed-order test flow.
6. Configure the server-side values in Vercel Preview first.
7. Leave both sandbox action flags `false` and verify catalog, portfolio, cash and dividend reads.
8. Set `DINARI_SANDBOX_FAUCET_ENABLED=true` in Preview and use **ADD 1,000 TEST FUNDS**.
9. Verify the provider cash balance appears in the Digital REIT Vault.
10. Set `DINARI_SANDBOX_ORDER_EXECUTION_ENABLED=true` in Preview.
11. Submit a $5 sandbox buy from `/real-estate/reits` and reconcile the resulting provider order and portfolio holding.
12. Keep production trading disabled until the U.S. partner/compliance arrangement, onboarding flow, customer ownership model, disclosures, reconciliation, security review and production API configuration are approved.

## Safety invariants

- `DINARI_LIVE_TRADING_IMPLEMENTATION_READY` is `false`.
- No environment variable can unlock live trading.
- Sandbox funding and buying refuse `DINARI_ENVIRONMENT=live`.
- Sandbox buys are capped at $25 per request.
- The faucet uses mock tokens only; it cannot fund a production account.
- The browser never receives the API key ID or API secret.
- Dividend records are not assumed to be real-estate distributions unless their `stock_id` is in the provider-confirmed real-estate catalog.
- The live property-acquisition engine remains a separate legal/title workflow.
- Digital REIT/dShare ownership is not represented as ownership of a specific deed.

## Provider references

- Quickstart: https://docs.dinari.com/docs/quickstart
- Environments: https://docs.dinari.com/reference/environments
- Funding accounts through wallets / sandbox faucet: https://docs.dinari.com/docs/funding-accounts-through-wallets
- Cash balances: https://docs.dinari.com/reference/getaccountcash
- Stock data: https://docs.dinari.com/docs/stock-data
- Placing orders: https://docs.dinari.com/docs/placing-orders
- KYC: https://docs.dinari.com/docs/managing-kyc
- Corporate actions/dividends: https://docs.dinari.com/docs/corporate-action-processing
- U.S. customers: https://docs.dinari.com/docs/us
