# Galactic Trust regulated banking launch

## Current status

Galactic Trust is a financial technology product and **is not a bank**. The public dashboard remains a simulated experience. It does not currently accept or hold real customer deposits, issue a live debit card, originate real ACH transfers, or execute real crypto trades.

The repository intentionally fails closed. `LIVE_BANKING_IMPLEMENTATION_READY` and `LIVE_CRYPTO_IMPLEMENTATION_READY` remain `false` in `lib/banking/regulated-launch.js`. Environment variables, screenshots, admin toggles, or founder approval cannot turn a banking program live by themselves.

## Legitimate launch model

The practical U.S. launch path is a sponsor-bank / embedded-banking program in which:

1. an actual regulated bank provides the deposit account and approved banking services;
2. the bank and/or its approved platform controls or oversees KYC/CIP, AML/sanctions, transaction limits, account terms, complaints, fraud, and other required compliance functions;
3. Galactic Trust provides the customer experience and software integration;
4. bank-authoritative account, balance, transaction, and settlement records are reconciled against the Galactic Trust UI;
5. public disclosures name the real bank and describe deposit-insurance eligibility only in language approved for that exact program.

Do not market Galactic Trust itself as FDIC insured. A nonbank fintech is not an FDIC-insured institution.

## Required launch gates

The code tracks these gates:

- executed sponsor-bank program agreement;
- bank/program compliance approval;
- KYC, CIP, AML and sanctions workflow approval;
- approved account agreement, fee schedule and opening disclosures;
- Regulation E disclosures, unauthorized-transfer handling and error resolution;
- approved ACH / money-movement rails, limits, returns and settlement states;
- approved debit-card program, cardholder agreement and dispute controls;
- bank-authoritative ledger mapping and daily reconciliation;
- approved deposit-insurance / nonbank disclosures;
- privacy, security and vendor-risk approval;
- complaint, dispute and support procedures;
- incident response and business continuity;
- end-to-end sandbox certification and written production acceptance.

Every gate needs external evidence from the actual authority listed in `lib/banking/regulated-launch.js`.

## Provider selection

Choose a platform only after confirming the consumer use case, geography, expected transaction volume, account model, cards, ACH/RTP/FedNow needs, KYC ownership, compliance responsibilities, pricing, minimums, reserve requirements, program-management responsibilities and sponsor-bank fit.

Examples of current embedded-banking platforms include Synctera, Treasury Prime, Unit and Increase. They are examples for diligence, not claims that Galactic Trust has contracted with any of them. Do not put a provider or bank name into public marketing until an executed agreement and approved disclosure package exist.

## Engineering sequence after partner selection

### 1. Server-only provider adapter

Create a provider-specific adapter under `lib/banking/providers/<provider>/` using server-only credentials. Never expose provider API keys with `NEXT_PUBLIC_` variables.

The adapter should cover at minimum:

- customer / applicant creation;
- identity and compliance status retrieval;
- account creation and lifecycle status;
- bank-authoritative balances and transactions;
- ACH or other approved money movement;
- card issuance and card controls when approved;
- statements and account documents;
- disputes / errors if the provider API supports them;
- webhooks with signature verification and replay protection.

### 2. Provider-authoritative state

The browser must never create a "successful" transfer by decrementing local state when live mode is active. A live action should display pending only after the server/provider accepts it, then transition according to provider-authoritative webhook or reconciliation state.

### 3. Idempotency and reconciliation

All money-changing requests need an idempotency key. Persist provider object IDs and immutable event IDs. Reconcile accounts and transfers against the bank/platform every day and create an operations exception queue for mismatches.

### 4. Customer protection

Before launch, implement the bank-approved versions of:

- initial account and EFT disclosures;
- fees and transaction limits;
- periodic statements / transaction records;
- unauthorized-transfer and error-resolution intake;
- lost/stolen card workflow;
- complaint support and escalation;
- privacy notice and data-rights process;
- security and incident communications.

### 5. Controlled production pilot

Launch to a restricted allowlist first. Use low transaction limits, manual review, daily reconciliation and an immediate program pause control. Do not widen access until the sponsor bank has approved the pilot results.

## Crypto stays separate

A banking relationship does not automatically authorize crypto brokerage, exchange or custody. Keep the current BTC/ETH/USDC panel simulated until a separately approved trading/custody provider, disclosures, eligibility rules and jurisdiction analysis are in place.

## Public disclosure rule

Until a sponsor-bank program is approved, the public product should say:

> Galactic Trust is a financial technology product, not a bank. Galactic Trust does not currently accept or hold real customer deposits.

After an approved program exists, replace this only with sponsor-bank-approved wording that clearly identifies the actual bank and accurately describes any deposit-insurance eligibility.

## Official references used for the launch plan

- FDIC — bank arrangements with third parties to deliver deposit products: https://www.fdic.gov/news/financial-institution-letters/2024/agencies-issue-statement-bank-arrangements-third-parties
- FDIC — official signs, advertising and deposit-insurance misrepresentation rules: https://www.fdic.gov/news/financial-institution-letters/2023/fil23065.html
- CFPB — Regulation E / Electronic Fund Transfers: https://www.consumerfinance.gov/rules-policy/regulations/1005/
- FinCEN — Money Services Business registration: https://www.fincen.gov/resources/money-services-business-msb-registration
- FTC — Safeguards Rule: https://www.ftc.gov/legal-library/browse/rules/safeguards-rule

These references are product/compliance planning inputs, not legal advice. Exact licensing, registration and compliance responsibilities depend on the final funds flow, partner contracts, jurisdictions and services offered.
