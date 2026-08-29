# Voxel Vault Digital Properties

Digital Properties are unique, account-owned 3D collectibles with optional Base NFT portability. They are not physical real estate and do not include a deed, title, tenancy, rent, equity, a security, a mortgage, an appraisal or a legal claim on a real-world parcel or building.

## $1.99 founder-reference pricing

The first collectible, `kensington-reference-home`, is the founder pricing anchor:

- digital collectible price: **$1.99**;
- modeled-size anchor: **2,016 sq ft**;
- relative index: **1.00x**;
- visual/right status: stylized digital model, not an asserted exact architectural replica or ownership record.

Every other Digital Property uses the same server-side formula:

```text
relative index = clamp(sqrt(modeled sq ft / 2,016), 0.75, 2.50)
digital price  = round($1.99 × relative index)
```

The square root keeps the low-cost marketplace range compact as modeled homes become larger. This is a Voxel Vault **digital collectible scale index**. It does not use or imitate an appraisal, assessed value, listing price, future value or expected appreciation.

Authoritative constants and calculations live in `lib/digital-estates.js`. The browser submits only `estateId`; it never supplies price, anchor or index values to checkout. Stripe metadata binds the pricing model version, exact anchor cents and selected relative-index basis points so the return/webhook verifier can reject stale or manipulated checkout data.

## Purchase model

### USD hosted checkout

`POST /api/digital-estates/checkout` requires a signed-in Voxel Vault account and verified email, reloads the estate from the server catalog, locks unique inventory, and creates an exact hosted checkout amount. The buyer must acknowledge the digital-only rights boundary before the browser opens checkout.

The purchase becomes account-owned after a signed Stripe webhook or authenticated checkout-return verification confirms:

1. `payment_status=paid`;
2. the exact signed-in buyer;
3. the exact server catalog amount;
4. the current pricing-model version, $1.99 anchor and property index;
5. the same unique inventory reservation.

A crypto wallet is not required to buy.

### Base USDC

The optional crypto rail uses native Circle USDC on Base:

`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

Before the wallet displays a transfer, the server returns the reviewed token, recipient and exact 6-decimal amount. After confirmation, the server independently verifies chain, transaction status, USDC contract, sender, recipient, exact amount, reservation window and transaction-id reuse. The USDC payment secures account ownership first; it never mints automatically.

## Optional NFT

An owner may later bind one wallet and mint the Digital Property through the reviewed VoxelFlip voucher path. Minting adds public provenance and wallet portability. It does not create physical-property rights, investment rights, liquidity, a buyer, a floor price or appreciation.

## Money Hub

`/vault/money` presents three source-separated layers:

| Layer | Current source | Custody/right boundary |
| --- | --- | --- |
| Cash / USD | No customer balance until a regulated partner is integrated | Voxel Vault is not the bank and does not hold customer dollars |
| Crypto | Read-only ETH and USDC balances from the connected Base address | Self-custody; no seed phrase and no transfer without a separate wallet approval |
| Property + NFTs | Signed-in Digital Property ownership plus optional chain state | Digital collectibles are not deeds; securities and direct-property interests require their own verified providers/legal records |

The UI intentionally does not calculate a fake total balance across USD, ETH, USDC, collectibles, listings, securities and direct-property interests.

### Conversion truth

- USD → Digital Property: exact server-authoritative checkout can be available.
- Digital Property → NFT: optional owner mint can be available.
- NFT → USDC: requires a real listing, buyer and settled sale; no instant conversion is promised.
- USDC → USD: requires an approved regulated off-ramp and identity/compliance controls.
- Property security → USD: must follow the issuer/provider/market transfer and redemption rules.

Voxel Vault can become the single interface for these routes without taking unlicensed custody or relabeling one asset as another.

## Verification

```bash
npm run test:digital-estates
npm run test:money-hub
npm run build
```
