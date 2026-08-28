import { NextResponse } from 'next/server';
import { getAddress } from 'ethers';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { assertDigitalEstatePricing, getDigitalEstate } from '../../../../lib/digital-estates';
import { digitalEstateMintReady, isDigitalEstateMinted } from '../../../../lib/digital-estate-mint';
import { acquireDigitalEstateReservation } from '../../../../lib/digital-estate-reservations';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const BASE_CHAIN_ID = 8453;
const BASE_CHAIN_HEX = '0x2105';
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function authenticatedUser(request: Request) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error ? null : user;
}

export async function POST(request: Request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in before starting a USDC purchase.' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const estate = assertDigitalEstatePricing(getDigitalEstate(body?.estateId));
    const walletRaw = String(body?.wallet || '').trim();
    if (!ADDRESS_RE.test(walletRaw)) return NextResponse.json({ error: 'Connect a valid EVM wallet first.' }, { status: 400 });
    const wallet = getAddress(walletRaw);

    if (!digitalEstateMintReady()) {
      return NextResponse.json({ error: 'Digital Estate minting is not configured, so USDC transfer is disabled.' }, { status: 503 });
    }

    let minted = false;
    try { minted = await isDigitalEstateMinted(estate.id); }
    catch (error) {
      console.error('Digital Estate USDC availability check failed', error);
      return NextResponse.json({ error: 'Blockchain availability could not be verified. No transfer should be sent.' }, { status: 503 });
    }
    if (minted) return NextResponse.json({ error: 'This Digital Estate is already owned onchain.', sold: true }, { status: 409 });

    const deployment = await getVoxelFlipDeployment();
    const recipientRaw = process.env.DIGITAL_ESTATE_USDC_RECIPIENT?.trim() || deployment.royaltyReceiver;
    if (!ADDRESS_RE.test(recipientRaw)) {
      return NextResponse.json({ error: 'The reviewed USDC recipient is not configured. No transfer should be sent.' }, { status: 503 });
    }
    const recipient = getAddress(recipientRaw);

    const hold = await acquireDigitalEstateReservation({
      estateId: estate.id,
      buyerId: user.id,
      wallet,
      source: 'base-usdc',
    });
    if (!hold.acquired && !hold.reservedByYou) {
      return NextResponse.json({
        error: hold.sold ? 'This Digital Estate has already been purchased.' : 'This Digital Estate is temporarily reserved by another buyer.',
        sold: hold.sold,
        reserved: !hold.sold,
      }, { status: 409 });
    }
    if (!hold.acquired && hold.reservation?.source !== 'base-usdc') {
      return NextResponse.json({ error: 'Your existing reservation is using another payment rail. Finish or let that checkout expire first.' }, { status: 409 });
    }

    const amountUsdcUnits = BigInt(estate.purchasePriceCents) * 10_000n;
    return NextResponse.json({
      ready: true,
      estateId: estate.id,
      wallet,
      chainId: BASE_CHAIN_ID,
      chainHex: BASE_CHAIN_HEX,
      chainName: 'Base',
      rpcUrl: 'https://mainnet.base.org',
      explorerUrl: 'https://basescan.org',
      usdcAddress: BASE_USDC,
      usdcDecimals: 6,
      recipient,
      amountUsdcUnits: amountUsdcUnits.toString(),
      amountUsdCents: estate.purchasePriceCents,
      amountUsd: estate.purchasePriceCents / 100,
      warning: 'This is a real USDC transfer for a digital-only NFT estate. It does not purchase physical real estate, a deed, rent rights, or an investment interest.',
    });
  } catch (error) {
    console.error('Digital Estate USDC preflight failed', error);
    return NextResponse.json({ error: 'USDC purchase preflight failed. No transfer should be sent.' }, { status: 500 });
  }
}
