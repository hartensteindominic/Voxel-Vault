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

The `/bank` owner experience includes a temporary sandbox setup control. It first checks the owner-only status/onboarding APIs. Unauthorized signed-in users do not see the control. When no sandbox Account exists, the owner can launch Increase-hosted onboarding. After Increase redirects back with the test `entity_id`, the owner can explicitly complete sandbox setup. Identity form fields stay on Increase's hosted page rather than being collected by Galactic Trust.

The existing dashboard reads provider-authoritative sandbox balances and transactions, ACH simulations use the sandbox Account Number, signed webhooks are processed idempotently, and reconciliation provides a polling backstop.

## Founder setup — the only external step required now

1. Create an Increase account and obtain the **sandbox** API key from the Increase dashboard.
2. In Vercel, add the key as a server-only environment variable named `INCREASE_SANDBOX_API_KEY`.
3. Set `GALACTIC_INCREASE_SANDBOX_ENABLED=true` for the environment you want to test.
4. Redeploy.
5. Sign in to `/bank`. The owner-only setup control will verify the sandbox connection and, when no sandbox Account exists, offer the hosted onboarding flow.

Do **not** paste the sandbox key into ChatGPT, GitHub issues, commits, screenshots, client-side code or a `NEXT_PUBLIC_` variable.

## Sandbox onboarding sequence now implemented

1. Create an Increase-hosted Entity Onboarding Session for the selected sandbox Program.
2. Redirect the owner to Increase's hosted form; Galactic Trust does not receive the identity form fields.
3. Increase redirects back to `/bank` with the test Entity and session identifiers.
4. The owner explicitly completes sandbox setup. Because sandbox validations do not run automatically, Galactic Trust calls Increase's sandbox validation simulation with no issues and clearly labels that action as simulated, not real KYC approval.
5. Only after the provider reports the test Entity as active and `valid`, create or reuse a USD sandbox Account tied to the Entity and Program.
6. Create or reuse an active Account Number, while withholding raw account/routing details from the setup response.
7. Reload the sandbox dashboard from Increase-authoritative balances and transactions.
8. Use existing inbound/outbound ACH simulations, webhook processing and reconciliation against the provider state.

## What remains before customer banking

A successful sandbox connection or simulated validation is engineering evidence only. It does not make Galactic Trust a bank, open production customer accounts, make deposits FDIC-insured through Galactic Trust, or authorize real money movement.

Before any customer-facing account opening or live transfer flow, the selected provider/bank must approve the program, customer eligibility and onboarding, KYC/CIP/AML and sanctions controls, account terms and disclosures, Regulation E/error-resolution handling, ACH/payment use cases and limits, card program, ledger/reconciliation process, deposit-insurance wording, privacy/security, complaints/disputes, incident response and production launch.

The hard locks in `lib/banking/regulated-launch.js` remain false until that production integration and evidence are reviewed in code. The reviewed production adapter remains a separate implementation and must never be enabled by changing the sandbox URL, reusing the sandbox key, or flipping an environment flag alone.
