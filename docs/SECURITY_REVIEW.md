# Voxel Vault Security Review

## Release gate

Security review is a separate gate from build success. A production release is not green until the intended commit is verified on the live deployment and no critical runtime/security issue remains.

## Findings reviewed for this release

- **Wallet authority:** client proximity detection is treated as UX/eligibility input, not as permission to sign, mint, transfer, or grant ownership.
- **Rewards:** USD rewards require verified payment state before crediting; reward transitions are state-gated and regression-tested.
- **Checkout:** the client requests a server checkout URL and does not treat a client-side success flag as proof of payment.
- **Property creation:** the $4.99 creation entitlement is verified server-side against Stripe amount, currency, payment status, generation kind and signed-in user before the paid flow resumes.
- **Property voxel minting:** mint preparation is downstream of the reviewed local voxel and remains a separate wallet-approved action; a digital voxel/NFT is not deed/title, equity, rent, occupancy or an investment right.
- **Catalog 3D worker:** metered Meshy catalog generation is internal-only, requires `CRON_SECRET`, and resolves generation inputs from the trusted repository catalog instead of accepting arbitrary caller-supplied source/image URLs. This worker is separate from the no-Meshy property creator.
- **Marketplace payouts:** third-party marketplace checkout fails closed unless a server-only activation flag is enabled and Stripe itself confirms the connected account has charges, payouts and onboarding enabled. Browser/database readiness flags are not treated as payment authority.
- **Seller payout row writes:** migration 017 removes authenticated-user insert/update policies from `seller_accounts`; payout routing fields are intended to be written only by trusted server/service-role onboarding after Stripe verification.
- **Incomplete paid routes:** receipt collectible mint checkout is disabled until a durable post-payment fulfillment/mint consumer exists. The disabled route cannot create a Stripe Checkout Session.
- **NFT media:** broken/unsupported media must degrade to a visible recovery state instead of silently producing an empty card.
- **WebGL:** passive gallery rendering is subject to the mobile/WebGL guard; full inspection remains an explicit user action.
- **CI mutation risk:** Mobile WebGL Guard is read-only (`permissions: contents: read`) and has no repository write step.
- **Repository-file integrity:** the dedicated full tracked-file audit reads every committed path, validates JSON/relative imports/local Markdown links, scans high-confidence secret patterns, fingerprints the repository, and enforces deployment-safety invariants.
- **Release-test coverage:** the primary Quality Gate runs collection integrity, commerce hardening, route integrity, VoxelPop/property safety, financial-provider boundaries, contracts and the production build.

## External configuration that code cannot prove

- A successful Supabase migration workflow run is not proof that migrations reached the database when the workflow skipped CLI/link/push steps because credentials were absent. Migration application must be verified against the target project before database-dependent features are called live.
- Historical migration filenames include reused numeric prefixes `002` and `003`. Do not rename or replay historical migrations until the target database migration history has been reconciled. The full-file audit treats these known collisions as warnings and blocks new duplicate migration prefixes.
- The repository ruleset requires pull requests and blocks force-push/deletion of `main`, but it does not currently require approving reviews or CI status checks. Until that is changed in repository settings, release operators must verify all checks against the exact PR head SHA before merge.
- GitHub/Vercel/Supabase/Stripe/provider dashboard settings and secret values cannot be proven correct by source review alone; capability endpoints must expose status only, never secret values.

## Dependency audit note

As of the August 29, 2026 repository-wide review, `npm audit --omit=dev --audit-level=critical` on the current production dependency graph reports **0 vulnerabilities**. The install still reports deprecation warnings from some transitive packages, so dependency maintenance remains normal technical debt rather than a current npm-audit security finding.

Release policy remains:

1. critical vulnerabilities are a hard CI blocker;
2. newly reported high/critical findings are reviewed before release rather than hidden or force-fixed;
3. breaking dependency-major upgrades receive their own branch and full regression cycle;
4. production dependencies and development tooling are kept distinguishable when assessing runtime exposure.

## Release rule

**Green build never means finished.** The live deployment, rendered UI, critical flows, security state, database migration state and expected commit must all agree before release.
