# Voxel Vault World Atlas Reality Stack

The World Atlas deliberately separates visual reality, open map geometry, generated 3D, listing media, and legal property rights. They may refer to the same address, but they are not interchangeable evidence.

## 1. Reality view — Google Maps JavaScript API 3D

Voxel Vault can show Google Photorealistic 3D as a **live, attributed visualization** for the selected coordinates.

Deployment variable:

```text
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=
```

The Google key is intentionally browser-visible and therefore must be restricted in Google Cloud by the production/preview HTTP referrers and restricted to the Maps APIs Voxel Vault actually uses. Do not reuse a server secret as this browser key.

Enable the Google Maps JavaScript API / 3D Maps capability for the project. The Voxel Vault component imports `maps3d`, creates `Map3DElement`, and explicitly uses `mode: 'HYBRID'`.

Google imagery/tiles stay inside Google's live map surface. Voxel Vault does **not** download, scrape, extract building meshes from, train on, reconstruct from, or permanently cache Google map imagery/tiles.

If the key is absent or Google 3D fails, the Earth page remains usable and starts/falls back to the source-backed Voxel and Globe paths plus external Google Maps navigation.

## 2. Open/source-backed geometry — Overture first, OSM fallback

Primary global building source:

- Overture Maps Foundation Buildings PMTiles, pinned to the reviewed release in `lib/overture-building-tiles.js`.
- Small z/x/y regions are range-read as the user explores; the browser does not download the planet.
- OpenStreetMap / Overpass is a fallback rather than the primary dependency.

Map geometry is reference geometry. It is not automatically a cadastral survey, deed, title record, current facade scan, or listing.

## 3. Listing photos — authorized display evidence

The market layer can display photos that arrive from configured authorized listing providers such as Bridge/participating MLS datasets, Domain Australia, or a contracted normalized partner feed, subject to that provider's display rights and terms.

Display rights do **not** imply AI derivative-generation rights.

Zillow, Redfin, Realtor.com and similar services can be opened as external cross-check/reference destinations from the evidence panel. Voxel Vault does not scrape their photo libraries into its model cache.

A future data partner may provide Meshy-ready media only when the provider contract explicitly grants derivative-generation rights. The normalized listing contract can surface those as `meshyReferences` containing a URL, rights basis, and license/permission reference. Ordinary listing images are never auto-promoted into that field.

## 4. Meshy 7 — selective property reconstruction

Server variable:

```text
MESHY_API_KEY=
```

The key must stay server-only; never use a `NEXT_PUBLIC_` prefix.

World property generation policy:

- Model: `meshy-7`
- Multi-image workflow: 2–4 rights-cleared views in Voxel Vault (Meshy supports up to 4; view 1 is the front/primary view)
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

The owner iPhone workflow accepts a photo selection and normalizes it in the browser to a max-2048px high-quality JPEG before private upload. The server only accepts JPEG/PNG Meshy references, stores a rights sidecar, and creates a short-lived signed URL for the Meshy task.

Accepted rights bases:

- user-owned
- open-licensed with derivative permission
- explicitly licensed for derivative generation

Google Maps/Earth/Street View, Zillow, Redfin and Apartments.com hosts are blocked as direct Meshy inputs unless the application is later changed under a reviewed license that actually permits that derivative use.

## 5. Runtime capability status

`GET /api/world-atlas/capabilities` reports booleans and safe metadata for:

- Overture world atlas
- Google 3D browser configuration
- Meshy server configuration
- authorized market-media providers

It never returns API keys or provider secrets.

The Earth UI shows these states so a deployment cannot quietly look complete while a required provider is missing.

## 6. Legal / truth boundaries

- Google visual reality != Voxel Vault-owned imagery.
- Map footprint != survey or parcel title.
- Listing photo != derivative-generation license.
- Meshy model != deed or verified architecture by itself.
- Digital stewardship claim != physical property ownership.
- Market listing != Voxel Vault authority to sell the property.
- Token/NFT != deed, title, tenancy, rent entitlement, or investment interest unless a separate enforceable provider/legal structure actually grants those rights.

The winning product is the Voxel Vault atlas experience, verification graph, original metadata, compliant generated-model cache, and financial/property workflow—not a false claim that Voxel Vault owns underlying Earth imagery or public map data.
