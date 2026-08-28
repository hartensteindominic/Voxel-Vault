import { NextResponse } from 'next/server';
import { getAddress, Interface, JsonRpcProvider } from 'ethers';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { getStripe } from '../../../../lib/stripe-server';
import { assertDigitalEstatePricing, getDigitalEstate } from '../../../../lib/digital-estates';
import { buildDigitalEstateVoucher, digitalEstateMintReady, isDigitalEstateMinted } from '../../../../lib/digital-estate-mint';
import { readDigitalEstateReservation, updateDigitalEstateReservation } from '../../../../lib/digital-estate-reservations';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_PAYMENT_PROVIDER = 'digital-estate-usdc-payment';
const USDC_INTERFACE = new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);

async function authenticatedUser(request: Request) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error ? null : user;
}

function paymentEventType({ estateId, buyerId, wallet, amountUnits }: { estateId: string; buyerId: string; wallet: string; amountUnits: string }) {
  return JSON.stringify({ kind: 'digital-estate-usdc', estateId, buyerId, wallet: wallet.toLowerCase(), amountUnits });
}

async function recordOrVerifyUsdcPayment({
  txHash,
  estateId,
  buyerId,
  wallet,
  amountUnits,
}: {
  txHash: string;
  estateId: string;
  buyerId: string;
  wallet: string;
  amountUnits: string;
}) {
  const supabase = getSupabaseAdmin();
  const expectedType = paymentEventType({ estateId, buyerId, wallet, amountUnits });
  const { error } = await supabase.from('commerce_webhook_events').insert({
    provider: USDC_PAYMENT_PROVIDER,
    event_id: txHash.toLowerCase(),
    event_type: expectedType,
    processed_at: new Date().toISOString(),
  });
  if (!error) return;
  if (error.code !== '23505') throw error;

  const { data: existing, error: lookupError } = await supabase
    .from('commerce_webhook_events')
    .select('event_type')
    .eq('provider', USDC_PAYMENT_PROVIDER)
    .eq('event_id', txHash.toLowerCase())
    .single();
  if (lookupError || !existing) throw lookupError || new Error('USDC payment idempotency record could not be verified.');
  if (String(existing.event_type) !== expectedType) throw new Error('This USDC transaction was already used for another purchase.');
}

async function claimFromStripe({ request, user, body }: { request: Request; user: any; body: any }) {
  const sessionId = String(body?.sessionId || '').trim();
  if (!sessionId.startsWith('cs_')) return NextResponse.json({ error: 'A valid Checkout Session is required.' }, { status: 400 });

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Payment is not confirmed yet. Voxel Vault will not issue a mint voucher until Stripe reports paid.', paymentPending: true }, { status: 409 });
  }
  if (session.metadata?.kind !== 'digital_estate' || session.metadata?.buyer_id !== user.id) {
    return NextResponse.json({ error: 'This payment does not belong to your Digital Estate purchase.' }, { status: 403 });
  }

  const estate = assertDigitalEstatePricing(getDigitalEstate(session.metadata?.estate_id));
  const walletRaw = String(session.metadata?.wallet || '');
  if (!ADDRESS_RE.test(walletRaw)) return NextResponse.json({ error: 'The paid session is missing its bound wallet.' }, { status: 409 });
  const wallet = getAddress(walletRaw);
  const requestedWallet = String(body?.wallet || '').trim();
  if (requestedWallet && (!ADDRESS_RE.test(requestedWallet) || getAddress(requestedWallet) !== wallet)) {
    return NextResponse.json({ error: 'Connect the same wallet that was bound before checkout.' }, { status: 403 });
  }
  if (session.currency !== 'usd' || Number(session.amount_total) !== estate.purchasePriceCents) {
    return NextResponse.json({ error: 'Paid amount does not match the server-authoritative Digital Estate price.' }, { status: 409 });
  }
  if (String(session.metadata?.purchase_price_cents || '') !== String(estate.purchasePriceCents)
    || String(session.metadata?.reference_value_cents || '') !== String(estate.referenceValueCents)) {
    return NextResponse.json({ error: 'Checkout metadata no longer matches the reviewed estate catalog.' }, { status: 409 });
  }

  const reservation = await readDigitalEstateReservation(estate.id);
  if (!reservation || reservation.buyerId !== user.id || reservation.wallet !== wallet.toLowerCase()) {
    return NextResponse.json({ error: 'The paid estate reservation could not be matched to your account and wallet.' }, { status: 409 });
  }
  if (reservation.sourceId && reservation.sourceId !== session.id) {
    return NextResponse.json({ error: 'A different payment source already owns this estate reservation.' }, { status: 409 });
  }
  if (!['checkout', 'paid'].includes(reservation.state)) {
    return NextResponse.json({ error: `Estate reservation is in unexpected state ${reservation.state}.` }, { status: 409 });
  }
  if (reservation.state !== 'paid') {
    await updateDigitalEstateReservation({ estateId: estate.id, buyerId: user.id, wallet, state: 'paid', source: 'stripe', sourceId: session.id });
  }

  if (await isDigitalEstateMinted(estate.id)) {
    return NextResponse.json({ ready: false, alreadyMinted: true, estateId: estate.id, wallet, error: 'This Digital Estate voucher has already been minted onchain.' }, { status: 409 });
  }

  const voucher = await buildDigitalEstateVoucher({ estateId: estate.id, wallet, origin: new URL(request.url).origin });
  return NextResponse.json({ ready: true, source: 'stripe', estate, wallet, ...voucher });
}

