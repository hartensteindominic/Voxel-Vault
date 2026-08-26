import { scanBaseArbitrage } from '../../../../lib/base-profit-engine';
import { withX402Json } from '../../../../lib/x402-resource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function priceAtomic() {
  const configured = String(process.env.X402_BASE_QUOTE_PRICE_ATOMIC || '1000').trim();
  return /^\d+$/.test(configured) && BigInt(configured) > 0n ? configured : '1000';
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return withX402Json(request, {
    amountAtomic: priceAtomic(),
    description: 'Flashblocks-aware WETH/USDC cross-DEX quote and deterministic profit gate on Base.',
    tags: ['base', 'defi', 'arbitrage', 'simulation'],
  }, async () => {
    const scan = await scanBaseArbitrage({
      amountEth: body?.amountEth || '0.01',
      targetBps: body?.targetBps,
      slippageBps: body?.slippageBps,
      preferFlashblocks: body?.preferFlashblocks !== false,
    });
    return {
      service: 'voxel-vault-base-quote',
      version: 2,
      decision: scan.best ? 'EXECUTABLE_CANDIDATE' : 'NO_TRADE',
      scan,
      safety: 'This endpoint never signs or submits a transaction. An EXECUTABLE_CANDIDATE is still only a quote and must pass a fresh atomic executor simulation before any wallet transaction.',
    };
  });
}
