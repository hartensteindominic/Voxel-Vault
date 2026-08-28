# Global Earth Listings

Voxel Vault Earth is a worldwide property-discovery interface. The globe and location search cover the planet, while listing inventory is shown only when it comes from an authorized source.

## Core rule

**Global interface does not mean fabricated global inventory.**

Voxel Vault must never invent a real-world property, address, price, source, or listing status to make an unsupported market appear populated. A country without a connected licensed feed remains searchable on the globe and clearly shows that live listing access is not connected yet.

## Provider federation

The server normalizes multiple listing sources into the same Earth property model.

### Bridge / authorized MLS

Environment:

- `BRIDGE_DATASET_ID`
- `BRIDGE_ACCESS_TOKEN`

Use only datasets Voxel Vault is authorized to access. Bridge coverage depends on the participating MLS/data agreement and is not a claim of complete U.S. or Canadian coverage.

### Domain Australia

Environment:

- `DOMAIN_CLIENT_ID`
- `DOMAIN_CLIENT_SECRET`

The integration uses Domain OAuth2 Client Credentials, the `api_listings_read` scope, the official location suggestion endpoint, and the residential listing search API. Credentials remain server-only.

### Additional countries / portals

Environment:

- `EARTH_PARTNER_FEEDS_JSON`

This is a server-only array of authorized HTTPS feed definitions. Each feed should return source-backed properties either as a top-level array or `{ "listings": [...] }`.

Normalized partner listing fields may include:

- `listingId`
- `address`, `city`, `region`, `postalCode`, `country`
- `latitude`, `longitude`
- `currency`
- `propertyType`, `propertySubType`, `category`
- `transactionType` (`sale` or `rent`)
- `listPriceCents`, `rentCentsMonthly`, `marketValueCents`, `marketValueText`
- `beds`, `baths`, `livingAreaSqft`, `lotAreaSqft`, `stories`
- `status`
- `imageUrl`, `sourceUrl`, `virtualTourUrl`
- `modifiedAt`
- `sourceDisclosure`

The feed URL must be HTTPS. Tokens belong only in server configuration, never `NEXT_PUBLIC_*` variables.

## Global UI behavior

`/vault/earth` provides:

- a lightweight interactive Three.js globe;
- drag-to-rotate on desktop and touch;
- click/tap a real listing marker to select it;
- tap a point on Earth to search connected geospatial feeds around that latitude/longitude;
- city, country, postcode/ZIP, and address search;
- buy/rent filters;
- houses, condos, mobile/trailer homes, multifamily, storefronts, commercial, warehouses, barns/farms, and land;
- provider coverage states showing `LIVE` or `AWAITING ACCESS`;
- source currency and source attribution per listing.

## Pricing and value

Source currencies must not be silently converted or mislabeled. A Domain listing remains AUD; Canadian listings can remain CAD; partner listings use their declared currency.

The displayed source price/value can change as the authorized listing source updates. That does **not** imply that a Voxel Vault digital twin or NFT appreciates at the same rate or has the same market value.

## Physical property rights

A listing card or digital twin is not the deed. Buying real property still requires the ordinary legal acquisition process applicable to that jurisdiction, including the relevant contract, title/registry checks, escrow/attorney/notary or settlement process, funding, and final deed/title registration.

Minting may be encouraged after owner/authorized verification as a provenance and backup layer, but minting does not create the real-property ownership right and does not guarantee appreciation.

## Production rollout

1. Deploy the global Earth UI with no fabricated fallback inventory.
2. Add only provider credentials Voxel Vault is authorized to use.
3. Verify provider attribution, currencies, listing links, and rate limits in Preview.
4. Expand regional feeds incrementally instead of scraping portals.
5. Keep provider credentials server-only and rotate them if exposure is suspected.
