# Digital REIT Vault — Dinari integration

Voxel Vault's first real-money real-estate investment path uses Dinari's regulated tokenized-securities infrastructure for provider-supported REITs, real-estate ETFs and listed real-estate companies.

This path is **not** a deed to a particular house. Direct fractional interests in a specific property remain a separate title/issuer/securities workflow.

## What is implemented

### Read and sandbox paths

- `/real-estate/reits` Digital REIT Vault for the controlled provider integration.
- `/admin/digital-reits` owner-only sandbox onboarding wizard.
- Server-side Dinari API authentication; no API secret is returned to the browser.
- Sandbox Entity creation, Dinari-hosted KYC, US Account creation/reuse and provider-account binding.
- Provider-backed real-estate catalog, portfolio, cash and dividend reads.
- `/api/digital-reits/sandbox-fund` sandbox-only mock funding.
- `/api/digital-reits/sandbox-buy` sandbox-only managed market buys capped at $25.
- Provider reconciliation before an order is ever shown as a held position.

### Live owner path

- `/admin/digital-reits/live` owner-only live investment console.
- `/api/admin/digital-reits/live` authenticated provider/readiness status.
- `/api/admin/digital-reits/live-quote` authenticated U.S. pre-trade SIP/NBBO confirmation.
- `/api/admin/digital-reits/live-buy` authenticated real-money managed market-buy route.
- Hard $700 maximum per live market-buy request in V1.
- Live orders are limited to the configured provider-confirmed real-estate universe.
- A security must be provider-reported as tradable and fractionable before Voxel Vault will create a live market-buy confirmation.
- Every live quote and every live buy re-checks the configured Dinari Entity, KYC, US Account and Wallet.
- KYC must be `PASS`, the account must be active and US-jurisdiction, the wallet must be Dinari-managed for this V1 flow, and the wallet must not be provider-reported as AML flagged.
- U.S. pre-trade confirmation requests a current provider quote using the SIP feed and configured Entity ID.
- Voxel Vault requires a usable bid, bid size, bid exchange, offer, offer size, offer exchange and quote timestamp.
- Stale/malformed quote data fails closed.
- The owner UI refreshes the quote while the pre-trade review is open.
- A live confirmation is HMAC-signed server-side, bound to the authenticated Voxel Vault user, provider account hash, stock, amount, quote, disclosure version and short expiry.
- The resulting Dinari `client_order_id` is derived from the signed confirmation ID, so replaying the same confirmation collides with the same provider-side client order ID instead of silently creating a new intent.
- The browser must show the approved disclosure link/version and receive an explicit owner acknowledgment before the final real-money submit control is enabled.
- The final browser confirmation says that the order uses real money, market prices can move, and the security is not the deed to a specific property.

## What “live-ready” means

The live code path exists, but the repository intentionally does **not** contain production credentials or pretend that external approvals are complete.

`DINARI_LIVE_TRADING_IMPLEMENTATION_READY` is `true`, meaning Voxel Vault now contains a production execution implementation. That constant alone cannot trade.

A production trade also requires all of these server-side configuration gates:

```text
DINARI_ENVIRONMENT=live
DINARI_API_KEY_ID=<approved live key id>
DINARI_API_SECRET_KEY=<approved live secret>
DINARI_ENTITY_ID=<approved live customer/entity id>
DINARI_ACCOUNT_ID=<approved live US account id>
DINARI_LIVE_PARTNER_APPROVED=true
DINARI_LIVE_MANAGED_ORDERS_APPROVED=true
DINARI_US_DISCLOSURES_APPROVED=true
DINARI_US_NBBO_APPROVED=true
DINARI_US_DISCLOSURE_VERSION=<approved disclosure version>
DINARI_US_DISCLOSURE_PAGE_URL=https://<approved disclosure page>
DINARI_LIVE_CONFIRMATION_SECRET=<server-only secret, 32+ characters>
DINARI_PRODUCTION_TRADING_ENABLED=true
```

Even if every environment value above is set, the live routes still call Dinari and refuse execution unless the provider itself confirms the required KYC/account/wallet state.

Do not set approval flags merely to make the UI green. They represent external facts that need to be true.

## Live launch sequence

