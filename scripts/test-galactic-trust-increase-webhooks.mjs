import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  deriveIncreaseSandboxWebhookSecret,
  verifyIncreaseSandboxWebhookSignature,
} from '../lib/banking/increase-webhook-signature.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const env = { INCREASE_SANDBOX_API_KEY: 'sandbox_key_test_only_123456789' };
const event = { id: 'event_test_123', type: 'event', category: 'transaction.created', associated_object_type: 'transaction', associated_object_id: 'transaction_test_123', created_at: '2026-08-30T00:00:00Z' };
const rawBody = JSON.stringify(event);
const timestamp = 1_800_000_000;
const secret = deriveIncreaseSandboxWebhookSecret(env);
const signature = `v1,${createHmac('sha256', secret).update(`${event.id}.${timestamp}.${rawBody}`, 'utf8').digest('base64')}`;

assert.equal(verifyIncreaseSandboxWebhookSignature({ rawBody, webhookId: event.id, webhookTimestamp: String(timestamp), webhookSignature: signature, env, nowSeconds: timestamp + 30 }).ok, true);
assert.equal(verifyIncreaseSandboxWebhookSignature({ rawBody: `${rawBody} `, webhookId: event.id, webhookTimestamp: String(timestamp), webhookSignature: signature, env, nowSeconds: timestamp + 30 }).ok, false, 'tampering must invalidate the signature');
assert.equal(verifyIncreaseSandboxWebhookSignature({ rawBody, webhookId: event.id, webhookTimestamp: String(timestamp), webhookSignature: signature, env, nowSeconds: timestamp + 301 }).ok, false, 'stale webhooks must be rejected');

const webhookRoute = await read('app/api/bank/increase/webhook/route.ts');
const reconciliationRoute = await read('app/api/admin/bank/increase/reconciliation/route.ts');
const reconciliation = await read('lib/banking/increase-reconciliation.ts');
const subscription = await read('lib/banking/increase-webhook-subscription.js');
const sandbox = await read('lib/banking/increase-sandbox.js');
const migration = await read('supabase/migrations/024_galactic_increase_webhooks_reconciliation.sql');

assert.match(webhookRoute, /const rawBody = await request\.text\(\)/);
assert.match(webhookRoute, /event\.id !== verification\.webhookId/);
assert.match(webhookRoute, /hashIncreaseWebhookPayload\(rawBody\)/);
assert.match(webhookRoute, /reconcileIncreaseSandbox/);
assert.match(webhookRoute, /canMoveRealMoney: false/);
assert.doesNotMatch(webhookRoute, /INCREASE_SANDBOX_API_KEY/);

assert.match(reconciliationRoute, /requireGalacticTrustAdmin/, 'reconciliation controls must be Galactic Trust owner-authenticated');
assert.match(reconciliationRoute, /private, no-store, max-age=0/);
assert.match(reconciliationRoute, /pollIncreaseSandboxEvents/);
assert.match(subscription, /\/event_subscriptions/);
assert.match(subscription, /shared_secret: secret/);
assert.doesNotMatch(subscription, /api\.increase\.com/);

assert.match(reconciliation, /galactic_increase_webhook_events/);
assert.match(reconciliation, /galactic_increase_reconciliation_state/);
assert.match(reconciliation, /event_cursor/);
assert.doesNotMatch(reconciliation, /raw_body|raw_payload|payload_json/i);
assert.match(migration, /event_id text primary key/);
assert.match(migration, /enable row level security/g);
assert.match(migration, /payload_sha256/);
assert.match(sandbox, /https:\/\/sandbox\.increase\.com/);
assert.doesNotMatch(sandbox, /https:\/\/api\.increase\.com/);

console.log('Galactic Trust Increase webhook boundary passed.');
