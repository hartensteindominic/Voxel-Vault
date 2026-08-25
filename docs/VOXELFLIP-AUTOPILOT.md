# VoxelFlip monitored autopilot

VoxelFlip automatic execution must use a dedicated trading signer or a delegated Base Account permission. Do not reuse the collection owner key or the VoxelFlip mint-signer key for trading.

## Server configuration

- `OPENSEA_API_KEY` — market data and marketplace API access.
- `VOXELFLIP_RPC_URL` — production Base RPC. Base's public RPC is rate-limited and is kept only as a recovery fallback.
- `VOXELFLIP_TRADER_PRIVATE_KEY` — dedicated trading signer only. Never commit this value.
- `VOXELFLIP_AUTO_EXECUTION_ENABLED=true` — explicit server kill-switch. Leave false until the signer and limits are reviewed.

Optional hard limits:

- `VOXELFLIP_AUTO_MAX_TRADE_ETH` — default `0.005` ETH.
- `VOXELFLIP_AUTO_MAX_DAILY_SPEND_ETH` — default `0.02` ETH.
- `VOXELFLIP_AUTO_MAX_DAILY_LOSS_ETH` — default `0.005` ETH.
- `VOXELFLIP_AUTO_MAX_INVENTORY` — default `3` NFTs.
- `VOXELFLIP_AUTO_MIN_EDGE_BPS` — default `800` bps modeled edge.

The dashboard exposes only whether each component is configured, the dedicated bot-wallet address, and the active risk limits. It never returns a private key.

## Execution model

A personal injected wallet such as MetaMask should not be silently bypassed. For no-prompt execution, use either:

1. a separately funded dedicated bot wallet controlled by the server, or
2. Base Account spend permissions/app-account delegation, where the user grants a bounded permission once and the app executes within that permission afterward.

Before expanding beyond monitoring, execution code must enforce the displayed contract allowlist, per-trade cap, daily spend cap, daily loss circuit breaker, inventory cap, and minimum-edge threshold server-side. Every submitted transaction should be recorded with the opportunity snapshot and resulting receipt so predicted versus realized performance can be audited.
