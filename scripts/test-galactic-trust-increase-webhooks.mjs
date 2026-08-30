import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import {
  deriveIncreaseSandboxWebhookSecret,
  verifyIncreaseSandboxWebhookSignature,
} from '../lib/banking/increase-webhook-signature.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const webhookRoute = read('app/api/bank/increase/webhook/route.ts');
const reconciliationRoute = read('app/api/admin/bank/increase/reconciliation/route.ts');
const dashboardRoute = read('app/api/admin/bank/increase/dashboard/route.ts');
const subscription = read('lib/banking/increase-webhook-subscription.js');
const signature = read('lib/banking/increase-webhook-signature.js');
const reconciliation = read('lib/banking/increase-reconciliation.ts');
const migration = read('supabase/migrations/024_galactic_increase_webhooks_reconciliation.sql');
const sandbox = read('lib/banking/increase-sandbox.js');

const env = { INCREASE_SANDBOX_API_KEY: 'sandbox_key_test_only_123456789' };
const event = {
  id: 'event_test_123',
  type: 'event',
  category: 'transaction.created',
  associated_object_type: 'transaction',
  associated_object_id: 'transaction_test_123',
  created_at: '2026-08-30T00:00:00Z',
};
const rawBody = JSON.stringify(event);
const timestamp = 1_800_000_000;
const secret = deriveIncreaseSandboxWebhookSecret(env);
const signedPayload = `${event.id}.${timestamp}.${rawBody}`;
const webhookSignature = `v1,${createHmac('sha256', secret).update(signedPayload, 'utf8').digest('base64')}`;

const valid = verifyIncreaseSandboxWebhookSignature({
  rawBody,
  webhookId: event.id,
  webhookTimestamp: String(timestamp),
  webhookSignature,
  env,
  nowSeconds: timestamp + 30,
});
assert.equal(valid.ok, true, 'valid Increase Standard Webhooks signature must verify');

const tampered = verifyIncreaseSandboxWebhookSignature({
  rawBody: `${rawBody} `,
  webhookId: event.id,
  webhookTimestamp: String(timestamp),
  webhookSignature,
  env,
  nowSeconds: timestamp + 30,
});
assert.equal(tampered.ok, false, 'raw-body tampering must invalidate the signature');

const stale = verifyIncreaseSandboxWebhookSignature({
  rawBody,
  webhookId: event.id,
  webhookTimestamp: String(timestamp),
  webhookSignature,
  env,
  nowSeconds: timestamp + 301,
});
assert.equal(stale.ok, false, 'webhooks older than five minutes must be rejected');

