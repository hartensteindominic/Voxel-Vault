# Voxel Vault Digital Estates

Digital Estates are unique blockchain collectibles presented with a premium real-estate interface. They are **not physical real estate** and do not include a deed, title, tenancy, rental income, security, mortgage, appraisal, or legal claim on any real-world parcel or building.

## Pricing model

For this launch phase, each estate has two deliberately matching displayed values:

- **Real-World Reference Value** — a creative pricing reference for the modeled building and lot.
- **Digital Estate List Price** — the actual amount required to purchase the digital collectible.

The values are numerically equal by product design, but the reference value is not an appraisal and does not state that the NFT is worth or represents an actual physical property.

The first district stays below Stripe's general 8-digit USD amount ceiling. Browser-supplied prices are ignored; checkout always reloads the price from `lib/digital-estates.js`.

## Payment rails

### Hosted Checkout

`POST /api/digital-estates/checkout` creates a server-authoritative Stripe Checkout Session after:

1. authenticated Voxel Vault user verification,
2. wallet binding,
3. VoxelFlip mint-signer readiness,
4. onchain voucher availability,
5. unique inventory reservation.

The integration does not hard-code a card-only list. Stripe Hosted Checkout may display cards, Apple Pay, Google Pay, Link, bank methods, PayPal, stablecoins, or other methods only when they are enabled and eligible for that account/customer/currency/amount.

After return, `POST /api/digital-estates/claim` re-reads the Checkout Session from Stripe and requires `payment_status=paid`, exact catalog amount, exact buyer, exact estate metadata, and the pre-bound wallet before creating a one-use VoxelFlip mint voucher.

### Direct Base USDC

For high-value crypto buyers, `/api/digital-estates/crypto-config` preflights the purchase before any transfer is requested. It uses native Circle USDC on Base mainnet:

`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

The server returns the exact 6-decimal USDC amount and reviewed recipient only after inventory and mint readiness are verified. The browser submits a normal USDC `transfer` through the buyer's wallet.

The claim route then independently verifies the mined transaction's chain, receipt status, USDC contract, sender, recipient, exact amount, reservation time window, and one-time transaction idempotency key before issuing the NFT voucher.

A direct USDC purchase therefore requires two explicit wallet approvals:

1. the real USDC payment,
2. the Base NFT mint transaction after server verification.

## Server-only configuration

Optional:

```bash
DIGITAL_ESTATE_USDC_RECIPIENT=
DIGITAL_ESTATES_METADATA_SECRET=
```

`DIGITAL_ESTATE_USDC_RECIPIENT` may be set to a dedicated public receiving address. If blank, the implementation falls back to the reviewed VoxelFlip royalty receiver from `lib/voxelflip-deployment.ts`.

`DIGITAL_ESTATES_METADATA_SECRET` is an optional dedicated HMAC secret for signed metadata URLs. If blank, the existing server-only VoxelFlip mint signer secret is used for metadata HMAC compatibility. Never expose either secret with a `NEXT_PUBLIC_` prefix.

## Inventory truth

Each estate's voucher ID is deterministic from the estate ID, not from a payment session. The VoxelFlip contract's `usedVouchers` mapping is therefore the final onchain uniqueness lock: one catalog estate can consume its voucher only once.

The existing server-only `commerce_webhook_events` table is reused for short-lived reservation/idempotency records so concurrent buyers cannot intentionally be sent into checkout for the same estate. Paid reservations remain locked even if the buyer closes the browser before completing the mint.