1. Complete Dinari partner/production onboarding and obtain the approved live API credentials.
2. Complete the live Entity/KYC/Account workflow required for the intended U.S. customer/account structure.
3. Use the approved Dinari-managed wallet flow for this V1 implementation. External-wallet live signing is intentionally not implemented here.
4. Complete the U.S. disclosure review and deploy the exact approved disclosure page. Record its version in `DINARI_US_DISCLOSURE_VERSION`.
5. Complete the U.S. SIP/NBBO review and confirm the production API response contains all fields the live confirmation screen requires.
6. Store live credentials and `DINARI_LIVE_CONFIRMATION_SECRET` only in the deployment secret manager/Vercel server environment. Never put real secrets in GitHub, browser code, screenshots or chat.
7. Keep `DINARI_PRODUCTION_TRADING_ENABLED=false` while verifying `/admin/digital-reits/live` shows every external/provider gate correctly.
8. Run the automated Digital REIT tests and production build.
9. Set `DINARI_PRODUCTION_TRADING_ENABLED=true` only after the live provider, disclosures and NBBO gates are truly approved.
10. Open `/admin/digital-reits/live` while signed in with the authorized owner Google account.
11. Start with a small live order, review the current NBBO and disclosure screen, submit deliberately, and verify the resulting provider portfolio before treating the position as owned.

## Dinari environments

- Sandbox: `https://api-enterprise.sandbox.dinari.com/api/v2`
- Live: `https://api-enterprise.sbt.dinari.com/api/v2`

Voxel Vault defaults to sandbox unless `DINARI_ENVIRONMENT=live` is explicitly configured.

## Sandbox setup

Put the matching sandbox Key ID and Secret Key directly into Vercel Preview environment variables. Never paste the secret into chat, a GitHub issue, source code, a browser input, or a variable prefixed with `NEXT_PUBLIC_`.

```text
DINARI_ENVIRONMENT=sandbox
DINARI_API_KEY_ID=<sandbox key id>
DINARI_API_SECRET_KEY=<sandbox secret>
DINARI_ENTITY_ID=<sandbox entity id>
DINARI_ACCOUNT_ID=<sandbox account id>
DINARI_REAL_ESTATE_SYMBOLS=VNQ,SCHH,XLRE,REET,O,PLD,AMT,WELL
DINARI_SANDBOX_FAUCET_ENABLED=false
DINARI_SANDBOX_ORDER_EXECUTION_ENABLED=false
DINARI_PRODUCTION_TRADING_ENABLED=false
```

The private `/admin/digital-reits` wizard uses the existing Supabase Google session plus server-side owner allowlist to create/recover the sandbox Entity, open Dinari-hosted KYC, create/reuse the US sandbox Account and bind it to the authenticated Voxel Vault user after KYC PASS.

## Required Supabase identity-binding migration

Before My Vault can attribute provider holdings to a signed-in user, apply:

```text
supabase/migrations/014_provider_account_bindings.sql
```

The binding table is RLS-protected, browser clients cannot write bindings, and a provider Account ID cannot be silently claimed by multiple Voxel Vault users in the same environment.

The new live V1 execution console is more restrictive: it is owner/admin-only and uses the explicitly configured live account after direct provider verification. It does not open live trading to arbitrary signed-in users.

## Safety invariants

- Sandbox funding/buying still refuses `DINARI_ENVIRONMENT=live`.
- Sandbox buys remain capped at $25.
- Live buys are capped at $700 per request in code.
- Live execution requires server-side owner authentication and same-origin requests.
- Live configuration flags cannot substitute for live provider KYC/account/wallet verification.
- Live account KYC must be PASS and `is_kyc_complete=true`.
- The configured account must be active, US-jurisdiction and belong to the configured Entity.
- The V1 live path requires a Dinari-managed wallet and refuses a provider AML-flagged wallet.
- Live assets must be returned by the provider in Voxel Vault's configured real-estate universe and must be tradable/fractionable.
- U.S. live market buys require a fresh SIP/NBBO pre-trade confirmation.
- Missing/stale NBBO prices, sizes, exchanges or timestamp fail closed.
- The signed pre-trade token is short-lived and bound to the authenticated user, account, amount, quote and disclosure version.
- A changed disclosure version invalidates an older confirmation.
- A submitted order is not treated as ownership. Provider portfolio data remains the source of the held position.
- The browser never receives the Dinari API key ID, API secret or live-confirmation HMAC secret.
- Live auto-reinvestment is not enabled in this V1 path.
- Public pooled investing is not enabled in this V1 path.
- Digital REIT/dShare ownership is not represented as ownership of a specific recorded deed.
- The direct-property/fractional-property issuance engine remains a separate legal/title/securities workflow and stays fail-closed until its issuer/intermediary/title evidence is real.

## Provider references

- Quickstart: https://docs.dinari.com/docs/quickstart
- Environments: https://docs.dinari.com/reference/environments
- U.S. customers / disclosures / NBBO: https://docs.dinari.com/docs/us
- Stock data: https://docs.dinari.com/docs/stock-data
- Placing orders: https://docs.dinari.com/docs/placing-orders
- KYC: https://docs.dinari.com/docs/managing-kyc
- Accounts/wallet funding: https://docs.dinari.com/docs/funding-accounts-through-wallets
- Corporate actions/dividends: https://docs.dinari.com/docs/corporate-action-processing
