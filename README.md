# Galactic Trust

Galactic Trust is a fintech dashboard and regulated-provider integration shell. It is designed to look and behave like a modern digital-banking product without presenting prototype balances, crypto holdings, or demo transactions as real customer assets.

The repository runs in **demo banking and demo crypto mode by default**. Demo balances, transfers, cards, crypto prices, buys, sells, and activity are simulated. Real money or crypto activity remains fail-closed until approved provider programs are configured and server-side live switches are explicitly enabled.

## Product experience

- Galaxy-themed consumer banking dashboard matching the Galactic Trust reference design.
- Transfer, add-money, card controls, accounts, recent activity, cards, spending insights, rewards, and responsive mobile behavior.
- Guarded BTC, ETH, and USDC buy/sell interface. Demo mode clearly simulates orders; live trading requires a separately approved provider program.
- Bottom-right **Orbit** support chatbot for transfers, cards, crypto, security, privacy, rewards, and product status.
- Security & Privacy dashboard panel plus `/privacy` Privacy Center.

## Banking architecture

`Galactic Trust UI -> Galactic banking API -> private partner gateway -> regulated banking platform / partner bank`

The server-side banking adapter lives in `lib/banking.ts`. It intentionally does not hard-code a bank vendor so Galactic Trust can integrate with an approved provider through a private gateway after commercial, compliance, and technical onboarding are complete.

### Banking endpoints

- `GET /api/banking/status` - public integration status and disclosure
- `GET /api/banking/summary` - authenticated account summary; demo data in demo mode
- `POST /api/banking/transfers` - simulated in demo; partner gateway in approved live mode
- `POST /api/banking/cards/freeze` - simulated in demo; partner gateway in approved live mode

## Crypto architecture

`Galactic Trust crypto UI -> /api/crypto/* -> private crypto gateway -> approved trading/custody provider`

- `GET /api/crypto/status` - trading mode, provider disclosure, and demo portfolio
- `POST /api/crypto/orders` - simulated buy/sell in demo; approved provider gateway in live mode
- `CRYPTO_MODE=demo` is the default.
- Real crypto orders remain disabled unless `CRYPTO_ENABLE_LIVE_TRADING=true` is set server-side and all required provider configuration exists.
- The client never receives the provider API key or program credentials.
- Crypto UI states that prices can fall and does not promise returns.

## Orbit assistant

`POST /api/assistant` provides a privacy-aware support assistant for common Galactic Trust questions. It is intentionally limited to product support and general explanations.

Orbit:

- does not ask users for passwords, PINs, CVVs, recovery codes, or one-time authentication codes;
- does not provide guaranteed-return claims or personalized crypto recommendations;
- has same-origin request checks, input limits, no-store responses, and a basic server-side rate limit;
- does not intentionally persist chat messages to an application database in the current implementation.

## Security & privacy controls

- Banking defaults to demo unless partner mode is explicitly enabled.
- Crypto defaults to demo unless partner mode is explicitly enabled.
- Real banking writes require `BANKING_ENABLE_LIVE_WRITES=true`.
- Real crypto trading requires `CRYPTO_ENABLE_LIVE_TRADING=true`.
- Partner banking requires signed short-lived authentication headers.
- Money movement and crypto order endpoints validate JSON, reject untrusted browser origins, and use idempotency protection where appropriate.
- Full card PAN, CVV, PIN, and equivalent sensitive card-authentication data are not exposed by the product UI.
- Provider API keys and auth secrets are server-only.
- Browser responses include a restrictive Content Security Policy, anti-framing, no-sniff, referrer, permissions, cross-origin, and HSTS protections.
- `/privacy` explains the current privacy posture and the additional policy work required before real customer onboarding.
- Any FDIC, partner-bank, crypto-provider, APR, fee, account-eligibility, custody, insurance, or consumer-rights language must match the actual approved live programs before public launch.

## Partner environment variables

```bash
BANKING_MODE=demo
CRYPTO_MODE=demo

# Banking - configure only after a real banking program is approved.
# BANKING_PROVIDER_NAME=Approved Banking Platform
# BANKING_PARTNER_BANK_NAME=Approved FDIC-Insured Bank
# BANKING_PARTNER_DISCLOSURE=Approved program disclosure text
# BANKING_GATEWAY_BASE_URL=https://private-banking-gateway.example.com
# BANKING_GATEWAY_API_KEY=server-side-secret-only
# BANKING_PROGRAM_ID=program-id
# BANKING_AUTH_GATEWAY_SECRET=server-side-signing-secret
# BANKING_ENABLE_LIVE_WRITES=false

# Crypto - configure only after a real provider program is approved.
# CRYPTO_PROVIDER_NAME=Approved Crypto Provider
# CRYPTO_PARTNER_DISCLOSURE=Approved crypto disclosure text
# CRYPTO_GATEWAY_BASE_URL=https://private-crypto-gateway.example.com
# CRYPTO_GATEWAY_API_KEY=server-side-secret-only
# CRYPTO_PROGRAM_ID=program-id
# CRYPTO_ENABLE_LIVE_TRADING=false
```

## Revenue direction

The intended regulated-fintech business model is a mix of card interchange/revenue share, deposit economics through an approved banking partner program, optional premium membership, merchant-funded rewards, and additional regulated products when eligible. A future approved crypto program could add contracted trading/revenue-share economics. Revenue is not guaranteed and depends on partner agreements, activity, fraud/credit losses where applicable, compliance, support, provider/network fees, and customer acquisition economics.

## Existing x402 licensing routes

The prior Galactic x402 licensing service remains separate from banking and consumer crypto trading:

- `GET /api/licenses/catalog`
- `POST /api/licenses/use`
- `GET /api/paylink`
- `GET /api/agent/manifest`
- `GET /api/agent/openapi`
- `GET /api/agent/health`

## Run

```bash
npm install
npm run typecheck
npm run test:safety
npm run build
npm run dev
```

Deploy the Next.js app to a server-capable host such as Vercel. GitHub Pages can show a static demo preview, but banking, crypto, Orbit, and x402 API behavior require the Next.js server deployment.
