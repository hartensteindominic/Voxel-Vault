# VoxelVault Digital Foundry launch runbook

The Vault Store is intentionally fail-closed. Setting `VAULT_STORE_ENABLED=true` is not enough by itself: checkout also verifies that the exact paid ZIP exists in private Supabase Storage before Stripe Checkout can open.

## Products

| SKU | Price | Private storage path |
| --- | ---: | --- |
| `voxel-commerce-kit` | $49 | `vault-store/voxelvault-3d-commerce-kit.zip` |
| `fail-closed-audit-pack` | $29 | `vault-store/fail-closed-audit-pack.zip` |

The bucket defaults to `assets-private` and can be changed with `VAULT_STORE_BUCKET`.

## Production prerequisites

1. Apply `supabase/migrations/20260827_vault_store.sql`.
2. Confirm the existing Supabase auth configuration and Google provider are working for `www.voxelvault.io`.
3. Upload both ZIP files to the private bucket paths above. Do not commit paid ZIPs to this public repository.
4. Confirm the existing server-only Stripe variables are configured: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
5. Confirm the existing Supabase server credentials are configured: `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY`.
6. Confirm Stripe sends at minimum `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `charge.refunded` to `/api/stripe/webhook`.
7. Leave `VAULT_STORE_ENABLED=false` until the migration and private files are verified. Then set it to `true` in the production environment.

## Paid-sale flow

`/vault-store` → valid Voxel Vault account → server-side SKU lookup → private-file preflight → Stripe Checkout → signed Stripe webhook → durable event-idempotency record → server-validated amount/currency → balanced gross-sale journal → optional verified Stripe fee journal → account entitlement → 60-second Supabase signed download URL.

The browser never chooses the price, never chooses a Stripe Price ID, and never receives the private storage path as an authorization mechanism.

## Accounting model

A successful sale posts a balanced journal:

- Debit `stripe_clearing`
- Credit `digital_product_revenue`

When Stripe exposes the actual processing fee, a second balanced journal posts:

- Debit `payment_processing_expense`
- Credit `stripe_clearing`

Refunds are recorded as deltas rather than cumulative totals:

- Debit `sales_returns`
- Credit `stripe_clearing`

Every journal is appended under a PostgreSQL advisory lock and commits to the previous journal hash plus its ordered lines. `public.verify_vault_store_journal_chain()` recomputes the complete chain. Journal writes and verification are granted to `service_role`, not browser roles.

A gross sale is not the same thing as profit. If Stripe's processing fee is temporarily unavailable, the order remains `gross_recorded` rather than guessing a fee or claiming a verified net margin.

## Refund behavior

Partial refunds update `refunded_amount_cents` and set the order to `partially_refunded`. Full refunds set the order to `refunded` and revoke the download entitlement. A later replay of a successful Checkout event cannot reactivate a fully refunded order.

## Verification

Run:

```bash
npm run test:vault-store
npm run test:commerce
npm run build
```

The release test chain also includes `test:vault-store` before the production build.
