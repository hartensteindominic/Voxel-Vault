# Galactic Trust — Increase sandbox integration

Status: **sandbox candidate only — no production banking relationship is implied**.

Galactic Trust is evaluating Increase as the first banking-infrastructure sandbox because its public API exposes accounts, account numbers, transactions, ACH, real-time payments, cards, entities, onboarding sessions, programs and webhooks, and it provides a sandbox environment where no real money moves.

Official references:

- https://increase.com/documentation/sandbox
- https://increase.com/documentation/api
- https://increase.com/documentation/entities
- https://increase.com/terms

## What is wired in this repository

`lib/banking/increase-sandbox.js` is deliberately pinned to `https://sandbox.increase.com` and accepts only the server-only `INCREASE_SANDBOX_API_KEY`. It never falls back to the generic production banking-provider key and explicitly reports `canMoveRealMoney: false` and `productionSupported: false`.

`GET /api/admin/bank/increase/status` is owner-only. It verifies the Voxel Vault admin session, then performs read-only sandbox requests for programs, accounts and entities. The response exposes counts and connectivity state only. It never returns the API key or provider records containing customer identity data.

The owner Integrations Center also tracks whether the sandbox key and explicit enable switch are configured.

## Founder setup — the only external step required now

1. Create an Increase account and obtain the **sandbox** API key from the Increase dashboard.
2. In Vercel, add the key as a server-only environment variable named `INCREASE_SANDBOX_API_KEY`.
3. Set `GALACTIC_INCREASE_SANDBOX_ENABLED=true` for the environment you want to test.
4. Redeploy.
5. Sign in to the owner Integrations Center and call the owner-only Increase status endpoint to verify the connection.

Do **not** paste the sandbox key into ChatGPT, GitHub issues, commits, screenshots, client-side code or a `NEXT_PUBLIC_` variable.

## What remains before customer banking

A successful sandbox connection is engineering evidence only. It does not make Galactic Trust a bank, open customer accounts, make deposits FDIC-insured through Galactic Trust, or authorize real money movement.

Before any customer-facing account opening or live transfer flow, the selected provider/bank must approve the program, customer eligibility and onboarding, KYC/CIP/AML and sanctions controls, account terms and disclosures, Regulation E/error-resolution handling, ACH/payment use cases and limits, card program, ledger/reconciliation process, deposit-insurance wording, privacy/security, complaints/disputes, incident response and production launch.

The hard locks in `lib/banking/regulated-launch.js` remain false until that production integration and evidence are reviewed in code.

## Next implementation after the sandbox key is connected

Once the read-only probe succeeds, build the sandbox customer journey in this order:

1. Provider-hosted or tokenized onboarding session for a test Entity.
2. Provider-confirmed Entity validation state.
3. Sandbox Account creation tied to that Entity and Program.
4. Provider-authoritative balance and transaction reads.
5. Sandbox account-number and ACH simulations.
6. Webhook signature verification and idempotent event processing.
7. Reconciliation records that compare provider account/transaction state to the Galactic Trust application ledger.
8. Only after formal production approval: a separate reviewed production adapter. Never convert the sandbox adapter into production by changing a URL or environment flag.
