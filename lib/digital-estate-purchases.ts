import Stripe from 'stripe';
import { getAddress, Interface, JsonRpcProvider } from 'ethers';
import { getSupabaseAdmin } from './supabase-admin';
import { assertDigitalEstatePricing, getDigitalEstate } from './digital-estates';
import { readDigitalEstateReservation, updateDigitalEstateReservation } from './digital-estate-reservations';
import { getVoxelFlipDeployment } from './voxelflip-deployment';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_PAYMENT_PROVIDER = 'digital-estate-usdc-payment';
const USDC_INTERFACE = new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);

function paymentEventType({ estateId, buyerId, wallet, amountUnits }: { estateId: string; buyerId: string; wallet: string; amountUnits: string }) {
  return JSON.stringify({ kind: 'digital-estate-usdc', estateId, buyerId, wallet: wallet.toLowerCase(), amountUnits });
}

async function recordOrVerifyUsdcPayment({ txHash, estateId, buyerId, wallet, amountUnits }: { txHash: string; estateId: string; buyerId: string; wallet: string; amountUnits: string }) {
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

export async function secureStripeDigitalEstatePurchase({ session, expectedBuyerId }: { session: Stripe.Checkout.Session; expectedBuyerId?: string }) {
  if (session.payment_status !== 'paid') throw new Error('DIGITAL_ESTATE_PAYMENT_NOT_PAID');
  if (session.metadata?.kind !== 'digital_estate') throw new Error('DIGITAL_ESTATE_METADATA_INVALID');

  const buyerId = String(session.metadata?.buyer_id || '');
  if (!buyerId || (expectedBuyerId && buyerId !== expectedBuyerId)) throw new Error('DIGITAL_ESTATE_BUYER_MISMATCH');

  const estate = assertDigitalEstatePricing(getDigitalEstate(session.metadata?.estate_id));
  const walletRaw = String(session.metadata?.wallet || '').trim();
  const wallet = walletRaw && ADDRESS_RE.test(walletRaw) ? getAddress(walletRaw) : '';

  if (session.currency !== 'usd' || Number(session.amount_total) !== estate.purchasePriceCents) {
    throw new Error('DIGITAL_ESTATE_AMOUNT_MISMATCH');
  }
  if (String(session.metadata?.purchase_price_cents || '') !== String(estate.purchasePriceCents)
    || String(session.metadata?.reference_value_cents || '') !== String(estate.referenceValueCents)) {
    throw new Error('DIGITAL_ESTATE_CATALOG_MISMATCH');
  }

  const reservation = await readDigitalEstateReservation(estate.id);
  if (!reservation || reservation.buyerId !== buyerId) {
    throw new Error('DIGITAL_ESTATE_RESERVATION_MISMATCH');
  }
  if (reservation.source !== 'stripe') throw new Error('DIGITAL_ESTATE_PAYMENT_SOURCE_MISMATCH');
  if (reservation.wallet && wallet && reservation.wallet !== wallet.toLowerCase()) throw new Error('DIGITAL_ESTATE_WALLET_MISMATCH');
  if (reservation.sourceId && reservation.sourceId !== session.id) throw new Error('DIGITAL_ESTATE_SESSION_MISMATCH');
  if (!['reserved', 'checkout', 'paid', 'minted'].includes(reservation.state)) throw new Error('DIGITAL_ESTATE_RESERVATION_STATE_INVALID');

  if (reservation.state !== 'paid' && reservation.state !== 'minted') {
    await updateDigitalEstateReservation({
      estateId: estate.id,
      buyerId,
      wallet: reservation.wallet,
      state: 'paid',
      source: 'stripe',
      sourceId: session.id,
    });
  }

  return { estate, buyerId, wallet: reservation.wallet || wallet, source: 'stripe' as const, sourceId: session.id };
}

export async function secureBaseUsdcDigitalEstatePurchase({ estateId, buyerId, wallet: walletRaw, txHash }: { estateId: string; buyerId: string; wallet: string; txHash: string }) {
  const estate = assertDigitalEstatePricing(getDigitalEstate(estateId));
  if (!ADDRESS_RE.test(walletRaw) || !TX_RE.test(txHash)) throw new Error('DIGITAL_ESTATE_USDC_INPUT_INVALID');
  const wallet = getAddress(walletRaw);

  const reservation = await readDigitalEstateReservation(estate.id);
  if (!reservation || reservation.buyerId !== buyerId || reservation.wallet !== wallet.toLowerCase() || reservation.source !== 'base-usdc') {
    throw new Error('DIGITAL_ESTATE_RESERVATION_MISMATCH');
  }
  if (reservation.state === 'paid-usdc' && reservation.sourceId && reservation.sourceId.toLowerCase() !== txHash.toLowerCase()) {
    throw new Error('DIGITAL_ESTATE_USDC_TX_MISMATCH');
  }
  if (!['reserved', 'paid-usdc', 'minted'].includes(reservation.state)) throw new Error('DIGITAL_ESTATE_RESERVATION_STATE_INVALID');

  const deployment = await getVoxelFlipDeployment();
  const recipientRaw = process.env.DIGITAL_ESTATE_USDC_RECIPIENT?.trim() || deployment.royaltyReceiver;
  if (!ADDRESS_RE.test(recipientRaw)) throw new Error('DIGITAL_ESTATE_USDC_RECIPIENT_INVALID');
  const recipient = getAddress(recipientRaw);
  const rpc = process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
  const provider = new JsonRpcProvider(rpc, 8453, { staticNetwork: true });

  try {
    const [transaction, receipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ]);
    if (!transaction || !receipt || Number(receipt.status) !== 1) throw new Error('DIGITAL_ESTATE_USDC_NOT_CONFIRMED');
    if (getAddress(transaction.from) !== wallet || !transaction.to || getAddress(transaction.to) !== getAddress(BASE_USDC)) {
      throw new Error('DIGITAL_ESTATE_USDC_TRANSACTION_MISMATCH');
    }

    const block = await provider.getBlock(receipt.blockNumber);
    if (!block) throw new Error('DIGITAL_ESTATE_USDC_BLOCK_UNAVAILABLE');
    if (reservation.state === 'reserved') {
      const reservedAtSeconds = Math.floor(Date.parse(reservation.processedAt) / 1000);
      if (!Number.isFinite(reservedAtSeconds) || block.timestamp < reservedAtSeconds - 120 || block.timestamp > reservedAtSeconds + 45 * 60) {
        throw new Error('DIGITAL_ESTATE_USDC_OUTSIDE_RESERVATION');
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
    if (!exactTransfer) throw new Error('DIGITAL_ESTATE_USDC_EXACT_TRANSFER_MISSING');

    await recordOrVerifyUsdcPayment({
      txHash,
      estateId: estate.id,
      buyerId,
      wallet,
      amountUnits: expectedUnits.toString(),
    });

    if (reservation.state !== 'paid-usdc' && reservation.state !== 'minted') {
      await updateDigitalEstateReservation({
        estateId: estate.id,
        buyerId,
        wallet,
        state: 'paid-usdc',
        source: 'base-usdc',
        sourceId: txHash.toLowerCase(),
      });
    }

    return { estate, buyerId, wallet, source: 'base-usdc' as const, sourceId: txHash.toLowerCase(), paymentTxHash: txHash };
  } finally {
    provider.destroy();
  }
}

export function digitalEstatePaymentErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : String(error || '');
  const messages: Record<string, string> = {
    DIGITAL_ESTATE_PAYMENT_NOT_PAID: 'Payment is not confirmed yet.',
    DIGITAL_ESTATE_METADATA_INVALID: 'This payment is not a Digital Estate purchase.',
    DIGITAL_ESTATE_BUYER_MISMATCH: 'This payment belongs to another Voxel Vault account.',
    DIGITAL_ESTATE_WALLET_MISMATCH: 'This paid purchase is already bound to a different wallet.',
    DIGITAL_ESTATE_AMOUNT_MISMATCH: 'The paid amount does not match the server-authoritative estate price.',
    DIGITAL_ESTATE_CATALOG_MISMATCH: 'The payment no longer matches the reviewed estate catalog.',
    DIGITAL_ESTATE_RESERVATION_MISMATCH: 'The estate reservation could not be matched to this purchase.',
    DIGITAL_ESTATE_PAYMENT_SOURCE_MISMATCH: 'This estate is reserved on another payment rail.',
    DIGITAL_ESTATE_SESSION_MISMATCH: 'A different checkout session owns this reservation.',
    DIGITAL_ESTATE_RESERVATION_STATE_INVALID: 'The estate reservation is in an invalid state.',
    DIGITAL_ESTATE_USDC_INPUT_INVALID: 'A valid Base USDC transaction and wallet are required.',
    DIGITAL_ESTATE_USDC_TX_MISMATCH: 'This estate was already secured by a different USDC transaction.',
    DIGITAL_ESTATE_USDC_RECIPIENT_INVALID: 'The reviewed USDC recipient is unavailable.',
    DIGITAL_ESTATE_USDC_NOT_CONFIRMED: 'The Base USDC transaction is not confirmed successfully.',
    DIGITAL_ESTATE_USDC_TRANSACTION_MISMATCH: 'The USDC transaction sender or token contract does not match this purchase.',
    DIGITAL_ESTATE_USDC_BLOCK_UNAVAILABLE: 'The USDC payment block could not be verified.',
    DIGITAL_ESTATE_USDC_OUTSIDE_RESERVATION: 'This USDC transfer falls outside the active estate reservation window.',
    DIGITAL_ESTATE_USDC_EXACT_TRANSFER_MISSING: 'No exact USDC transfer to the reviewed recipient was found.',
  };
  return messages[code] || 'Digital Estate payment could not be verified.';
}

export const DIGITAL_ESTATE_BASE_USDC = BASE_USDC;
