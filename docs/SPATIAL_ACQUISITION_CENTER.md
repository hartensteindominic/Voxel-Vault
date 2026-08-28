# Voxel Vault Spatial Acquisition Center

## Purpose

`/vault/acquisitions` turns the existing Voxel Vault acquisition-engine research output into a spatial diligence room.

It is a visualization and research workflow, not a transaction surface.

The first version intentionally uses controlled demonstration candidates so the spatial interaction can be built and tested without implying that Voxel Vault has live listing feeds, verified appraisals, seller authority or permission to purchase property.

## Source of truth

The candidate economics and diligence decisions use:

```text
lib/real-estate/acquisition-engine.js
```

The spatial manifest lives in:

```text
lib/vault/acquisition-center.js
```

Every spatial candidate has:

```text
executionAllowed: false
```

The acquisition policy also keeps:

```text
LIVE_ACQUISITION_EXECUTION_READY = false
```

A rank or score can organize human research. It is never an authorization to spend money or buy property.

## Spatial status meanings

The 3D room uses three research states:

- **Teal / human review eligible** — current demo hard gates are satisfied and economics are positive enough for a person to continue review.
- **Amber / diligence open** — hard gates are currently clear, but important independent checks are incomplete.
- **Red / hard stop** — one or more required diligence gates fail. The candidate cannot advance because it is cheap or has an attractive modeled yield.

The far execution gate remains visibly locked.

## Hard-stop principle

The acquisition engine treats these as hard gates:

- title verified,
- liens/restrictions cleared,
- taxes confirmed current,
- habitability confirmed,
- rental legality confirmed,
- insurance availability confirmed.

A cheap purchase price cannot override a failed hard gate.

## Modeled economics are not forecasts

The demo cards can display modeled:

- listing price,
- all-in basis,
- gross rent,
- operating expenses,
- monthly net,
- modeled net yield.

These values are research inputs/outputs. They are not an appraisal, guaranteed return, investment recommendation or live offer.

## What the room cannot do

The Acquisition Center has no property-purchase action.

It cannot:

- submit an offer,
- accept a seller contract,
- spend cash or crypto,
- wire escrow funds,
- borrow money,
- transfer a deed,
- create a deed by minting a token,
- issue a property-interest token from demo research,
- bypass title/closing counsel,
- convert a research rank into an investment recommendation.

## Graduation path

A future real candidate must progress through a normal sequence:

```text
research candidate
→ independent diligence
→ legal/entity/financing approval
→ negotiated contract
→ escrow/title/attorney closing
→ recorded deed
→ verified property/entity records
→ only then: Property Passport / spatial twin
```

Future provider/listing adapters must preserve provenance and must not silently promote unverified internet data into an executable acquisition.

## Release tests

`npm run test:acquisition-center` asserts that:

- every spatial candidate remains non-executable,
- the cheapest demo does not outrank hard diligence failures,
- review eligibility is distinct from execution permission,
- live acquisition remains code-locked,
- the page exposes no purchase click handler or hidden `fetch()` execution call,
- title/deed closing remains outside blockchain simulation,
- the persistent Vault navigation exposes the Acquisition Center.

The GitHub Quality Gate runs this test before `next build`.
