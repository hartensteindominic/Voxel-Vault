# WorkflowForge

Production SaaS for small-business marketing operations.

## Stack
- Next.js App Router + TypeScript
- Supabase Auth + Postgres + Row Level Security
- OpenAI Responses API, server-side only
- Stripe recurring subscriptions + signed webhooks
- Vercel deployment

## Local setup

```bash
cd workflowforge
npm install
cp .env.example .env.local
npm run dev
```

Never commit `.env.local` or any secret.

## Supabase
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable Email OTP/passwordless auth.
4. Add `http://localhost:3000/auth/callback` and your production `/auth/callback` URL to Supabase Auth redirect URLs.
5. Copy the project URL, anon key, and **service-role key** into the matching environment variables. The service-role key is server-only and must never be exposed to the browser.

## OpenAI
Set `OPENAI_API_KEY` only as a server-side environment variable. The browser never receives it.

## Stripe
1. Create recurring Pro and Studio prices.
2. Put their price IDs in `STRIPE_PRO_PRICE_ID` and `STRIPE_STUDIO_PRICE_ID`.
3. Configure a webhook at `/api/stripe/webhook`.
4. Subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
5. Set the signing secret as `STRIPE_WEBHOOK_SECRET`.

The webhook uses the Supabase service-role key because Stripe has no authenticated browser user session. It verifies Stripe's signature before changing subscription state.

## Vercel
Import the repository and set the root directory to `workflowforge`. Add every variable from `.env.example` as an encrypted environment variable for Production and Preview as appropriate. Set `NEXT_PUBLIC_APP_URL` to the deployed HTTPS URL for Production.

## Product behavior
- Free: 3 AI generations/month
- Pro: 100 generations/month
- Studio: 500 generations/month
- Business profiles and generated packs persist in Postgres.
- Dashboard routes require an authenticated Supabase session.
- AI keys and Stripe secrets remain server-side.

## Launch checklist
- [ ] Apply the Supabase schema
- [ ] Configure Supabase auth redirects
- [ ] Configure OpenAI key
- [ ] Create Stripe prices
- [ ] Configure Stripe webhook and signing secret
- [ ] Configure Vercel environment variables
- [ ] Run `npm run build`
- [ ] Test signup, generation, checkout, webhook, cancellation, and plan limits
- [ ] Add production Privacy Policy and Terms of Service
- [ ] Add abuse/rate limiting and transactional email before broad public launch

This repository contains production-oriented application code, but revenue is not guaranteed. External service configuration and launch testing are required before accepting real customers.