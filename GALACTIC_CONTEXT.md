# Galactic Trust – Permanent AI Context

## Product truth

Galactic Trust is a galaxy-themed financial technology product. It is not a bank.

The current product has two safe testing states:

- **Demo UI:** local illustrative balances, cards, transfers, rewards, activity, and crypto practice.
- **Increase sandbox:** provider-backed test data and ACH simulations using pretend money only.

Production banking and live crypto are not implemented or enabled. Never imply otherwise.

## Current repository architecture

The GitHub repository is still named `hartensteindominic/Voxel-Vault` for compatibility, but the active product is Galactic Trust.

Primary product surface:

- `app/bank/page.js` – `/bank` entry point and styles.
- `app/bank/GalacticBankGate.js` – Supabase session gate; mounts the signed-in/demo dashboard surfaces.
- `app/bank/BankClient.js` – primary Galactic Trust dashboard and local demo interactions.
- `app/bank/GalacticDashboardEnhancements.js` – existing dashboard refinements.
- `app/bank/GalacticDashboardAccountState.js` – server-derived Demo / Increase sandbox / setup-required state.
- `app/bank/GalacticHeaderCenter.js` – notifications and profile controls.
- `app/bank/GalacticCryptoPractice.js` – isolated local crypto practice; no live crypto provider and no real trades.
- `app/bank/GalacticSandboxSetup.js` – owner Increase sandbox setup when provider capabilities permit it.
- `app/bank/GalacticIncreaseSandboxRecovery.js` – owner-only Increase sandbox recovery when Programs/Entities are private features.
- `app/bank/galactic-trust.css`, `enhancements.css`, and component CSS modules – existing visual system to extend before inventing new styling.

Banking server boundaries:

- `app/api/bank/lifecycle/route.ts` – signed-in lifecycle summary used by dashboard status UI.
- `app/api/admin/bank/increase/status/route.ts` – sanitized Increase sandbox capability status.
- `app/api/admin/bank/increase/dashboard/route.ts` – sanitized owner sandbox dashboard snapshot.
- `app/api/admin/bank/increase/fund/route.ts` – owner-only Increase sandbox inbound ACH simulation.
- `app/api/admin/bank/increase/transfer/route.ts` – owner-only Increase sandbox ACH simulation.
- `app/api/admin/bank/increase/recovery/route.ts` – owner-only Account recovery that avoids restricted Programs/Entities APIs.
- `lib/banking/increase-owner-account.js` – resolves the owner sandbox Account from the preferred database binding or the deterministic Increase idempotency-key fallback.
- `lib/banking/increase-sandbox-recovery.js` – creates/rediscovers the dedicated owner sandbox Account without hosted onboarding when allowed.
- `lib/banking/regulated-launch.js` – hard production launch locks. Do not weaken or bypass it.
- `lib/banking/orbit-chat.js` – Orbit product-support response logic.

## Sacred safety rules

1. **Real customer money stays locked.** Do not add or enable live deposits, withdrawals, transfers, card issuance, or production banking writes.
2. **Live crypto stays locked.** `GalacticCryptoPractice` is local practice only. Never claim a real asset was bought, sold, held, or transferred.
3. **Do not call Galactic Trust a bank.** Describe it as a financial technology product/application.
4. **Never claim FDIC insurance, bank insurance, approval, KYC completion, CIP completion, AML approval, sanctions approval, or credit approval.**
5. **Increase sandbox uses pretend money.** Provider-backed sandbox data is still not real customer money.
6. `SANDBOX_VALID_SIMULATION` means provider sandbox validation only; it is not real KYC/CIP/AML approval.
7. `SANDBOX_ACCOUNT_ONLY` means the owner sandbox Account was created/recovered without an Entity onboarding decision. It is explicitly not KYC.
8. Keep provider credentials server-only. Never expose API keys, full provider Account/Entity IDs, raw account numbers, routing numbers, secrets, or private keys to browser code or chat output.
9. Never put provider secrets in `NEXT_PUBLIC_*` variables.
10. Preserve owner/admin authorization on all `/api/admin/bank/*` routes.

## Increase sandbox facts

- Sandbox API origin: `https://sandbox.increase.com`.
- Server configuration currently uses `INCREASE_SANDBOX_API_KEY` and `GALACTIC_INCREASE_SANDBOX_ENABLED=true` when sandbox testing is enabled.
- Programs and Entities can be unavailable as private features. That must not automatically block owner sandbox Account testing.
- Owner recovery uses a deterministic, user-scoped Increase idempotency key to find or create one dedicated sandbox Account.
- Database provider binding is preferred when available, but migration 025 is not a blocker for owner dashboard/fund/transfer sandbox testing because the idempotency lookup is the fallback.
- The legacy database table name `vault_provider_account_bindings` is retained for migration compatibility. Do not rename it casually.
- Account Number creation is optional for recovery; a restricted Account Number feature must not be confused with failure to recover the Account itself.

## External setup that code cannot fake

- GitHub Actions Supabase migration secrets still need to be configured before pending migrations can be applied reliably: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, and `SUPABASE_DB_PASSWORD`.
- Do not ask users to paste secrets into chat.
- A future production banking launch requires an actual approved provider/sponsor-bank program plus the required compliance, operational, legal, privacy, and customer-support work. Code must not simulate those approvals.

## UI and product rules

- Extend existing Galactic Trust components and CSS before creating new architecture.
- Keep the galaxy visual language, responsive behavior, and current information hierarchy.
- Make Demo / Increase sandbox wording obvious near actions and balances.
- All primary actions need clear disabled, loading, success, and failure states where applicable.
- Use accessible labels and preserve visible keyboard focus.
- Prefer small vertical slices and the fewest files that safely achieve the outcome.
- Keep Orbit limited to product support and privacy-aware guidance. It must never request passwords, PINs, CVVs, recovery codes, one-time codes, API keys, or banking secrets.
- Sample data must remain professional but unmistakably simulated.

## Verification ritual

This repository does **not** currently define `npm run typecheck` or `npm run test:safety`.

Use the repository's real checks:

```bash
npm run test:galactic
npm run build
```

`npm run test:galactic` is the canonical Galactic Trust guardrail suite and currently covers repository scope, UI truth, provider boundaries, regulated launch locks, Increase onboarding, webhooks, account lifecycle/status UI, integration health, crypto practice, header behavior, and Increase recovery.

A change is not done until the relevant checks are green and the resulting UI still states the demo/sandbox truth accurately.

## Working method for AI coding sessions

Before editing:

1. Read this file.
2. Read the current target component/API route instead of assuming old filenames or environment variables.
3. Check `main` for concurrent changes before opening a branch.
4. Define one user-visible outcome and its verification.

During editing:

1. Reuse existing patterns.
2. Do not invent a new state manager, design system, provider abstraction, or folder structure unless the current code truly requires it.
3. Reject any change that weakens production locks or turns sandbox/demo language into live-money language.
4. Do not add real financial claims merely to make the interface feel more bank-like.

Before merging:

1. Run `npm run test:galactic`.
2. Run `npm run build`.
3. Review desktop and mobile behavior for the touched flow.
4. Confirm no secrets, raw provider identifiers, or misleading live-money claims were introduced.
5. Keep the commit/PR description explicit about demo/sandbox behavior and production locks.
