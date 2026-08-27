# Digital REIT Vault — Dinari integration

Voxel Vault's first real tokenized-securities provider adapter targets Dinari's dShares API.

## What is implemented

- `/real-estate/reits` Digital REIT Vault.
- `/admin/digital-reits` owner-only sandbox onboarding wizard.
- Owner wizard uses the existing Supabase Google session plus a server-side admin allowlist.
- Server-side Dinari API authentication; no API credential is returned to the browser.
- Sandbox customer Entity creation through Dinari's official `/entities/` endpoint.
- Dinari-managed hosted KYC URL creation through `/entities/{entity_id}/kyc/url`.
- US KYC status checks before Account creation.
- Idempotent US sandbox Account creation: an existing active US Account is reused.
- Provider-backed stock/ETF catalog filtering for a configurable real-estate watchlist.
- Provider-backed account portfolio and cash-balance reads.
- Provider-backed dividend-payment reads using Dinari's required date window.
- Dividend records are fail-closed to stock IDs returned in the confirmed real-estate catalog.
- `/api/digital-reits` safe status/snapshot endpoint with no credentials exposed.
- `/api/digital-reits/sandbox-fund` same-origin, sandbox-only faucet route.
- `/api/digital-reits/sandbox-buy` same-origin, sandbox-only managed market-buy route.
- Official sandbox faucet flow mints 1,000 mockUSD test funds to the configured managed account.
- Hard $25 sandbox order cap.
- Production trading, production funding and live onboarding writes remain hard-disabled in code.

## Dinari environment

Official API base URLs:

- Sandbox: `https://api-enterprise.sandbox.dinari.com/api/v2`
- Live: `https://api-enterprise.sbt.dinari.com/api/v2`

Voxel Vault defaults to sandbox.

## Immediately after creating a Dinari secret

Put the **matching Key ID** and the **Secret Key** directly into Vercel Preview environment variables. Never paste the secret into chat, a GitHub issue, source code, a browser input, or a variable prefixed with `NEXT_PUBLIC_`.

```text
DINARI_ENVIRONMENT=sandbox
DINARI_API_KEY_ID=<sandbox key id>
DINARI_API_SECRET_KEY=<sandbox secret>
```

Redeploy Preview, sign into Voxel Vault with the authorized Google account, then open `/admin/digital-reits`. The wizard will verify the credentials by asking Dinari for the current organization Entity.

## Private wizard sequence

1. Verify the server-side Dinari credentials.
2. Create a sandbox customer `INDIVIDUAL` Entity.
3. Request a Dinari-managed KYC URL with `jurisdiction=US`.
4. Complete the sensitive identity/KYC flow on Dinari's hosted interface. Voxel Vault does not collect the KYC payload.
5. Return to `/admin/digital-reits` and refresh status until Dinari reports `PASS`.
6. Create/reuse an active US sandbox Account. Voxel Vault refuses this step before KYC PASS.
7. Copy the resulting non-secret Entity ID and Account ID into Vercel Preview:

```text
DINARI_ENTITY_ID=<created entity id>
DINARI_ACCOUNT_ID=<created account id>
DINARI_REAL_ESTATE_SYMBOLS=VNQ,SCHH,XLRE,REET,O,PLD,AMT,WELL
DINARI_SANDBOX_FAUCET_ENABLED=false
DINARI_SANDBOX_ORDER_EXECUTION_ENABLED=false
DINARI_PRODUCTION_TRADING_ENABLED=false
```

8. Verify `/api/digital-reits` and `/real-estate/reits` read the provider catalog, account, cash and portfolio with both action flags still false.
9. Set `DINARI_SANDBOX_FAUCET_ENABLED=true`, redeploy Preview and use **ADD 1,000 TEST FUNDS**.
10. Verify the provider cash balance appears.
11. Set `DINARI_SANDBOX_ORDER_EXECUTION_ENABLED=true`, redeploy Preview and submit one $5 sandbox real-estate-security buy.
12. Reconcile the resulting order and dShare position. Keep production trading disabled.

## Owner authorization

The private wizard accepts the generic owner allowlist:

```text
VOXEL_VAULT_ADMIN_EMAILS=
VOXEL_VAULT_ADMIN_USER_IDS=
```

If those are blank, it falls back to the existing `NEURAL_CORE_ADMIN_EMAILS` / `NEURAL_CORE_ADMIN_USER_IDS` allowlist so an already-configured owner account does not need a second identity system.

## Safety invariants

- `DINARI_LIVE_TRADING_IMPLEMENTATION_READY` is `false`.
- No environment variable can unlock live trading.
- The owner onboarding wizard refuses Entity, KYC-session and Account creation in `DINARI_ENVIRONMENT=live`.
- Account creation requires Dinari KYC status `PASS` and `is_kyc_complete=true`.
- Existing active accounts are reused instead of duplicated.
- Sandbox funding and buying refuse `DINARI_ENVIRONMENT=live`.
- Sandbox buys are capped at $25 per request.
- The faucet uses mock tokens only; it cannot fund a production account.
- The browser never receives the API key ID or API secret.
- The hosted KYC response exposes only an expiring Dinari URL; Voxel Vault does not request or store SSN/tax-ID/document data in the wizard.
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
