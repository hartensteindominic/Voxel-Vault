# One-SKU physical + verified-twin pilot

The production milestone is deliberately narrow:

> One authenticated customer buys one real SKU, sees product, twin, shipping, and tax in one Stripe total, receives supplier tracking, and can claim the verified twin only after confirmed delivery.

The application fails closed when any production dependency is missing. A source link, a photo, or a Stripe payment alone never creates delivery proof or a cash-backed asset.

## Required production configuration

Apply `supabase/migrations/005_one_sku_delivery_claim_pipeline.sql`, then configure:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FULFILLMENT_WEBHOOK_SECRET` (a unique, high-entropy secret)
- `VOXEL_PILOT_CATALOG_KEY` (must exactly match one `lib/catalog.js` item ID)
- `VOXEL_FULFILLMENT_CATALOG` (must contain that same single catalog key)

Shopify example:

```json
{
  "catalog-key": {
    "provider": "shopify",
    "pilotEnabled": true,
    "variantId": "gid://shopify/ProductVariant/123456789",
    "costUsd": 24.95,
    "shippingUsd": 6.5
  }
}
```

Also set `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, and optionally `SHOPIFY_API_VERSION`.

Generic-provider example:

```json
{
  "catalog-key": {
    "provider": "generic",
    "pilotEnabled": true,
    "sku": "PILOT-001",
    "costUsd": 24.95,
    "shippingUsd": 6.5
  }
}
```

Also set `FULFILLMENT_API_URL` and `FULFILLMENT_API_KEY`. Checkout remains locked unless `pilotEnabled` is explicitly true and a non-negative shipping amount is present. The existing adapter submits orders with the durable Vault order UUID in the `Idempotency-Key` header.

## Webhooks

Stripe must send `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `charge.refunded` to `/api/stripe/webhook`. Signature verification and the database event ledger make processing retry-safe.

The fulfillment provider sends raw JSON to `/api/fulfillment/status` and sets `x-vault-signature` to the lowercase hex HMAC-SHA256 of the exact raw body using `FULFILLMENT_WEBHOOK_SECRET`.

```json
{
  "orderId": "physical-order-uuid",
  "eventId": "provider-event-id",
  "status": "shipped",
  "trackingNumber": "TRACK123",
  "trackingUrl": "https://carrier.example/track/TRACK123",
  "carrier": "Carrier"
}
```

Allowed statuses are `submitted`, `shipped`, `delivered`, `cancelled`, and `failed`. The database rejects invalid transitions, deduplicates provider events, and unlocks twin claiming only on `delivered`.

## Fireproof launch checklist

1. Apply migrations in order and verify row-level security is enabled.
2. Use a dedicated pilot variant with tracked inventory and a tested return address.
3. Confirm inventory in the supplier console, enter the tested shipping amount, and only then set `pilotEnabled` to true.
4. Complete a Stripe test-mode order twice: verify one supplier order, one Vault order, one timeline, and no duplicate fulfillment.
5. Replay both Stripe and fulfillment webhooks: responses must be successful and state must not duplicate or regress.
6. Attempt out-of-order delivery before shipment: the callback must return `409`.
7. Confirm the mint verification endpoint reports `claimEligible: false` before delivery and `true` only after delivery.
8. Refund a test payment and confirm eligibility closes.
9. Run `npm run test:release` and the contract test suite.
10. Place one live low-value order to a controlled address. Verify the displayed single total, supplier acceptance, tracking, physical delivery, and twin claim before inviting a stranger.

## Operational boundaries

- Never mark an order delivered manually without carrier or supplier evidence.
- Pause the pilot by removing `VOXEL_PILOT_CATALOG_KEY`; all physical checkouts then fail closed.
- Handle damaged goods and returns through the supplier first, then record refund status. A refund closes the delivery claim.
- Do not describe Memory Twins, provenance records, XP, or promotional credits as cash, deposits, guaranteed appreciation, or appraised value.
- Do not enable mainnet contracts until an independent audit and legal review are complete.
