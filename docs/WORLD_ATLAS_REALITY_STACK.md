# Voxel Vault World Atlas Reality Stack

The World Atlas separates property identity, open map geometry, open street imagery, generated 3D, listing media, and legal property rights. They can refer to the same place, but they are not interchangeable evidence.

## 1. Free Reality view — KartaView open street imagery

Voxel Vault does **not require a paid Google Maps key** for the World Atlas.

The default street-level visual evidence source is KartaView:

- Public nearby-photo lookups use `https://api.openstreetcam.org/2.0/photo/`.
- No paid browser key is required for ordinary public lookups.
- Responses are bounded to the selected location and a small radius.
- Voxel Vault selects up to four nearby views, preferring different headings.
- The UI displays the KartaView attribution and license next to the imagery.
- Missing imagery is shown as missing; no replacement facade is generated automatically.

KartaView street imagery is handled under its published CC BY-SA 4.0 terms. A Meshy reconstruction that uses those open images must preserve the applicable attribution/share-alike obligations recorded with the references.

Google Maps, Google Earth, Zillow, Redfin and similar services remain optional external comparison destinations. Voxel Vault does not require them and does not scrape their imagery into its model cache.

## 2. Open/source-backed geometry — Overture first, OSM fallback

Primary global building source:

- Overture Maps Foundation Buildings PMTiles, pinned to the reviewed release in `lib/overture-building-tiles.js`.
- Small z/x/y regions are range-read as the user explores; the browser does not download the planet.
- OpenStreetMap / Overpass is a fallback rather than the primary dependency.
- Jurisdiction parcel/building data outranks global map geometry when Voxel Vault has a stronger local source.

Map geometry is reference geometry. It is not automatically a cadastral survey, deed, title record, current facade scan, or listing.

## 3. Local property authority

For the Buffalo calibration path, Voxel Vault resolves the City parcel record and Erie County parcel evidence before global context. The full Erie PIN is preferred over a short local identifier when available. Coordinates are cross-checked between independent sources, including explicit detection of a published latitude/longitude field reversal only when County geometry independently confirms the swapped interpretation.

A spatially nearby BUILDING candidate is not promoted to an exact building unless the County evidence layer actually provides the accepted parcel-linked geometry.

## 4. Listing photos — authorized display evidence

The market layer can display photos that arrive from configured authorized listing providers such as Bridge/participating MLS datasets, Domain Australia, or a contracted normalized partner feed, subject to that provider's display rights and terms.

Display rights do **not** imply AI derivative-generation rights.

Zillow, Redfin, Realtor.com and similar services can be opened as external cross-check/reference destinations. Voxel Vault does not scrape their photo libraries into its model cache.

A data partner may provide Meshy-ready media only when the provider contract explicitly grants derivative-generation rights. Ordinary listing images are never auto-promoted into that field.

## 5. Meshy 7 — selective property reconstruction

Server variable:

```text
MESHY_API_KEY=
```

The key stays server-only; never use a `NEXT_PUBLIC_` prefix.

World property generation policy:

- Model: `meshy-7`
- Multi-image workflow: 2–4 rights-cleared views
- Target remesh: 30,000 triangles
- Texture: 2K
- PBR: enabled
- Image enhancement: disabled to preserve input appearance
- Lighting removal: enabled
- Output: GLB
- Auto size + bottom origin
- Manual owner/admin action only
- Normal browsing spends zero Meshy credits
- Completed GLBs are copied into Voxel Vault private storage and served through expiring signed URLs
- A cached GLB is reused instead of spending credits again

Accepted reference sources include:

- user-owned photos,
- explicitly derivative-licensed provider photos,
- open-licensed KartaView photos with the CC BY-SA rights record preserved.

The owner iPhone workflow accepts a photo selection and normalizes it in the browser to a max-2048px high-quality JPEG before private upload.

Google Maps/Earth/Street View, Zillow, Redfin and Apartments.com hosts remain blocked as direct Meshy inputs unless a separately reviewed license actually permits that derivative use.

## 6. Runtime capability status

`GET /api/world-atlas/capabilities` reports safe metadata for:

- Overture world atlas,
- free KartaView open-street reality,
- Meshy server configuration,
- authorized market-media providers.

It never returns API keys or provider secrets. Google is explicitly reported as optional/not required so a deployment cannot appear broken merely because no paid Google key exists.

## 7. Failure behavior

The Earth page must remain useful when any optional layer fails:

- Overture failure can use OSM fallback.
- KartaView failure leaves parcel/map/Meshy-user-photo flows available.
- Missing Meshy configuration leaves open imagery and source geometry available.
- Missing market-provider credentials returns zero real listings, never samples.
- Missing local building geometry does not create a guessed house.

## 8. Legal / truth boundaries

- Open street photo != proof it depicts the exact selected parcel.
- Map footprint != survey or parcel title.
- Listing photo != derivative-generation license.
- Meshy model != deed or verified architecture by itself.
- Digital stewardship claim != physical property ownership.
- Market listing != Voxel Vault authority to sell the property.
- Token/NFT != deed, title, tenancy, rent entitlement, or investment interest unless a separate enforceable provider/legal structure actually grants those rights.

The defensible product is the Voxel Vault atlas experience, verification graph, original metadata, compliant generated-model cache, and property/financial workflow—not a false claim that Voxel Vault owns the physical Earth or third-party source data.
