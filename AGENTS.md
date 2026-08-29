<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# VoxelPop product lock — read this before every change

You are editing a live consumer product. The owner is tired of agents "improving" it into something worse. Follow this lock exactly.

## The only public product

```
authorized house photo → $4.99 → 3D voxel photo review → explicit approval → movable 3D voxel → auto-save to Vault → optional mint
```

That is the whole product. Do not add screens, gates, identity locks, maps, wallets, or finance chrome to this path.

## Hard rules

1. **Do not add extra steps.** No address verification, one-of-one property lock, World atlas gate, or "confirm the parcel" screen before photo → pay → 3D. The signed-in Create flow is four stages: PHOTO, REVIEW, BUILD, DONE.
2. **3D must actually render.** Homepage and `/demo` use `/voxelpop/demo-house.jpg` (a raster image). Never point Three.js sampling at an SVG. Never crop with `drawImage(..., naturalWidth || 1, naturalHeight || 1, ...)`. Never put `max-width: 100%` on `canvas`. If a 3D viewer cannot build, show the source photo — never a blank WebGL hole.
3. **Keep the VoxelPop look.** Warm cream `#fffaf0`, purple `#7138f5`, lime `#c9ff54`, chunky rounded cards, one huge VOXELPOP wordmark. Do not restyle into a dark "financial OS", command palette, or generic SaaS dashboard.
4. **Do not expand scope.** Experimental systems (REITs, liquidity, Algorand, title, hunts, profit engines) stay out of Home / Create / Vault navigation. Do not "center" them.
5. **Do not rewrite working 3D viewers** (`PhotoReliefModelViewer.js`, `LocalVoxelModelViewer.js`) unless you have a failing 3D bug and a regression test. No 2D poster detours.
6. **Price stays $4.99.** Server-authoritative. No second checkout in the normal creation flow.
7. **Source photo stays on-device.** No Meshy, no uploading the house photo to object storage for the normal flow.
8. **Legal boundary is sacred.** Digital collectible only. Never imply deed, title, rent, occupancy, investment, or ownership of a physical house.
9. **Prefer the smallest diff.** If the user liked the current UI, restore it. Do not condense, rebrand, or "simplify" by adding a new architecture.
10. **Prove 3D.** After UI/3D changes run `npm run test:simple-property-world` and `npm run test:public-demo`. If you cannot see a canvas with colored cubes, you are not done.

## Files you may touch for the public product

- `app/page.js`, `app/home.module.css`
- `app/components/HomeProductPreview.js`
- `app/demo/`
- `app/property/PropertyJourneySimple.js`
- `app/property/PhotoReliefModelViewer.js`
- `app/property/LocalVoxelModelViewer.js`
- `app/vault/`, `app/world/`
- `app/voxelpop-cute-system.css`

If a task needs anything else, stop and ask. Do not invent a new gate, API, or visual system.
