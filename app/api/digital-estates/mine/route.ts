import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { DIGITAL_ESTATES } from '../../../../lib/digital-estates';
import { isDigitalEstateMinted } from '../../../../lib/digital-estate-mint';
import { readDigitalEstateReservation } from '../../../../lib/digital-estate-reservations';

export const runtime = 'nodejs';

async function authenticatedUser(request: Request) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error ? null : user;
}

export async function GET(request: Request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view your Digital Estates.' }, { status: 401 });

    const owned = [];
    for (const estate of DIGITAL_ESTATES) {
      const reservation = await readDigitalEstateReservation(estate.id);
      if (!reservation || reservation.buyerId !== user.id || !['paid', 'paid-usdc', 'minted'].includes(reservation.state)) continue;

      let minted: boolean | null = null;
      try { minted = await isDigitalEstateMinted(estate.id); }
      catch (error) { console.warn('Digital Estate onchain status unavailable', estate.id, error); }

      owned.push({
        estate,
        state: reservation.state,
        wallet: reservation.wallet,
        paymentSource: reservation.source,
        purchasedAt: reservation.processedAt,
        minted,
        ownershipSecured: true,
        mintOptional: true,
      });
    }

    return NextResponse.json({ owned, count: owned.length });
  } catch (error) {
    console.error('Digital Estate ownership lookup failed', error);
    return NextResponse.json({ error: 'Digital Estate ownership could not be loaded.' }, { status: 500 });
  }
}