async function claimFromBaseUsdc({ request, user, body }: { request: Request; user: any; body: any }) {
  const estate = assertDigitalEstatePricing(getDigitalEstate(body?.estateId));
  const walletRaw = String(body?.wallet || '').trim();
  const txHash = String(body?.txHash || '').trim();
  if (!ADDRESS_RE.test(walletRaw) || !TX_RE.test(txHash)) {
    return NextResponse.json({ error: 'A valid wallet and Base USDC transaction hash are required.' }, { status: 400 });
  }
  const wallet = getAddress(walletRaw);
  const reservation = await readDigitalEstateReservation(estate.id);
  if (!reservation || reservation.buyerId !== user.id || reservation.wallet !== wallet.toLowerCase() || reservation.source !== 'base-usdc') {
    return NextResponse.json({ error: 'No matching USDC reservation exists for this account, wallet, and estate.' }, { status: 409 });
  }
  if (reservation.state === 'paid-usdc' && reservation.sourceId && reservation.sourceId.toLowerCase() !== txHash.toLowerCase()) {
    return NextResponse.json({ error: 'This estate was already paid with a different USDC transaction.' }, { status: 409 });
  }
  if (!['reserved', 'paid-usdc'].includes(reservation.state)) {
    return NextResponse.json({ error: `Estate reservation is in unexpected state ${reservation.state}.` }, { status: 409 });
  }

  const deployment = await getVoxelFlipDeployment();
  const recipientRaw = process.env.DIGITAL_ESTATE_USDC_RECIPIENT?.trim() || deployment.royaltyReceiver;
  if (!ADDRESS_RE.test(recipientRaw)) return NextResponse.json({ error: 'Reviewed USDC recipient is unavailable.' }, { status: 503 });
  const recipient = getAddress(recipientRaw);
  const rpc = process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
  const provider = new JsonRpcProvider(rpc, 8453, { staticNetwork: true });
  try {
    const [transaction, receipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ]);
    if (!transaction || !receipt || Number(receipt.status) !== 1) {
      return NextResponse.json({ error: 'The Base USDC transaction is not confirmed successfully.' }, { status: 409 });
    }
    if (getAddress(transaction.from) !== wallet || !transaction.to || getAddress(transaction.to) !== getAddress(BASE_USDC)) {
      return NextResponse.json({ error: 'The transaction sender or token contract does not match this purchase.' }, { status: 409 });
    }

    const block = await provider.getBlock(receipt.blockNumber);
    if (!block) return NextResponse.json({ error: 'The USDC payment block could not be verified.' }, { status: 503 });
    if (reservation.state === 'reserved') {
      const reservedAtSeconds = Math.floor(Date.parse(reservation.processedAt) / 1000);
      if (!Number.isFinite(reservedAtSeconds) || block.timestamp < reservedAtSeconds - 120 || block.timestamp > reservedAtSeconds + 45 * 60) {
        return NextResponse.json({ error: 'This USDC transfer falls outside the active estate reservation window.' }, { status: 409 });
      }
    }

    const expectedUnits = BigInt(estate.purchasePriceCents) * BigInt(10_000);
    let exactTransfer = false;
    for (const log of receipt.logs) {
      if (getAddress(log.address) !== getAddress(BASE_USDC)) continue;
      try {
        const parsed = USDC_INTERFACE.parseLog({ topics: log.topics as string[], data: log.data });
        if (!parsed || parsed.name !== 'Transfer') continue;
        const from = getAddress(String(parsed.args[0]));
        const to = getAddress(String(parsed.args[1]));
        const value = BigInt(parsed.args[2].toString());
        if (from === wallet && to === recipient && value === expectedUnits) {
          exactTransfer = true;
          break;
        }
      } catch {}
    }
    if (!exactTransfer) {
      return NextResponse.json({ error: 'No exact USDC transfer from your wallet to the reviewed recipient was found in this transaction.' }, { status: 409 });
    }

    await recordOrVerifyUsdcPayment({ txHash, estateId: estate.id, buyerId: user.id, wallet, amountUnits: expectedUnits.toString() });
    if (reservation.state !== 'paid-usdc') {
      await updateDigitalEstateReservation({ estateId: estate.id, buyerId: user.id, wallet, state: 'paid-usdc', source: 'base-usdc', sourceId: txHash.toLowerCase() });
    }

    if (await isDigitalEstateMinted(estate.id)) {
      return NextResponse.json({ ready: false, alreadyMinted: true, estateId: estate.id, wallet, error: 'This Digital Estate voucher has already been minted onchain.' }, { status: 409 });
    }
    const voucher = await buildDigitalEstateVoucher({ estateId: estate.id, wallet, origin: new URL(request.url).origin });
    return NextResponse.json({ ready: true, source: 'base-usdc', estate, wallet, paymentTxHash: txHash, ...voucher });
  } finally {
    provider.destroy();
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in before claiming a Digital Estate.' }, { status: 401 });
    if (!digitalEstateMintReady()) return NextResponse.json({ error: 'Digital Estate mint signing is unavailable.' }, { status: 503 });
    const body = await request.json().catch(() => ({}));
    const source = String(body?.source || '').trim().toLowerCase();
    if (source === 'stripe') return await claimFromStripe({ request, user, body });
    if (source === 'base-usdc') return await claimFromBaseUsdc({ request, user, body });
    return NextResponse.json({ error: 'Unsupported Digital Estate payment source.' }, { status: 400 });
  } catch (error) {
    console.error('Digital Estate claim verification failed', error);
    return NextResponse.json({ error: 'Payment could not be verified for minting. No NFT voucher was issued.' }, { status: 500 });
  }
}
