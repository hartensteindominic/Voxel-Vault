import { NextResponse } from 'next/server';
import { hashIncreaseWebhookPayload, verifyIncreaseSandboxWebhookSignature } from '../../../../../lib/banking/increase-webhook-signature.js';
import { reconcileIncreaseSandbox, recordIncreaseSandboxEvent } from '../../../../../lib/banking/increase-reconciliation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const webhookId = request.headers.get('webhook-id');
  const webhookTimestamp = request.headers.get('webhook-timestamp');
  const webhookSignature = request.headers.get('webhook-signature');

  const verification = verifyIncreaseSandboxWebhookSignature({
    rawBody,
    webhookId,
    webhookTimestamp,
    webhookSignature,
    env: process.env,
  });
  if (verification.ok === false) {
    const status = verification.reason === 'not_configured' ? 503 : 401;
    return response({ received: false, error: 'Invalid Increase webhook.' }, status);
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return response({ received: false, error: 'Invalid Increase event payload.' }, 400);
  }

  if (!event || event.type !== 'event' || typeof event.id !== 'string' || event.id !== verification.webhookId) {
    return response({ received: false, error: 'Increase event identity mismatch.' }, 400);
  }

  let recorded;
  try {
    recorded = await recordIncreaseSandboxEvent(event, {
      source: 'webhook',
      webhookMessageId: verification.webhookId,
      payloadSha256: hashIncreaseWebhookPayload(rawBody),
    });
  } catch (error) {
    console.error('Galactic Trust Increase webhook persistence failed', {
      eventId: event.id,
      category: event.category,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return response({ received: false, error: 'Webhook persistence failed.' }, 503);
  }

  if (recorded.duplicate) {
    return response({ received: true, duplicate: true, environment: 'sandbox', canMoveRealMoney: false });
  }

  try {
    const reconciliation = await reconcileIncreaseSandbox({ eventIds: [recorded.eventId], trigger: 'webhook' });
    return response({
      received: true,
      duplicate: false,
      reconciled: true,
      environment: 'sandbox',
      canMoveRealMoney: false,
      reconciledAt: reconciliation.reconciledAt,
    });
  } catch (error) {
    // Increase does not retry failed sandbox webhooks. The durable Event row stays
    // marked failed and the owner reconciliation poll can backfill from /events.
    console.error('Galactic Trust Increase webhook reconciliation deferred', {
      eventId: event.id,
      category: event.category,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return response({
      received: true,
      duplicate: false,
      reconciled: false,
      backstopRequired: true,
      environment: 'sandbox',
      canMoveRealMoney: false,
    });
  }
}
