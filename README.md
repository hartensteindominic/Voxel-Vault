# Galactic Trust

Galactic Trust is the sole active product in this repository.

It is a financial technology interface for account dashboards, transaction activity, card controls, owner-scoped provider sandbox tooling, account lifecycle status, and regulated-launch readiness.

## Important boundary

Galactic Trust is **not a bank** and does **not currently accept or hold real customer deposits**. The connected Increase integration is a **pretend-money sandbox**. Production banking and crypto movement are hard-locked in source code until a reviewed provider/sponsor-bank program and required control evidence exist.

## Active code

- `app/bank` — Galactic Trust customer/demo/sandbox UI
- `app/api/bank` — lifecycle, readiness, and Increase webhook endpoints
- `app/api/admin/bank` — owner-only Increase sandbox operations
- `lib/banking` — banking boundaries, Increase sandbox adapter, onboarding, reconciliation, provider bindings, and Orbit responses
- `lib/*supabase*` / `lib/admin-auth.ts` — authentication infrastructure
- `docs/GALACTIC_TRUST_*` — operating and launch documentation
- `scripts/test-galactic-trust-*` — Galactic Trust regression suite

## Database migration history

`supabase/migrations` intentionally retains earlier historical migrations because an already-linked Supabase project may depend on its migration ledger. Those files are migration history, not active Voxel/real-estate product surfaces. Galactic Trust-specific migrations are 023, 024, and 025.

## Commands

```bash
npm install
npm run dev
npm run test:galactic
npm run build
```

## Increase sandbox setup

Set `INCREASE_SANDBOX_API_KEY` only in the server environment and set `GALACTIC_INCREASE_SANDBOX_ENABLED=true` only when the sandbox is intentionally connected. Never commit provider secrets and never expose them through `NEXT_PUBLIC_*` variables.

See `docs/GALACTIC_TRUST_INCREASE_SANDBOX.md` and `docs/GALACTIC_TRUST_INCREASE_WEBHOOKS.md`.
