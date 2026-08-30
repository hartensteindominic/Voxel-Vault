# Galactic Trust · Increase sandbox webhooks + reconciliation

This integration is sandbox-only. Increase sandbox uses pretend money; nothing in this flow enables production banking or changes Galactic Trust's nonbank status.

## What happens automatically

When the authorized owner dashboard loads and the existing Increase sandbox configuration is enabled, Galactic Trust ensures an Increase sandbox Event Subscription exists for:

`https://www.voxelvault.io/api/bank/increase/webhook`

The subscription secret is derived server-side from the existing sandbox API key with HMAC key separation. It is never returned to the browser, stored in GitHub, or sent to Orbit.

Increase sends Event objects to the public webhook endpoint. The endpoint:

1. reads the raw request body;
2. verifies `webhook-id`, `webhook-timestamp`, and `webhook-signature` using HMAC-SHA256;
3. rejects timestamps outside a five-minute replay window;
4. requires the signed `webhook-id` to match the Event ID;
5. stores only minimal Event metadata plus a SHA-256 payload hash in Supabase;
6. uses the Increase Event ID as the idempotency key;
7. refreshes the authoritative sandbox account/balance/transaction snapshot;
8. marks the Event processed or failed without ever storing provider credentials or the raw webhook body.

The signature implementation follows Increase's Standard Webhooks guidance:

- https://www.increase.com/documentation/webhooks
- https://www.increase.com/documentation/api/event-subscriptions

## Missed-event backstop

Increase recommends polling the Events API as a backstop for data synchronization. Galactic Trust stores the Increase Events cursor and polls oldest-first from `/events` when the authorized owner dashboard loads or when the owner reconciliation endpoint is called.

Owner-only endpoint:

- `GET /api/admin/bank/increase/reconciliation` — inspect the latest reconciliation checkpoint and recent Event statuses.
- `POST /api/admin/bank/increase/reconciliation` — poll up to five Event pages and force a fresh sandbox reconciliation.

Increase keeps Events available for a limited window, so this cursor is persisted in Supabase rather than browser storage.

## Durable tables

Migration `024_galactic_increase_webhooks_reconciliation.sql` adds two service-role-only tables:

- `galactic_increase_webhook_events` — Event IDs/categories/statuses, provider timestamps, source, and payload hashes. No raw webhook payloads or API keys.
- `galactic_increase_reconciliation_state` — cursor, latest reconciliation timestamps, aggregate account/transaction counts, and aggregate sandbox balances.

RLS is enabled and `anon`/`authenticated` access is revoked. Server service credentials are required.

## Failure behavior

A verified Event is persisted before reconciliation. If the provider refresh fails, the Event remains durable and is marked failed. The webhook still acknowledges the signed sandbox Event so the owner backstop can recover it from the Events API. Increase documents that failed sandbox webhooks are not retried.

Production handling will require a separate reviewed adapter, production Event Subscription, independent secret-rotation procedure, queue/stream processing, operational alerting, and the existing regulated-launch approval gates. The sandbox code must not be converted to production by changing an origin or environment flag.
