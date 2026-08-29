# Voxel Vault deployment marker

This is a historical no-op deployment marker. It is **not** the source of truth for release readiness.

The current public product baseline is:

- public no-login VoxelPop sample;
- authorized house photo → **$4.99 digital creation**;
- textured 3D preview shown before voxel conversion;
- explicit user approval before the movable voxel is built;
- normal property creation works without Meshy credits;
- source photo remains device-local in the normal flow;
- World, Vault, and minting are optional downstream actions;
- demo, financial/provider, and real-property title workflows remain clearly separate and fail closed when their required rails are unavailable.

Use `docs/ARCHITECTURE.md`, `docs/SECURITY_REVIEW.md`, the current CI checks, and the exact deployed commit—not this marker—to decide whether a release is ready.