assert.match(signature, /webhook-id|webhookId/, 'signature verifier must bind the webhook ID');
assert.match(signature, /webhook-timestamp|webhookTimestamp/, 'signature verifier must bind the webhook timestamp');
assert.match(signature, /webhook-signature|webhookSignature/, 'signature verifier must bind the webhook signature');
assert.match(signature, /createHmac\('sha256'/, 'Increase webhook verification must use HMAC-SHA256');
assert.match(signature, /timingSafeEqual/, 'signature comparison must be constant-time');
assert.match(signature, /INCREASE_WEBHOOK_MAX_AGE_SECONDS = 300/, 'replay window must be five minutes');
assert.match(signature, /INCREASE_WEBHOOK_MAX_BODY_BYTES = 64 \* 1024/, 'webhook bodies must be size bounded');
assert.doesNotMatch(signature, /NEXT_PUBLIC_INCREASE/i, 'webhook signing material must never come from browser variables');

assert.match(webhookRoute, /const rawBody = await request\.text\(\)/, 'webhook route must verify the raw request body');
assert.match(webhookRoute, /request\.headers\.get\('webhook-id'\)/, 'webhook route must read Standard Webhooks ID header');
assert.match(webhookRoute, /request\.headers\.get\('webhook-timestamp'\)/, 'webhook route must read Standard Webhooks timestamp header');
assert.match(webhookRoute, /request\.headers\.get\('webhook-signature'\)/, 'webhook route must read Standard Webhooks signature header');
assert.match(webhookRoute, /event\.id !== verification\.webhookId/, 'signed webhook ID must equal the Event body ID');
assert.match(webhookRoute, /hashIncreaseWebhookPayload\(rawBody\)/, 'durable Event ledger should store a payload hash rather than raw provider payload');
assert.match(webhookRoute, /reconcileIncreaseSandbox/, 'verified webhooks must trigger automatic reconciliation');
assert.match(webhookRoute, /canMoveRealMoney: false/, 'webhook flow must preserve sandbox no-real-money boundary');
assert.doesNotMatch(webhookRoute, /INCREASE_SANDBOX_API_KEY/, 'public webhook route must not directly read or expose the provider key');

assert.match(subscription, /\/event_subscriptions/, 'sandbox integration must create an Increase Event Subscription');
assert.match(subscription, /shared_secret: secret/, 'Event Subscription must use the server-derived signing secret');
assert.match(subscription, /idempotencyKey/, 'Event Subscription creation must be idempotent');
assert.match(subscription, /status: 'active'/, 'Event Subscription must be explicitly active');
assert.match(subscription, /https:/, 'webhook callback must require HTTPS');
assert.doesNotMatch(subscription, /api\.increase\.com/, 'webhook subscription helper must not contain the production Increase origin');

assert.match(reconciliation, /galactic_increase_webhook_events/, 'Event metadata must persist durably');
assert.match(reconciliation, /galactic_increase_reconciliation_state/, 'reconciliation cursor/state must persist durably');
assert.match(reconciliation, /order_by\.field.*created_at/s, 'Events backstop must poll chronologically');
assert.match(reconciliation, /order_by\.direction.*ascending/s, 'Events backstop must poll oldest-first');
assert.match(reconciliation, /event_cursor/, 'Events backstop must persist Increase cursor');
assert.match(reconciliation, /getIncreaseSandboxDashboard/, 'reconciliation must refresh authoritative provider sandbox balances/transactions');
assert.match(reconciliation, /maxPages.*Math\.min\(5/, 'backstop polling must be bounded per request');
assert.doesNotMatch(reconciliation, /raw_body|raw_payload|payload_json/i, 'reconciliation store must not persist raw webhook payloads');

assert.match(migration, /event_id text primary key/, 'provider Event ID must enforce idempotency at the database layer');
assert.match(migration, /enable row level security/g, 'webhook/reconciliation tables must have RLS enabled');
assert.match(migration, /revoke all on table public\.galactic_increase_webhook_events from anon, authenticated/, 'Event ledger must be service-role-only');
assert.match(migration, /revoke all on table public\.galactic_increase_reconciliation_state from anon, authenticated/, 'reconciliation state must be service-role-only');
assert.match(migration, /payload_sha256/, 'Event ledger must retain only a payload fingerprint for auditability');

assert.match(reconciliationRoute, /requireVoxelVaultAdmin/, 'reconciliation controls must be owner-authenticated');
assert.match(reconciliationRoute, /private, no-store, max-age=0/, 'owner reconciliation status must never be publicly cached');
assert.match(reconciliationRoute, /pollIncreaseSandboxEvents/, 'owner route must expose the missed-Event backstop');
assert.doesNotMatch(reconciliationRoute, /process\.env\.INCREASE_SANDBOX_API_KEY/, 'owner route must not directly read or return the sandbox key');

assert.match(dashboardRoute, /ensureIncreaseSandboxWebhookSubscription/, 'authorized dashboard load must ensure the webhook subscription exists');
assert.match(dashboardRoute, /pollIncreaseSandboxEvents/, 'authorized dashboard load must backstop missed Events');
assert.match(sandbox, /https:\/\/sandbox\.increase\.com/, 'all provider calls remain pinned to Increase sandbox');
assert.doesNotMatch(sandbox, /https:\/\/api\.increase\.com/, 'production Increase origin must remain absent');

console.log('Galactic Trust Increase webhook checks passed: signed Standard Webhooks verification, idempotent Event persistence, owner-only backstop polling, durable reconciliation and sandbox-only provider routing are enforced.');
