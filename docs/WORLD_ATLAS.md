# Voxel Vault World Atlas

The World Atlas is the global spatial layer underneath `/vault/earth`. It is designed to let a user move anywhere on Earth, stream a small nearby region of source-backed building geometry, inspect that geometry in the GEO voxel renderer, and separately discover authorized real-estate listings when a licensed market feed is available.

## What is global

The interaction surface is worldwide. A user may search an address, use device location, or tap the globe. The server resolves that point and fetches a bounded neighborhood rather than downloading the entire planet into the browser.

Current interactive lookup uses OpenStreetMap / an Overpass-compatible source. The production bulk/tiling path is pinned to Overture Maps release `2026-07-22.0`, including its global Buildings PMTiles/GeoParquet datasets. Overture is a source layer, not Voxel Vault-owned exclusive geography.

The two Earth layers stay separate:

- **World Building Atlas** — map/reference geometry. A mapped building is not automatically for sale, a parcel boundary, a deed, or a verified current physical twin.
- **Authorized real-estate listings** — provider-backed market inventory from connected listing feeds. Missing provider coverage remains empty instead of being filled with fictional listings.

## Progressive loading

Do not ship a whole-world building dataset to an iPhone. The client streams a small region around the point the user is exploring. Regional responses are bounded, cacheable, and source-attributed. This keeps memory, bandwidth and WebGL load under control while allowing the same interaction model worldwide.

## Meshy policy

Meshy is a premium refinement path, not the base world renderer.

World browsing uses lightweight source geometry first. A selected **hero property** may be reconstructed with Meshy only when the model request has 2–4 visual references with an explicit derivative-generation rights basis: user-owned, open-licensed, or licensed-derivative.

The reviewed default is:

- multi-image generation preferred;
- 30,000 target polygons;
- 2K textures;
- PBR enabled;
- GLB output;
- owner/admin-controlled requests;
- cache-first reuse;
- completed GLBs copied into Voxel Vault-controlled storage.

The world route deliberately rejects Google Earth/Maps, Zillow, Redfin and Apartments.com image hosts as Meshy inputs. Their public pages may be useful for a human comparison, but Voxel Vault does not assume those images carry derivative-generation rights.

## Digital stewardship and anti-concentration

A future Voxel Vault digital stewardship claim is a platform mechanic, not physical real-estate ownership. The policy engine exists now; claim billing is disabled until an authoritative server-side claim ledger and reviewed commerce flow exist.

The V1 marginal annual quote is deliberately linear rather than exponential:

`$1.00 base + $0.25 × existing global claims + $0.75 × existing claims in the same 0.05° atlas region`

Additional safeguards:

- local concentration cap: 20 claims per account in one atlas region;
- global claim cap: 10,000 per account;
- next-claim annual quote capped at $250;
- no owner/admin exemption;
- no government-tax, tax-lien, deed, title, rent or physical-property effect.

The regional increment is intentionally stronger than the global increment so hoarding one neighborhood becomes less attractive without making normal participation explode in cost.

## Who owns what

Voxel Vault can own and monetize its own software, product design, original scoring, original derived internal metadata, compliant caches, marketplace rules and generated assets, subject to the licenses of the sources and model providers used to create them.

Voxel Vault does **not** acquire exclusive ownership of:

- the physical Earth;
- real deeds or title merely by mapping a location;
- OpenStreetMap or Overture source data;
- municipal/county GIS source data;
- Google Earth imagery;
- third-party real-estate listing imagery or databases beyond the rights granted by the provider agreement.

That distinction is a product advantage: the atlas can be globally useful and defensible without making a legally false claim that one company owns the world map.
