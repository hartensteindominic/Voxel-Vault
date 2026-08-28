# Digital REIT Vault — Dinari integration

Voxel Vault's first real tokenized-securities provider adapter targets Dinari's dShares API.

## What is implemented

- `/real-estate/reits` Digital REIT Vault for the controlled provider pilot.
- `/admin/digital-reits` owner-only sandbox onboarding wizard.
- Owner wizard uses the existing Supabase Google session plus a server-side admin allowlist.
- Server-side Dinari API authentication; no API credential is returned to the browser.
- Sandbox customer Entity creation through Dinari's official `/entities/` endpoint.
- Dinari-managed hosted KYC URL creation through `/entities/{entity_id}/kyc/url`.
- US KYC status checks before Account creation.
- Idempotent US sandbox Account creation: an existing active US Account is reused.
- Server-controlled user/provider identity binding after KYC PASS and provider-confirmed Account creation/reuse.
- `vault_provider_account_bindings` RLS table: a signed-in user may read their own binding, but browser clients have no insert/update/delete policy.
- A Dinari provider account can be bound to only one Voxel Vault user per environment.
- `/api/vault/digital-reits` private authenticated read endpoint that returns holdings only from the verified provider account bound to that signed-in Voxel Vault user.
- User-bound provider reads forcibly disable sandbox orders, sandbox faucet actions and production trading regardless of environment flags inherited elsewhere.
- `/vault` uses the user-bound provider endpoint for the personal Digital REIT wing. It never attributes the global pilot Account to an arbitrary signed-in user.
- Provider-backed stock/ETF catalog filtering for a configurable real-estate watchlist.
- Provider-backed account portfolio and cash-balance reads.
- Provider-backed dividend-payment reads using Dinari's required date window.
- Dividend records are fail-closed to stock IDs returned in the confirmed real-estate catalog.
- `/api/digital-reits` safe pilot status/snapshot endpoint with no credentials exposed.
- `/api/digital-reits/sandbox-fund` same-origin, sandbox-only faucet route.
- `/api/digital-reits/sandbox-buy` same-origin, sandbox-only managed market-buy route.
- `/api/digital-reits/reconcile` same-origin, sandbox-only position-reconciliation route.
- The sandbox UI records the provider position before a buy and refuses to call the asset owned until a later Dinari portfolio read reports a positive quantity increase.
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

## Required Supabase identity-binding migration

Before My Vault can call a Dinari position **personal to a signed-in user**, apply:

```text
supabase/migrations/014_provider_account_bindings.sql
```

The migration creates `public.vault_provider_account_bindings` with these important properties:

- RLS is enabled.
- Authenticated users may select only their own binding.
- There is intentionally no authenticated browser insert/update/delete policy.
- Trusted service-role server code stores the binding after provider verification.
- `(provider, environment, account_id)` is unique so the same provider account cannot silently be claimed by multiple Voxel Vault users.

Merging the migration file into GitHub does **not** by itself prove the migration has been applied to the active Supabase project. Until the table exists, `/api/vault/digital-reits` returns no personal holdings and reports setup required.

## Private wizard sequence

1. Verify the server-side Dinari credentials.
2. Create a sandbox customer `INDIVIDUAL` Entity.
3. Request a Dinari-managed KYC URL with `jurisdiction=US`.
4. Complete the sensitive identity/KYC flow on Dinari's hosted interface. Voxel Vault does not collect the KYC payload.
5. Return to `/admin/digital-reits` and refresh status until Dinari reports `PASS`.
6. Create/reuse an active US sandbox Account. Voxel Vault refuses this step before KYC PASS.
7. Bind the provider-confirmed active US Account to the currently authenticated Voxel Vault user. The binding endpoint re-reads the account from Dinari; it does not trust a browser-submitted Account ID.
8. The non-secret Entity ID and Account ID may still be configured in Vercel for the controlled public/pilot Digital REIT dashboard:

```text
DINARI_ENTITY_ID=<created entity id>
DINARI_ACCOUNT_ID=<created account id>
DINARI_REAL_ESTATE_SYMBOLS=VNQ,SCHH,XLRE,REET,O,PLD,AMT,WELL
DINARI_SANDBOX_FAUCET_ENABLED=false
DINARI_SANDBOX_ORDER_EXECUTION_ENABLED=false
DINARI_PRODUCTION_TRADING_ENABLED=false
```

9. Verify `/api/digital-reits` and `/real-estate/reits` read the configured pilot provider account with both action flags still false.
10. Verify `/api/vault/digital-reits` while signed in. It must either return the account bound to that exact user or return an empty/unbound response; it must never inherit the global pilot Account.
11. Set `DINARI_SANDBOX_FAUCET_ENABLED=true`, redeploy Preview and use **ADD 1,000 TEST FUNDS** only in the controlled sandbox pilot.
12. Verify the provider cash balance appears.
13. Set `DINARI_SANDBOX_ORDER_EXECUTION_ENABLED=true`, redeploy Preview and submit one $5 sandbox real-estate-security buy from the controlled sandbox pilot.
14. Let the Digital REIT Vault reconcile the pre-order quantity against repeated provider portfolio reads. Only a positive provider-reported increase becomes a confirmed holding.
15. If the position is still settling, use **CHECK PROVIDER AGAIN**.
16. Return to `/vault#digital-reits` while signed in. The position can enter the spatial personal Vault only if the signed-in identity is bound to that same provider account and the provider reports a positive balance.
17. Keep production trading disabled.

## Pilot account vs personal My Vault account

These are deliberately different concepts:

- `/api/digital-reits` and `/real-estate/reits` can use `DINARI_ACCOUNT_ID` as the explicitly configured owner/pilot sandbox account for controlled testing.
- `/api/vault/digital-reits` ignores that global account as an ownership claim. It requires a verified signed-in user, finds that user's server-controlled provider binding, scopes Dinari reads to the bound Account ID, and disables all write flags.
- `/vault` consumes the user-bound endpoint, so signing in alone is never enough to inherit the pilot holdings.

This distinction prevents a shared test account from accidentally appearing as every user's personal security portfolio.

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
- The owner onboarding wizard refuses Entity, KYC-session, Account creation and provider-binding writes in `DINARI_ENVIRONMENT=live`.
- Account creation requires Dinari KYC status `PASS` and `is_kyc_complete=true`.
- Existing active accounts are reused instead of duplicated.
- A user/provider binding requires KYC PASS and a provider-confirmed active account.
- A provider Account ID cannot be assigned to two Voxel Vault users in the same environment.
- Browser users cannot create, overwrite or delete provider bindings through Supabase RLS.
- A missing provider-binding migration fails closed: My Vault shows no personal provider holdings.
- Suspended/revoked bindings do not load holdings.
- User-bound provider reads always force sandbox order execution, sandbox faucet execution and production trading flags off.
- Sandbox funding and buying refuse `DINARI_ENVIRONMENT=live`.
- Sandbox buys are capped at $25 per request.
- Reconciliation is read-only and sandbox-only.
- A submitted sandbox order is not treated as ownership; confirmation requires a later provider portfolio amount above the pre-order baseline.
- The faucet uses mock tokens only; it cannot fund a production account.
- The browser never receives the API key ID or API secret.
- The personal binding summary exposes only safe metadata such as the provider, environment, status and Account ID suffix—not the full provider Account or Entity ID.
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
