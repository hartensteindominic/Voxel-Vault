import { NextResponse } from 'next/server';
import { decideControlAction } from '../../../../lib/voxelflip-control-actions';
import {
  sendWhatsAppText,
  whatsappCloudConfig,
  whatsappSenderAuthorized,
  whatsappWebhookSignatureValid,
} from '../../../../lib/whatsapp-cloud';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTROL_RE = /^(approve|skip):([0-9a-fA-F-]{36})$/;

function ok(data: any = { ok: true }) {
  return NextResponse.json(data, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode') || '';
  const token = url.searchParams.get('hub.verify_token') || '';
  const challenge = url.searchParams.get('hub.challenge') || '';
  const configured = whatsappCloudConfig().verifyToken;
  if (mode === 'subscribe' && configured && token === configured && challenge) {
    return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain', 'Cache-Control': 'no-store' } });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!whatsappWebhookSignatureValid(rawBody, request.headers.get('x-hub-signature-256'))) {
    return new Response('Invalid signature', { status: 401 });
  }

  let body: any = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return ok({ ok: true, ignored: 'no-user-message' });

  const sender = String(message?.from || '');
  if (!whatsappSenderAuthorized(sender)) {
    console.warn('Ignored WhatsApp control from an unauthorized sender.');
    return ok({ ok: true, ignored: 'unauthorized-sender' });
  }

  const payload = String(
    message?.interactive?.button_reply?.id ||
    message?.button?.payload ||
    ''
  ).trim();
  const match = payload.match(CONTROL_RE);
  if (!match) return ok({ ok: true, ignored: 'not-a-control-reply' });

  const decision = match[1] as 'approve' | 'skip';
  const id = match[2];
  try {
    const result = await decideControlAction({ id, decision, responderPhone: sender });
    let reply = '';
    if (result.accepted && decision === 'approve') {
      reply = '✅ APPROVED\nThe proposal is queued as approved. This WhatsApp tap is not a blockchain signature and cannot spend ETH by itself. The bounded executor is still required before execution.';
    } else if (result.accepted) {
      reply = '⏭️ SKIPPED\nThe proposal was rejected and will not be executed.';
    } else if (result.reason === 'expired') {
      reply = '⌛ EXPIRED\nThat proposal expired. Neural Core will create a fresh proposal if the conditions are still valid.';
    } else {
      reply = `ℹ️ NO CHANGE\nThat proposal is ${String(result.action?.status || result.reason || 'not available')}.`;
    }
    try { await sendWhatsAppText(sender, reply); } catch (error) { console.error('WhatsApp control acknowledgement failed', error); }
    return ok({ ok: true, accepted: result.accepted, decision, status: result.action?.status || null });
  } catch (error) {
    console.error('WhatsApp control decision failed', error);
    try { await sendWhatsAppText(sender, '⚠️ CONTROL ERROR\nYour tap was received, but the approval could not be stored safely. Nothing was executed.'); } catch {}
    return ok({ ok: false, safeFailure: true });
  }
}
