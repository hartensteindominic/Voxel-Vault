# Voxel Vault Earth Properties

Voxel Vault Earth Properties is the real-location discovery layer for the spatial property product.

## Product truth

- Listings shown in `/vault/earth` must come from an authorized real-property data feed.
- Voxel Vault does not scrape Zillow, Apartments.com, Realtor.com, or other listing sites.
- A listing card is not proof that Voxel Vault owns or controls the physical property.
- A Digital Twin / Property Passport / NFT does not itself transfer a deed, title, tenancy, rent entitlement, mortgage, security, or investment interest.
- A real-property acquisition still requires the ordinary contract, diligence, funding, title/escrow/attorney closing and recorded-deed process.
- Minting is encouraged only as an optional provenance/backup layer after the appropriate owner/authorized-property verification.

## First authorized provider: Zillow Group Bridge / MLS

Zillow Group's Bridge Listing Output platform provides normalized MLS data using RESO standards. Access is controlled by the participating MLS/data provider and must be approved before production use.

Server-only configuration:

```text
BRIDGE_DATASET_ID=
BRIDGE_ACCESS_TOKEN=
```

The token must never use a `NEXT_PUBLIC_` prefix and must never be exposed to the browser.

The implementation:

- calls the provider from a server route only;
- uses `Cache-Control: private, no-store`;
- returns at most 20 listings per user view;
- does not persist provider listing payloads into the Voxel Vault database;
- returns no fabricated fallback listings when credentials are missing;
- normalizes houses, condos, manufactured/mobile/trailer homes, multifamily, storefront/retail, commercial/office, warehouse/industrial, barn/farm/ranch, and land/vacant-lot categories;
- supports city/address/ZIP searches and a small latitude/longitude search box for `Near Me`.

## Rentals

Bridge/RESO datasets can include lease/rental inventory when the authorized dataset provides it. Additional rental providers should be added through an authorized partner adapter, not by scraping consumer websites.

Zillow's Rentals Feed Integration is designed for approved property managers/property-management systems to syndicate their own listings to Zillow. It is not treated as an unrestricted API for copying Zillow's entire rental inventory into Voxel Vault.

## Market value behavior

V1 displays the provider's current list price or asking rent and the provider modification timestamp. If the source listing price changes, a fresh search reflects that source change.

Future licensed valuation adapters may add current Zestimate/public-record/assessment values when Voxel Vault has the necessary approved data access.

The physical-market reference and the blockchain collectible's resale value are separate. Voxel Vault must never promise that minting or owning a Digital Twin causes its market value to rise with the physical property.

## Payments and receipts

Secure hosted checkout for a Voxel Vault digital asset is account-first:

1. User signs into Voxel Vault.
2. Server loads the authoritative catalog price.
3. Stripe Hosted Checkout handles eligible fiat/payment methods.
4. `receipt_email` is set to the signed-in account email.
5. Stripe's signed webhook verifies payment and permanently secures the unique Digital Estate to the Voxel Vault account.
6. A crypto wallet is optional. If the owner later mints, the first approved wallet is permanently bound for that Digital Estate's mint voucher.

This checkout purchases only the specifically described digital asset. It must not be presented as a county-deed/title closing for a physical property.

## Real-property transaction integration

The Earth listing detail currently sends the user to the authorized source listing / broker path for the real-world transaction. A future in-app closing workflow may integrate licensed transaction/escrow/title providers, but it must remain fail-closed until those provider and legal gates are verified.
