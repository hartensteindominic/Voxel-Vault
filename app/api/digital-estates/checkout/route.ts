import { NextResponse } from 'next/server';
import { getAddress } from 'ethers';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { getStripe } from '../../../../lib/stripe-server';
import { assertDigitalEstatePricing, DIGITAL_ESTATE_DISCLOSURE, estateCheckoutSupported, getDigitalEstate } from '../../../../lib/digital-estates';
import { digitalEstateMintReady, isDigitalEstateMinted } from '../../../../lib/digital-estate-mint';
import { acquireDigitalEstateReservation, releaseDigitalEstateReservation, updateDigitalEstateReservation } from '../../../../lib/digital-estate-reservations';

export const runtime = 'nodejs';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

async function authenticatedUser(request: Request) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error ? null : user;
}

export async function POST(request: Request) {
  let reservation: { estateId: string; buyerId: string; wallet: string } | null = null;
  try {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in before reserving a Digital Estate.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const estate = assertDigitalEstatePricing(getDigitalEstate(body?.estateId));
    const walletRaw = String(body?.wallet || '').trim();
    if (!ADDRESS_RE.test(walletRaw)) return NextResponse.json({ error: 'Connect a valid EVM wallet before checkout.' }, { status: 400 });
    const wallet = getAddress(walletRaw);

    if (!estateCheckoutSupported(estate)) {
      return NextResponse.json({
        error: 'This Digital Estate exceeds the instant hosted-checkout rail. Use a supported high-value settlement path instead.',
        highValueSettlementRequired: true,
      }, { status: 409 });
    }
    if (!digitalEstateMintReady()) {
      return NextResponse.json({ error: 'Digital Estate minting is not configured, so payment is paused. No checkout was created.' }, { status: 503 });
    }

    let alreadyMinted = false;
    try {
      alreadyMinted = await isDigitalEstateMinted(estate.id);
    } catch (error) {
      console.error('Digital Estate availability check failed', error);
      return NextResponse.json({ error: 'Blockchain availability could not be verified. Checkout stopped before payment.' }, { status: 503 });
    }
    if (alreadyMinted) return NextResponse.json({ error: 'This Digital Estate is already owned onchain.', sold: true }, { status: 409 });

    let hold = await acquireDigitalEstateReservation({ estateId: estate.id, buyerId: user.id, wallet, source: 'stripe' });

    if (!hold.acquired && hold.reservedByYou && hold.reservation?.state === 'reserved') {
      await releaseDigitalEstateReservation({ estateId: estate.id, buyerId: user.id, wallet });
      hold = await acquireDigitalEstateReservation({ estateId: estate.id, buyerId: user.id, wallet, source: 'stripe' });
    }

    if (!hold.acquired && hold.reservation?.state === 'checkout' && hold.reservation.sourceId?.startsWith('cs_')) {
      const stripe = getStripe();
      const previous = await stripe.checkout.sessions.retrieve(hold.reservation.sourceId);
      if (previous.payment_status === 'paid') {
        await updateDigitalEstateReservation({
          estateId: estate.id,
          buyerId: hold.reservation.buyerId,
          wallet: hold.reservation.wallet,
          state: 'paid',
          source: 'stripe',
          sourceId: previous.id,
        });
        return NextResponse.json({ error: 'This Digital Estate has already been paid for.', sold: true }, { status: 409 });
      }
      if (previous.status === 'expired') {
        await releaseDigitalEstateReservation({
          estateId: estate.id,
          buyerId: hold.reservation.buyerId,
          wallet: hold.reservation.wallet,
        });
        hold = await acquireDigitalEstateReservation({ estateId: estate.id, buyerId: user.id, wallet, source: 'stripe' });
      } else if (hold.reservedByYou && previous.status === 'open' && previous.url) {
        return NextResponse.json({ url: previous.url, resumed: true, estateId: estate.id });
      } else {
        return NextResponse.json({
          error: previous.status === 'complete'
            ? 'Payment for this Digital Estate is still being confirmed.'
            : 'This Digital Estate is temporarily reserved by another checkout.',
          reserved: true,
          paymentPending: previous.status === 'complete',
        }, { status: 409 });
      }
    }

    if (!hold.acquired) {
      return NextResponse.json({
        error: hold.sold ? 'This Digital Estate has already been purchased.' : 'This Digital Estate is temporarily reserved by another checkout.',
        sold: hold.sold,
        reserved: !hold.sold,
      }, { status: 409 });
    }

    reservation = { estateId: estate.id, buyerId: user.id, wallet };
    const stripe = getStripe();
    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin;
    const metadata = {
      kind: 'digital_estate',
      estate_id: estate.id,
      buyer_id: user.id,
      wallet: wallet.toLowerCase(),
      purchase_price_cents: String(estate.purchasePriceCents),
      reference_value_cents: String(estate.referenceValueCents),
      rights: 'digital_only_no_real_property_rights',
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email || undefined,
      billing_address_collection: 'required',
      phone_number_collection: { enabled: true },
      client_reference_id: user.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: estate.purchasePriceCents,
          product_data: {
            name: estate.name,
            description: `Unique Voxel Vault Digital Estate. ${DIGITAL_ESTATE_DISCLOSURE}`.slice(0, 500),
          },
        },
      }],
      metadata,
      payment_intent_data: { metadata },
      success_url: `${origin}/vault/estates/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/vault/estates?estate=${encodeURIComponent(estate.id)}&checkout=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    if (!session.url) throw new Error('Stripe did not return a Checkout URL.');
    await updateDigitalEstateReservation({ estateId: estate.id, buyerId: user.id, wallet, state: 'checkout', source: 'stripe', sourceId: session.id });
    reservation = null;

    return NextResponse.json({ url: session.url, estateId: estate.id, amountCents: estate.purchasePriceCents, paymentMethods: 'dynamic-eligible-methods' });
  } catch (error) {
    console.error('Digital Estate checkout failed', error);
    if (reservation) {
      try { await releaseDigitalEstateReservation(reservation); } catch (releaseError) { console.error('Digital Estate reservation release failed', releaseError); }
    }
    return NextResponse.json({ error: 'Unable to create Digital Estate checkout. No payment was initiated.' }, { status: 500 });
  }
}
