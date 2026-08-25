# Voxel Vault / VoxelPop route audit — 2026-08-25

This inventory covers every public Next.js `page.*` route present in `app/` during the VoxelFlip Factory profit-ledger pass. The release test `scripts/test-route-integrity.mjs` now fails on duplicate page/API route handlers and verifies the critical VoxelPop/VoxelFlip surface remains present with automatic signing disabled.

## Current VoxelPop / VoxelFlip flow

| Route | Role | Audit result |
| --- | --- | --- |
| `/` | VoxelPop home (renders Studio) | CURRENT |
| `/studio` | VoxelPop generator + My Voxels + Google sync | CURRENT |
| `/pack/success` | Paid asset generation, mesh, downloads, minted-state handoff | CURRENT; requires `session_id` |
| `/voxelflip/mint` | Duplicate-safe Base mint/recovery/verification | CURRENT; requires paid voxel session |
| `/voxelflip/autopilot` | Read-only OpenSea/Base market monitor | CURRENT; automatic signing OFF |
| `/voxelflip/factory` | Profit ledger + conservative compounding workflow | CURRENT; spending/signing OFF |
| `/mint-trade` | Legacy VoxelFlip entry point | SAFE REDIRECT to `/voxelflip/mint` |
| `/voxelflip/ecology` | Future staged agent economy concept | GATED/FUTURE; no automatic signing |

## Legal

| Route | Role | Audit result |
| --- | --- | --- |
| `/privacy` | Privacy | CURRENT |
| `/terms` | Terms | CURRENT |

## Existing Voxel Vault surfaces kept separate from VoxelPop

These routes remain because they are distinct existing product/collection experiences. They are not advertised in the VoxelPop sitemap and must not be interpreted as VoxelFlip Factory execution.

| Route | Existing purpose | Audit classification |
| --- | --- | --- |
| `/ai` | Vault AI research | LEGACY/SEPARATE; duplicate implementation removed |
| `/asset/[id]` | Catalog asset detail | LEGACY/SEPARATE |
| `/avatar` | Avatar experience | LEGACY/SEPARATE |
| `/capture` | Capture flow | LEGACY/SEPARATE |
| `/discover` | Discovery | LEGACY/SEPARATE |
| `/hunt` | Hunt experience | LEGACY/SEPARATE |
| `/marketplace` | Existing marketplace | LEGACY/SEPARATE; removed from VoxelPop sitemap |
| `/messages` | Messages | LEGACY/SEPARATE |
| `/mint` | Physical-product + 3D collectible preview | LEGACY/SEPARATE; not VoxelFlip mint |
| `/networks` | Networks | LEGACY/SEPARATE |
| `/orders` | Orders | LEGACY/SEPARATE |
| `/passport` | Passport | LEGACY/SEPARATE |
| `/quantum` | Classical quantum simulation UI | LEGACY/SEPARATE |
| `/receipt` | Receipt/product scan | LEGACY/SEPARATE |
| `/room` | Vault room | LEGACY/SEPARATE |
| `/scan` | Scan flow | LEGACY/SEPARATE |
| `/spots` | Spots | LEGACY/SEPARATE |
| `/trade` | Existing TapToTrade offer flow | LEGACY/SEPARATE; not VoxelFlip Autopilot |
| `/twin` | Digital twin | LEGACY/SEPARATE |
| `/vault` | Existing vault | LEGACY/SEPARATE |

## API route integrity findings fixed

- Removed duplicate `app/ai/page.js`; `app/ai/page.tsx` is the single `/ai` page implementation.
- Removed duplicate `app/api/quantum/simulate/route.js`; the TypeScript circuit simulator is the single `/api/quantum/simulate` handler.
- Updated `app/sitemap.js` from the old marketplace/catalog index to the current VoxelPop launch surface.
- Updated `app/robots.js` production fallback to `https://www.voxelvault.io`.
- Added `test:routes` to `test:release` so duplicate routes, missing critical VoxelFlip pages, stale sitemap indexing, or direct automatic-signing activation fail release validation.

## Factory financial safety state

- Gross OpenSea sale proceeds are ledger income, not profit.
- Self-sales and unsold inventory do not count as profit.
- Confirmed mint gas is recorded from the actual Base receipt only when the gas payer is the owner wallet.
- Reinvestment remains blocked unless the ledger has complete required cost coverage for sold inventory.
- Factory defaults remain conservative: majority reserve, capped reinvestment, daily mint and inventory limits, kill switch.
- Scout / Pricer / Risk / Maker agents may observe and draft recommendations only. Spending, minting, listing, transfers, and signatures remain approval-gated until a separately verified bounded executor exists.

## Remaining intentional gates

1. Apply migration `011_voxelflip_profit_ledger.sql` to the production Supabase database if deployment automation does not apply migrations.
2. Capture marketplace sale fees in a verified form before claiming full ETH cost coverage.
3. Capture generation/mesh production costs with a verified currency basis before mixing those costs into realized profit.
4. Build and test the internal generation queue.
5. Build and separately verify bounded mint/list approvals. Do not enable automatic signing as part of the ledger rollout.
