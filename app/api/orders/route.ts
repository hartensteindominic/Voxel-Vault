import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const db = getSupabaseAdmin();
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id');
    let query = db.from('physical_orders').select('id,catalog_id,catalog_key,stripe_checkout_session_id,currency,physical_amount_cents,nft_amount_cents,shipping_amount_cents,tax_amount_cents,total_amount_cents,order_status,fulfillment_status,tracking_number,tracking_url,carrier,shipping_city,shipping_state,shipping_country,return_status,claim_eligible,created_at,updated_at,shipped_at,delivered_at').eq('buyer_id', user.id).order('created_at', { ascending: false }).limit(25);
    if (sessionId) query = query.eq('stripe_checkout_session_id', sessionId);
    const { data: orders, error } = await query;
    if (error) throw error;
    const ids = (orders || []).map(order => order.id);
    const { data: events, error: eventError } = ids.length ? await db.from('physical_order_events').select('physical_order_id,event_id,event_type,public_message,created_at').in('physical_order_id', ids).order('created_at', { ascending: true }) : { data: [], error: null };
    if (eventError) throw eventError;
    return NextResponse.json({ orders: (orders || []).map(order => ({ ...order, events: (events || []).filter(event => event.physical_order_id === order.id) })) });
  } catch (error) {
    console.error('Order history read failed', error);
    return NextResponse.json({ error: 'Unable to load order history' }, { status: 500 });
  }
}
