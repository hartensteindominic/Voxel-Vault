import { randomUUID } from 'crypto';
import { formatEther } from 'ethers';
import { NextResponse } from 'next/server';
import { createCryptoPurchase } from '../../../../../lib/voxelpop-crypto-store';
import { cleanAttribution, normalizeFlowId, recordVoxelPopEvent } from '../../../../../lib/voxelpop-analytics';

export const runtime = 'nodejs';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRICE_CENTS = 199;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const USD_MICROS = BigInt(1_000_000);
const WEI_PER_ETH = BigInt('1000000000000000000');
const RECEIVER = (process.env.VOXELPOP_CRYPTO_RECEIVER || '0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb').trim();
const ALLOWED_CHAINS = new Map<number, string>([[8453, 'Base'], [1, 'Ethereum']]);

function priceToMicros(value: string) {
  const match = String(value || '').trim().match(/^(\d+)(?:\.(\d{1,6}))?/);
  if (!match) return ZERO;
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] || '').padEnd(6, '0'));
  return whole * USD_MICROS + fraction;
}

async function ethUsdMicros() {
  const response = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  const amount = priceToMicros(String(data?.data?.amount || ''));
  if (!response.ok || amount <= ZERO) throw new Error('ETH/USD quote unavailable');
  return amount;
}

export async function POST(request: Request) {
  try {
    if (!ADDRESS_RE.test(RECEIVER)) return NextResponse.json({ error: 'Crypto checkout receiver is not configured.' }, { status: 503 });
    const body = await request.json();
    const wallet = typeof body?.wallet === 'string' ? body.wallet.trim() : '';
    const style = typeof body?.style === 'string' ? body.style.slice(0, 30) : 'polished';
    const chainId = Number(body?.chainId || 8453);
    const flowId = normalizeFlowId(body?.flowId);
    const attribution = cleanAttribution(body?.attribution);
    if (!ADDRESS_RE.test(wallet)) return NextResponse.json({ error: 'Connect a valid wallet first.' }, { status: 400 });
    if (!ALLOWED_CHAINS.has(chainId)) return NextResponse.json({ error: 'Choose Base or Ethereum for ETH payment.' }, { status: 400 });

    const ethUsd = await ethUsdMicros();
    const usdCentsScale = BigInt(100);
    const numerator = BigInt(PRICE_CENTS) * USD_MICROS * WEI_PER_ETH;
    const denominator = usdCentsScale * ethUsd;
    const amountWei = (numerator + denominator - ONE) / denominator;
    const sessionId = `vfc_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const metadata: Record<string, string> = { product: 'voxelpop-3d-asset', style, generations: '0', payment_method: 'crypto' };
    if (flowId) metadata.flow_id = flowId;
    if (attribution.source) metadata.utm_source = attribution.source;
    if (attribution.medium) metadata.utm_medium = attribution.medium;
    if (attribution.campaign) metadata.utm_campaign = attribution.campaign;
    if (attribution.content) metadata.utm_content = attribution.content;

    await createCryptoPurchase({
      session_id: sessionId,
      wallet: wallet.toLowerCase(),
      chain_id: chainId,
      status: 'quoted',
      quote_wei: amountWei.toString(),
      quote_usd_cents: PRICE_CENTS,
      quote_expires_at: expiresAt,
      metadata,
    });

    await recordVoxelPopEvent({ eventName: 'checkout_started', eventKey: `crypto_checkout_started:${sessionId}`, flowId, attribution, details: { amount_cents: PRICE_CENTS, currency: 'usd', payment_method: 'crypto', chain_id: chainId } });

    return NextResponse.json({
      sessionId,
      chainId,
      chainName: ALLOWED_CHAINS.get(chainId),
      receiver: RECEIVER,
      amountWei: amountWei.toString(),
      amountEth: formatEther(amountWei),
      usdCents: PRICE_CENTS,
      expiresAt,
      warning: chainId === 1 ? 'Ethereum mainnet gas may cost more than the $1.99 voxel. Base is recommended when possible.' : null,
    });
  } catch (error) {
    console.error('VoxelPop crypto quote failed', error);
    return NextResponse.json({ error: 'Unable to create an ETH checkout quote right now.' }, { status: 500 });
  }
}
