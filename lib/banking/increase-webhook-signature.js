import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const INCREASE_WEBHOOK_MAX_AGE_SECONDS = 300;
export const INCREASE_WEBHOOK_MAX_BODY_BYTES = 64 * 1024;
const WEBHOOK_SECRET_CONTEXT = 'galactic-trust/increase-sandbox/webhook/v1';

function sandboxApiKey(env = process.env) {
  return String(env.INCREASE_SANDBOX_API_KEY || '').trim();
}

export function deriveIncreaseSandboxWebhookSecret(env = process.env) {
  const apiKey = sandboxApiKey(env);
  if (!apiKey) throw new Error('Increase sandbox webhook verification is not configured.');
  return createHmac('sha256', apiKey).update(WEBHOOK_SECRET_CONTEXT).digest('base64url');
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (!a.length || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function hashIncreaseWebhookPayload(rawBody) {
  return createHash('sha256').update(String(rawBody || ''), 'utf8').digest('hex');
}

export function verifyIncreaseSandboxWebhookSignature({
  rawBody,
  webhookId,
  webhookTimestamp,
  webhookSignature,
  env = process.env,
  nowSeconds = Math.floor(Date.now() / 1000),
} = {}) {
  const body = String(rawBody || '');
  if (!body || Buffer.byteLength(body, 'utf8') > INCREASE_WEBHOOK_MAX_BODY_BYTES) {
    return { ok: false, reason: 'invalid_body' };
  }

  const id = String(webhookId || '').trim();
  const timestampText = String(webhookTimestamp || '').trim();
  const signatures = String(webhookSignature || '').trim();
  if (!id || !timestampText || !signatures) return { ok: false, reason: 'missing_headers' };

  const timestamp = Number(timestampText);
  if (!Number.isInteger(timestamp)) return { ok: false, reason: 'invalid_timestamp' };
  if (Math.abs(Number(nowSeconds) - timestamp) > INCREASE_WEBHOOK_MAX_AGE_SECONDS) {
    return { ok: false, reason: 'stale_timestamp' };
  }

  let secret;
  try {
    secret = deriveIncreaseSandboxWebhookSecret(env);
  } catch {
    return { ok: false, reason: 'not_configured' };
  }

  const signedPayload = `${id}.${timestampText}.${body}`;
  const expected = `v1,${createHmac('sha256', secret).update(signedPayload, 'utf8').digest('base64')}`;
  const verified = signatures.split(/\s+/).filter(Boolean).some((candidate) => constantTimeEqual(candidate, expected));
  if (!verified) return { ok: false, reason: 'invalid_signature' };

  return { ok: true, webhookId: id, timestamp };
}
