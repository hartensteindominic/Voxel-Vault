# Voxel Vault Security Review

## Release gate

Security review is a separate gate from build success. A production release is not green until the intended commit is verified on the live deployment and no critical runtime/security issue remains.

## Findings reviewed for this release

- **Wallet authority:** client proximity detection is treated as UX/eligibility input, not as permission to sign, mint, transfer, or grant ownership.
- **Rewards:** USD rewards require verified payment state before crediting; reward transitions are state-gated and regression-tested.
- **Checkout:** the client requests a server checkout URL and does not treat a client-side success flag as proof of payment.
- **Marketplace payouts:** third-party marketplace checkout fails closed unless a server-only activation flag is enabled and Stripe itself confirms the connected account has charges, payouts and onboarding enabled. Browser/database readiness flags are not treated as payment authority.
- **Seller payout row writes:** migration 017 removes authenticated-user insert/update policies from `seller_accounts`; payout routing fields are intended to be written only by trusted server/service-role onboarding after Stripe verification.
- **Incomplete paid routes:** receipt collectible mint checkout is disabled until a durable post-payment fulfillment/mint consumer exists. The disabled route cannot create a Stripe Checkout Session.
- **NFT media:** broken/unsupported media must degrade to a visible recovery state instead of silently producing an empty card.
- **WebGL:** passive gallery rendering is subject to the mobile/WebGL guard; full inspection remains an explicit user action.
- **CI mutation risk:** repository validation workflows use read-only repository permissions where they do not need writes.
- **Release-test coverage:** the primary Quality Gate runs collection integrity, commerce hardening, route integrity, property/VoxelPop, Vault, provider-boundary and production-build checks in addition to the existing product/security suites.

## External configuration that code cannot prove

- A successful Supabase migration workflow run is not proof that migrations reached the database when the workflow skipped CLI/link/push steps because credentials were absent. Migration application must be verified against the target project before database-dependent features are called live.
- Historical migration filenames include reused numeric prefixes. Do not rename or replay historical migrations until the target database migration history has been reconciled.
- The repository ruleset requires pull requests and blocks force-push/deletion of `main`, but it does not currently require approving reviews or CI status checks. Until that is changed in repository settings, release operators must verify all checks against the exact PR head SHA before merge.

## Dependency audit note

On August 29, 2026, the deterministic PR build for the current lockfile completed `npm ci` successfully and `npm audit --omit=dev --audit-level=critical` reported **0 production vulnerabilities**.

The install still reports deprecation notices from transitive tooling packages such as older `glob`, `inflight`, `lodash.isequal`, and `uuid` versions. Those warnings are maintenance debt in the broader tooling graph; they are not a current production-vulnerability finding. Tooling/dependency-major upgrades should continue on isolated branches with the full regression suite rather than by silently running `npm audit fix --force`.

Release policy:

1. production critical vulnerabilities remain a hard CI blocker;
2. production dependencies are audited on the exact committed lockfile;
3. deprecation/tooling debt is reviewed separately from runtime vulnerability status;
4. dependency-major upgrades receive their own branch and full regression cycle.

## Release rule

**Green build never means finished.** The live deployment, rendered UI, critical flows, security state, database migration state and expected commit must all agree before release.
