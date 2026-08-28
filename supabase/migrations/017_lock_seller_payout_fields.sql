-- Seller payout routing is security-sensitive. A normal authenticated user must not
-- be able to self-certify Stripe account IDs or charges/payout readiness flags that
-- server checkout code uses to route marketplace money.
--
-- Seller onboarding should write these fields only through a trusted server/service
-- role after Stripe Connect account state has been verified directly with Stripe.

drop policy if exists "user manages own seller account" on public.seller_accounts;
drop policy if exists "user updates own seller account" on public.seller_accounts;

-- Keep read access to the seller's own account record from 001_marketplace.sql.
-- No INSERT/UPDATE policy is intentionally created for authenticated users.
-- The service role bypasses RLS and remains the only supported writer.
