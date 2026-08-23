import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';

export const runtime = 'nodejs';
const ALLOWED = new Set(['submitted','shipped','delivered','cancelled','failed']);

function validSignature(raw: string, supplied: string | null, secret: string) {
  if (!supplied || !/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  const actual = Buffer.from(supplied, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  const secret = process.env.FULFILLMENT_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Fulfillment callback is not configured' }, { status: 503 });
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get('x-vault-signature'), secret)) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  try {
    const input = JSON.parse(raw);
    const orderId = String(input.orderId || '');
    const eventId = String(input.eventId || '');
    const status = String(input.status || '').toLowerCase();
    if (!/^[0-9a-f-]{36}$/i.test(orderId) || !eventId || eventId.length > 200 || !ALLOWED.has(status)) return NextResponse.json({ error: 'Invalid fulfillment event' }, { status: 400 });
    const messages: Record<string,string> = { submitted: 'Your order was accepted by the fulfillment partner.', shipped: 'Your package shipped.', delivered: 'Delivery confirmed. Your verified 3D twin is ready to claim.', cancelled: 'The physical order was cancelled.', failed: 'The fulfillment partner reported a problem. Support review is required.' };
    const db = getSupabaseAdmin();
    const { data, error } = await db.rpc('apply_fulfillment_event', { p_order_id: orderId, p_event_id: `fulfillment:${eventId}`, p_status: status, p_public_message: messages[status], p_tracking_number: input.trackingNumber || null, p_tracking_url: input.trackingUrl || null, p_carrier: input.carrier || null, p_metadata: { providerEventType: input.type || null } });
    if (error) throw error;
    return NextResponse.json({ received: true, ...data });
  } catch (error) {
    console.error('Fulfillment status callback failed', error);
    return NextResponse.json({ error: 'Fulfillment event rejected' }, { status: 409 });
  }
}
