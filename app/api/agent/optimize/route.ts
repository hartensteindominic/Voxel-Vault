import { scanBaseArbitrageGrid } from '../../../../lib/base-profit-engine';
import { withX402Json } from '../../../../lib/x402-resource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function priceAtomic() {
  const configured = String(process.env.X402_OPTIMIZE_PRICE_ATOMIC || '5000').trim();
  return /^\d+$/.test(configured) && BigInt(configured) > BigInt(0) ? configured : '5000';
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const requested = Array.isArray(body?.amountsEth) ? body.amountsEth : ['0.005', '0.01', '0.025', '0.05'];

  return withX402Json(request, {
    amountAtomic: priceAtomic(),
    description: 'Compare multiple WETH/USDC arbitrage sizes on Base and return the highest net-after-gas candidate.',
    tags: ['base', 'defi', 'optimizer', 'simulation'],
  }, async () => {
    const result = await scanBaseArbitrageGrid({
      amountsEth: requested,
      targetBps: body?.targetBps,
      slippageBps: body?.slippageBps,
      preferFlashblocks: body?.preferFlashblocks !== false,
    });
    return {
      service: 'voxel-vault-base-optimizer',
      version: 2,
      decision: result.best ? 'EXECUTABLE_CANDIDATE' : 'NO_TRADE',
      optimization: result,
      safety: 'This endpoint is read-only. It does not borrow, sign, submit, bridge, or spend funds.',
    };
  });
}
