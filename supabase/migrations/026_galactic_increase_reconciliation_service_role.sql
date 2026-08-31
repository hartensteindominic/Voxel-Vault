-- Galactic Trust Increase sandbox reconciliation storage hardening.
-- These tables contain sandbox-only event metadata and reconciliation checkpoints.
-- Browser roles remain denied; only the backend service role receives explicit access.

revoke all on table public.galactic_increase_webhook_events from anon, authenticated;
revoke all on table public.galactic_increase_reconciliation_state from anon, authenticated;

grant select, insert, update, delete on table public.galactic_increase_webhook_events to service_role;
grant select, insert, update, delete on table public.galactic_increase_reconciliation_state to service_role;

comment on table public.galactic_increase_webhook_events is
  'Service-role-only Increase sandbox Event ledger. Browser roles are denied; stores metadata/hash only and has no real-money authority.';

comment on table public.galactic_increase_reconciliation_state is
  'Service-role-only Increase sandbox reconciliation checkpoint. Browser roles are denied and production money movement remains outside this table.';
