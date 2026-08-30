-- Extend the existing trusted provider-account binding model to Galactic Trust's
-- Increase sandbox. Browser clients still have read-own access only; writes remain
-- service-role/server-side through the existing RLS posture from migration 014.

alter table public.vault_provider_account_bindings
  drop constraint if exists vault_provider_account_bindings_provider_check;

alter table public.vault_provider_account_bindings
  add constraint vault_provider_account_bindings_provider_check
  check (provider in ('dinari', 'increase'));

comment on table public.vault_provider_account_bindings is
  'Trusted server-written mapping from an authenticated Voxel Vault user to one provider Entity/Account per provider environment. Client writes are prohibited by RLS.';
