import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Sign in to mint a collectible.' }, { status: 401 });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: 'Sign in to mint a collectible.' }, { status: 401 });

    const body = await request.json();
    const receiptId = typeof body.receiptId === 'string' ? body.receiptId.trim() : '';
    const collectibleId = typeof body.collectibleId === 'string' ? body.collectibleId.trim() : '';
    if (!receiptId || !collectibleId || receiptId.length > 128 || collectibleId.length > 128) {
      return NextResponse.json({ error: 'Invalid receipt or collectible.' }, { status: 400 });
    }

    // Do not trust the browser to assert that a receipt was paid. A production merchant adapter
    // must verify the receipt and persist the verified purchase before any collectible flow begins.
    const { data: verifiedReceipt, error: receiptError } = await supabase
      .from('verified_receipts')
      .select('id,status')
      .eq('id', receiptId)
      .eq('user_id', user.id)
      .eq('status', 'verified')
      .maybeSingle();

    if (receiptError) {
      return NextResponse.json({ error: 'Receipt verification state could not be loaded.' }, { status: 503 });
    }
    if (!verifiedReceipt) {
      return NextResponse.json({ error: 'This receipt has not been verified by a participating merchant yet.' }, { status: 409 });
    }

    // Fail closed until a signed Stripe webhook (or another verified settlement rail)
    // has a durable fulfillment consumer for receipt_collectible_mint. The previous
    // implementation could create a $2.99 Checkout Session without any post-payment
    // mint/entitlement handler. Do not take money for an incomplete fulfillment path.
    return NextResponse.json({
      error: 'Receipt collectible mint checkout is not activated yet because post-payment mint fulfillment is not installed. No charge has been created.',
      checkoutEnabled: false,
      paymentSessionCreated: false,
      receiptVerified: true,
      collectibleId,
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('receipt mint availability check failed', error);
    return NextResponse.json({ error: 'Receipt minting is temporarily unavailable. No charge has been created.' }, { status: 500 });
  }
}
