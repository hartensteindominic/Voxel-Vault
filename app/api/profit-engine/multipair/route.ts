import { NextResponse } from 'next/server';
import { scanBaseMultiPairArbitrage } from '../../../../lib/base-multipair-profit-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await scanBaseMultiPairArbitrage({
      maxCapitalEth: body?.amountEth || body?.maxCapitalEth || '0.01',
      targetBps: body?.targetBps,
      slippageBps: body?.slippageBps,
      preferFlashblocks: body?.preferFlashblocks !== false,
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('V6 multi-pair scan failed', error);
    const message = error instanceof Error ? error.message : 'V6 multi-pair scan failed.';
    const status = /valid ETH amount|between 0\.0005 and 10 ETH/i.test(message) ? 400 : 503;
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
