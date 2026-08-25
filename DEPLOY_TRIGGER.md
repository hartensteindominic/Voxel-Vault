# Voxel Vault deployment trigger

This branch-only file intentionally forces a fresh Vercel Preview deployment for `experiment/voxelflip-opensea` so the Preview runtime serves the current VoxelFlip registration flow and re-reads the current Vercel Preview environment variables.

This does not modify `main`, the protected VoxelPop FINAL, or the live production site.

VoxelFlip preview refresh requested after removing Supabase from the critical registration path: 2026-08-25 15:41 UTC.
