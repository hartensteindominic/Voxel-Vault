# Voxel Vault Neural Core

Private backend market memory for VoxelFlip.

## Route

- `/admin/neural-core` — private mission control UI.
- `/api/admin/neural-core` — Google-session + server allowlist protected data API.
- `/api/cron/neural-core` — 30-minute Vercel monitoring refresh, protected by `CRON_SECRET`.

The dashboard is `noindex`, `/admin/` and `/api/admin/` are disallowed in `robots.txt`, and the API fails closed without an explicit admin allowlist.

## What it observes

- ETH/USD and 24h ETH move from CoinGecko.
- Base gas from the configured Base RPC.
- VoxelFlip OpenSea collection metadata, stats, sale events, offers and wallet inventory.
- VoxelFlip realized-profit ledger context.

OpenSea and CoinGecko credentials remain server-side. The browser only receives normalized market data.

## Memory and learning

Migration `012_voxelflip_neural_core.sql` creates `public.voxelflip_neural_memory`.

- Market snapshots are stored no more than once every 30 minutes per selected wallet.
- Recommendations are stored no more than once every 6 hours.
- The learning engine refuses to claim a repeatable pattern when the sample is too small.
- Asking prices, self-trades and unsold inventory are never treated as realized value.
- Memory can be exported from the private dashboard as JSON.

## Required production configuration

Existing server configuration remains required:

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENSEA_API_KEY`
- `VOXELFLIP_RPC_URL`
- VoxelFlip deployment configuration

Neural Core adds:

- `NEURAL_CORE_ADMIN_EMAILS` — comma-separated Google account email allowlist, **or**
- `NEURAL_CORE_ADMIN_USER_IDS` — comma-separated Supabase Auth user UUID allowlist.
- `CRON_SECRET` — protects the background monitoring endpoint.

Optional:

- `COINGECKO_DEMO_API_KEY`
- `COINGECKO_PRO_API_KEY`
- `VOXELFLIP_NEURAL_WALLET` — public Base address fallback for cron. If omitted, the dashboard stores the selected wallet after an authorized admin connects it.

Never put the Supabase service-role key, OpenSea API key, private keys or `CRON_SECRET` into browser code.

## Database migration status

The repository's Supabase migration workflow intentionally skips when its GitHub migration credentials are absent. A green workflow therefore does not prove a migration ran. Check the job steps: `Apply pending migrations` must show **success**, not **skipped**.

## Execution safety

Neural Core is observation + memory + recommendation only.

These remain hard OFF:

- automatic listing
- automatic buying
- automatic minting
- automatic signing
- automatic ETH/WETH spending

A future executor must be a separate, bounded component with explicit spending limits, allowlists, loss breakers and a kill switch. Neural Core must never bypass wallet authorization.

## Value policy

No NFT system can guarantee a market price or future appreciation. Neural Core supports value discipline by measuring external demand, liquidity, cost basis, sale evidence and market conditions, while refusing to label an asking price as realized value.
