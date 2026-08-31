import { createHash } from 'node:crypto';
import { getIncreaseSandboxConfig, increaseSandboxRequest } from './increase-sandbox.js';
import { deriveIncreaseSandboxWebhookSecret } from './increase-webhook-signature.js';

function listData(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
}

export function getIncreaseSandboxWebhookUrl(env = process.env) {
  const base = String(env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_SITE_URL || 'https://www.voxelvault.io').trim();
  let url;
  try {
    url = new URL('/api/bank/increase/webhook', base);
  } catch {
    throw new Error('Galactic Trust public URL is invalid for Increase sandbox webhooks.');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Increase sandbox webhook URL must use HTTPS.');
  }
  url.search = '';
  url.hash = '';
  return url.toString();
}

function subscriptionIdempotencyKey(webhookUrl, secret) {
  const fingerprint = createHash('sha256').update(`${webhookUrl}\n${secret}`, 'utf8').digest('hex').slice(0, 16);
  return `galactic-trust-increase-sandbox-webhook-v1-${fingerprint}`;
}

export async function ensureIncreaseSandboxWebhookSubscription(env = process.env) {
  const config = getIncreaseSandboxConfig(env);
  if (!config.enabled || !config.credentialsConfigured) {
    return {
      configured: false,
      active: false,
      environment: 'sandbox',
      canMoveRealMoney: false,
      reason: 'sandbox_not_configured',
      status: 'not-configured',
    };
  }

  let webhookUrl;
  let secret;
  try {
    webhookUrl = getIncreaseSandboxWebhookUrl(env);
    secret = deriveIncreaseSandboxWebhookSecret(env);
  } catch {
    return {
      configured: false,
      active: false,
      environment: 'sandbox',
      canMoveRealMoney: false,
      reason: 'webhook_configuration_unavailable',
      status: 'unavailable',
    };
  }

  try {
    const idempotencyKey = subscriptionIdempotencyKey(webhookUrl, secret);
    const existingPayload = await increaseSandboxRequest(`/event_subscriptions?idempotency_key=${encodeURIComponent(idempotencyKey)}&limit=10`, {}, env);
    let subscription = listData(existingPayload)[0] || null;

    if (!subscription) {
      subscription = await increaseSandboxRequest('/event_subscriptions', {
        method: 'POST',
        idempotencyKey,
        body: {
          url: webhookUrl,
          shared_secret: secret,
          status: 'active',
        },
      }, env);
    } else if (subscription.status !== 'active') {
      subscription = await increaseSandboxRequest(`/event_subscriptions/${encodeURIComponent(subscription.id)}`, {
        method: 'PATCH',
        body: { status: 'active' },
      }, env);
    }

    return {
      configured: true,
      active: subscription?.status === 'active',
      environment: 'sandbox',
      canMoveRealMoney: false,
      id: String(subscription?.id || ''),
      status: String(subscription?.status || 'unknown'),
      url: webhookUrl,
    };
  } catch {
    return {
      configured: false,
      active: false,
      environment: 'sandbox',
      canMoveRealMoney: false,
      reason: 'event_subscription_unavailable',
      status: 'unavailable',
      url: webhookUrl,
    };
  }
}
