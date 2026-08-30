# Galactic Trust — Increase sandbox integration

Status: **sandbox candidate only — no production banking relationship is implied**.

Galactic Trust is evaluating Increase as the first banking-infrastructure sandbox because its public API exposes accounts, account numbers, transactions, ACH, real-time payments, cards, entities, onboarding sessions, programs and webhooks, and it provides a sandbox environment where no real money moves.

Official references:

- https://increase.com/documentation/sandbox
- https://increase.com/documentation/api
- https://increase.com/documentation/entities
- https://increase.com/documentation/hosted-onboarding
- https://increase.com/terms

## What is wired in this repository

`lib/banking/increase-sandbox.js` is deliberately pinned to `https://sandbox.increase.com` and accepts only the server-only `INCREASE_SANDBOX_API_KEY`. It never falls back to the generic production banking-provider key and explicitly reports `canMoveRealMoney: false` and `productionSupported: false`.

`GET /api/admin/bank/increase/status` is owner-only. It verifies the Voxel Vault admin session, then performs read-only sandbox requests for programs, accounts and entities. The response exposes counts and connectivity state only. It never returns the API key or provider records containing customer identity data.

`lib/banking/increase-onboarding-sandbox.js` adds the sandbox onboarding boundary. It can create an Increase-hosted Entity Onboarding Session, read only sanitized Entity validation state, simulate validation in sandbox, and create or reuse a sandbox Account plus Account Number after validation is explicitly `valid`. The setup response withholds raw account-number and routing-number details.

`GET/POST /api/admin/bank/increase/onboarding` is owner-only and no-store. Supported actions are sandbox-specific: create a hosted session, simulate a sandbox session submission, simulate a valid Entity, bootstrap a validated Entity into an Account and Account Number, or explicitly complete the sandbox setup by simulating validation before bootstrap. Every response reports `canMoveRealMoney: false`.

Galactic Trust reuses `vault_provider_account_bindings`, the existing trusted server-written provider identity table, rather than inventing a second account-ownership system. Migration `025_galactic_increase_account_bindings.sql` extends the table's provider allowlist from Dinari-only to Dinari plus Increase while preserving the existing row-level-security posture: authenticated browser users can read only their own row and have no client insert/update/delete policy. A provider Account also remains globally unique per provider/environment so one Increase Account cannot be silently assigned to two users.

After successful sandbox Account creation, the owner-only onboarding API writes an `increase` / `sandbox` binding using the authenticated Supabase user ID returned by server-side session verification. The stored provider validation marker is `SANDBOX_VALID_SIMULATION`, not `PASS`, so the test state cannot be confused with a real KYC/CIP/AML approval.

The `/bank` owner setup control requires both provider connectivity and a verified owner binding before it uncovers provider data. A pre-existing unbound Increase sandbox Account is deliberately ignored. In that case the owner is sent through owner-scoped hosted onboarding rather than inheriting a global test Account.

`GET /api/admin/bank/increase/dashboard`, `POST /api/admin/bank/increase/fund`, and `POST /api/admin/bank/increase/transfer` now fail closed when the signed-in owner has no verified Increase sandbox binding. When a binding exists, each route uses the exact stored Account ID. The dashboard returns only that Account; pretend-money funding resolves its Account Number from that Account; and pretend-money transfers use that Account as the source. The browser only receives a masked binding summary, never the full provider Entity or Account ID from binding storage.

Signed webhooks are processed idempotently and reconciliation provides a polling backstop. These provider-wide automation mechanisms do not authorize user ownership; the signed-in user's dashboard and actions remain scoped by the trusted binding table.

## External setup required for the live sandbox environment

1. Create an Increase account and obtain the **sandbox** API key from the Increase dashboard.
2. In Vercel, add the key as a server-only environment variable named `INCREASE_SANDBOX_API_KEY`.
3. Set `GALACTIC_INCREASE_SANDBOX_ENABLED=true` for the environment you want to test.
4. Ensure the Supabase migration workflow has its required repository secrets and apply pending migrations, including `024_galactic_increase_webhooks_reconciliation.sql` and `025_galactic_increase_account_bindings.sql`.
5. Redeploy after the Vercel environment variables are present.
6. Sign in to `/bank`. The owner-only setup control will verify the sandbox connection and the signed-in user's binding state before offering or completing hosted onboarding.

Do **not** paste the sandbox key, Supabase access token, database password, or other secrets into ChatGPT, GitHub issues, commits, screenshots, client-side code, or any `NEXT_PUBLIC_` variable.

## Sandbox onboarding sequence now implemented

1. Create an Increase-hosted Entity Onboarding Session for the selected sandbox Program.
2. Redirect the owner to Increase's hosted form; Galactic Trust does not receive the identity form fields.
3. Increase redirects back to `/bank` with the test Entity and session identifiers.
4. The owner explicitly completes sandbox setup. Because sandbox validations do not run automatically, Galactic Trust calls Increase's sandbox validation simulation with no issues and clearly labels that action as simulated, not real KYC approval.
5. Only after the provider reports the test Entity as active and `valid`, create or reuse a USD sandbox Account tied to the Entity and Program.
6. Create or reuse an active Account Number, while withholding raw account/routing details from the setup response.
7. Bind that test Entity/Account to the authenticated Supabase user through trusted server code. The binding is stored as provider `increase`, environment `sandbox`, with validation marker `SANDBOX_VALID_SIMULATION`.
8. Reload the dashboard from the exact Account referenced by the authenticated user's binding. Never fall back to another open sandbox Account.
9. Route inbound/outbound ACH simulations through that same bound Account while signed webhooks and reconciliation continue to track provider state.

## What remains before customer banking

This owner-scoped sandbox binding is an engineering identity boundary for test data. It is not yet a customer onboarding system and must not be reused as proof of production KYC approval.

A successful sandbox connection, simulated validation, or server-side test Account binding does not make Galactic Trust a bank, open production customer accounts, make deposits FDIC-insured through Galactic Trust, or authorize real money movement.

Before any customer-facing account opening or live transfer flow, the selected provider/bank must approve the program, customer eligibility and onboarding, KYC/CIP/AML and sanctions controls, account terms and disclosures, Regulation E/error-resolution handling, ACH/payment use cases and limits, card program, ledger/reconciliation process, deposit-insurance wording, privacy/security, complaints/disputes, incident response and production launch.

The hard locks in `lib/banking/regulated-launch.js` remain false until that production integration and evidence are reviewed in code. The reviewed production adapter remains a separate implementation and must never be enabled by changing the sandbox URL, reusing the sandbox key, or flipping an environment flag alone.
