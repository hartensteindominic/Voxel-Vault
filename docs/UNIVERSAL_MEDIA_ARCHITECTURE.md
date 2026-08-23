# Voxel Vault Universal Media Architecture

## Product rule

Voxel Vault is **3D-first**, not 3D-only. Images and videos are supported as accessible collectible formats and as clues/rewards in map hunts. 3D remains the flagship because it enables interaction, inspection, portability and future AR/metaverse workflows.

## Canonical media types

- `3d`: GLB/GLTF, interactive viewer, future AR and compatibility profiles.
- `image`: JPG/JPEG/PNG/WebP/GIF, lightweight collectible and hunt clue.
- `video`: MP4/WebM/MOV, animated collectible and hunt clue.

All three use the same ownership, metadata, provenance, discovery and marketplace concepts.

## Architecture

```text
                    VoxelCollectible
                           |
          +----------------+----------------+
          |                |                |
         3D              IMAGE            VIDEO
          |                |                |
      GLB/GLTF          artwork          animation
          |                |                |
          +----------------+----------------+
                           |
                    NFT / ownership
                           |
              +------------+------------+
              |                         |
           Marketplace              Map/Hunts
              |                         |
          Buy/Offer/Trade       Discover/Claim/Drop
```

## 3D-first experience

3D collectibles receive the richest product treatment: interactive rotation, zoom, fullscreen inspection, animation playback when supplied, GLB/GLTF staging, future AR and compatibility profiles.

## Map rules

A map drop may contain any supported media type. A hunt may mix formats, for example image clue -> video clue -> final 3D collectible. Location is a discovery rule and must not be treated as proof of blockchain ownership. Anti-spoofing, signed claims and rate limiting belong in the server-side claim system.

## Upload safety

The creator client validates file type and size before staging. Server-side storage endpoints must repeat validation and must not trust client MIME types. 3D assets should additionally be checked for model/texture complexity before publication.

## Important separation

Staging a local preview is not minting. Upload/storage, metadata publication and on-chain minting are separate confirmation steps. The UI must never imply ownership until the chain transaction is confirmed.

## Build order

1. Stabilize 3D rendering and mobile behavior.
2. Universal collectible schema and media validation.
3. Image and video staging.
4. GLB/GLTF staging and real viewer loading.
5. Creator Studio.
6. Map drops and mixed-media hunts.
7. Wallet ownership synchronization.
8. Marketplace lifecycle.
9. Tap-to-trade using QR/deep links, then NFC as a transport layer.
10. Advanced deterministic/procedural 3D generation.
11. AI-assisted 3D creation and AI curator.
12. AR and verified external compatibility profiles.
13. Security audit, testnet soak, canary mainnet and monitoring.
