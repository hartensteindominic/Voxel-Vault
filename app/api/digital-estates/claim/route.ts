import { NextResponse } from 'next/server';
import { getAddress } from 'ethers';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { getStripe } from '../../../../lib/stripe-server';
import { assertDigitalEstatePricing, getDigitalEstate } from '../../../../lib/digital-estates';
import { buildDigitalEstateVoucher, digitalEstateMintReady, isDigitalEstateMinted } from '../../../../lib/digital-estate-mint';
import { readDigitalEstateReservation } from '../../../../lib/digital-estate-reservations';
import {
  digitalEstatePaymentErrorMessage,
  secureBaseUsdcDigitalEstatePurchase,
  secureStripeDigitalEstatePurchase,
} from '../../../../lib/digital-estate-purchases';

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

async function purchaseFromSecuredOwnership({ user, estateId, walletRaw }: { user: any; estateId: string; walletRaw: string }) {
  const estate = assertDigitalEstatePricing(getDigitalEstate(estateId));
  if (!ADDRESS_RE.test(walletRaw)) throw new Error('DIGITAL_ESTATE_WALLET_INVALID');
  const wallet = getAddress(walletRaw);
  const reservation = await readDigitalEstateReservation(estate.id);
  if (!reservation || reservation.buyerId !== user.id || reservation.wallet !== wallet.toLowerCase()) {
    throw new Error('DIGITAL_ESTATE_RESERVATION_MISMATCH');
  }
  if (!['paid', 'paid-usdc', 'minted'].includes(reservation.state)) throw new Error('DIGITAL_ESTATE_RESERVATION_STATE_INVALID');
  return {
    estate,
    buyerId: user.id,
    wallet,
    source: reservation.source,
    sourceId: reservation.sourceId || null,
    paymentTxHash: reservation.source === 'base-usdc' ? reservation.sourceId || null : null,
  };
}

async function optionalMintResponse({ request, user, purchase, requestedWallet }: { request: Request; user: any; purchase: any; requestedWallet?: string }) {
  if (purchase.buyerId !== user.id) return NextResponse.json({ error: 'This Digital Estate belongs to another Voxel Vault account.' }, { status: 403 });

  if (requestedWallet && (!ADDRESS_RE.test(requestedWallet) || getAddress(requestedWallet) !== getAddress(purchase.wallet))) {
    return NextResponse.json({ error: 'Connect the same wallet that was bound when this Digital Estate was purchased.' }, { status: 403 });
  }

  const reservation = await readDigitalEstateReservation(purchase.estate.id);
  if (!reservation || reservation.buyerId !== user.id || reservation.wallet !== purchase.wallet.toLowerCase()) {
    return NextResponse.json({ error: 'The secured Digital Estate ownership record could not be verified.' }, { status: 409 });
  }
  if (!['paid', 'paid-usdc', 'minted'].includes(reservation.state)) {
    return NextResponse.json({ error: 'This Digital Estate is not secured as a paid purchase yet.' }, { status: 409 });
  }

  if (await isDigitalEstateMinted(purchase.estate.id)) {
    return NextResponse.json({ ready: false, ownershipSecured: true, alreadyMinted: true, mintOptional: true, estate: purchase.estate, wallet: purchase.wallet, error: 'This Digital Estate has already been minted onchain.' }, { status: 409 });
  }

  if (!digitalEstateMintReady()) {
    return NextResponse.json({ ready: false, ownershipSecured: true, mintOptional: true, estate: purchase.estate, wallet: purchase.wallet, error: 'Your Digital Estate is secured, but optional minting is temporarily unavailable. You can mint later without losing ownership.' }, { status: 503 });
  }

  const voucher = await buildDigitalEstateVoucher({ estateId: purchase.estate.id, wallet: purchase.wallet, origin: new URL(request.url).origin });
  return NextResponse.json({ ready: true, ownershipSecured: true, mintOptional: true, source: purchase.source, estate: purchase.estate, wallet: purchase.wallet, paymentTxHash: purchase.paymentTxHash || null, ...voucher });
}

export async function POST(request: Request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in before managing a Digital Estate purchase.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const source = String(body?.source || '').trim().toLowerCase();
    // Legacy callers still prepare minting when action is omitted. New UI sends
    // action=secure immediately after payment, then source=owned for later minting.
    const action = String(body?.action || 'mint').trim().toLowerCase();

    let purchase;
    if (source === 'stripe') {
      const sessionId = String(body?.sessionId || '').trim();
      if (!sessionId.startsWith('cs_')) return NextResponse.json({ error: 'A valid Checkout Session is required.' }, { status: 400 });
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      purchase = await secureStripeDigitalEstatePurchase({ session, expectedBuyerId: user.id });
    } else if (source === 'base-usdc') {
      purchase = await secureBaseUsdcDigitalEstatePurchase({ estateId: String(body?.estateId || ''), buyerId: user.id, wallet: String(body?.wallet || ''), txHash: String(body?.txHash || '') });
    } else if (source === 'owned') {
      if (action !== 'mint') return NextResponse.json({ error: 'Owned-estate access is only used for optional minting.' }, { status: 400 });
      purchase = await purchaseFromSecuredOwnership({ user, estateId: String(body?.estateId || ''), walletRaw: String(body?.wallet || '') });
    } else {
      return NextResponse.json({ error: 'Unsupported Digital Estate payment source.' }, { status: 400 });
    }

    if (action === 'secure') {
      return NextResponse.json({
        secured: true,
        ownershipSecured: true,
        mintOptional: true,
        source: purchase.source,
        estate: purchase.estate,
        wallet: purchase.wallet,
        paymentTxHash: purchase.paymentTxHash || null,
        message: 'Purchase verified. This Digital Estate is locked to your Voxel Vault account and bound wallet. Minting is optional and can be completed later.',
      });
    }

    if (action !== 'mint') return NextResponse.json({ error: 'Unsupported Digital Estate purchase action.' }, { status: 400 });
    return await optionalMintResponse({ request, user, purchase, requestedWallet: String(body?.wallet || '').trim() || undefined });
  } catch (error) {
    console.error('Digital Estate purchase verification failed', error);
    const message = digitalEstatePaymentErrorMessage(error);
    const status = message.includes('not confirmed') || message.includes('not paid') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
