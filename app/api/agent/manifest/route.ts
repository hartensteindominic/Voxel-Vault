import { NextResponse } from 'next/server';
import { x402RuntimeStatus } from '../../../../lib/x402-resource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const x402 = x402RuntimeStatus();
  const quotePrice = String(process.env.X402_BASE_QUOTE_PRICE_ATOMIC || '1000');
  const optimizePrice = String(process.env.X402_OPTIMIZE_PRICE_ATOMIC || '5000');

  return NextResponse.json({
    name: 'Voxel Vault Machine Revenue API',
    version: '2.0.0',
    network: 'Base',
    chainId: 8453,
    capabilities: [
      'flashblocks-pending-state-quotes',
      'weth-usdc-cross-dex-arbitrage-validation',
      'multi-size-net-profit-optimization',
      'x402-usdc-pay-per-request',
    ],
    safety: {
      readOnly: true,
      signsTransactions: false,
      submitsTransactions: false,
      bridgeAtomicityClaimed: false,
      note: 'Paid machine endpoints return market intelligence only. Live execution remains a separate owner-controlled atomic executor flow.',
    },
    x402: {
      ...x402,
      prices: {
        baseQuoteAtomicUsdc: quotePrice,
        optimizeAtomicUsdc: optimizePrice,
      },
    },
    endpoints: {
      publicScan: `${origin}/api/profit-engine/scan`,
      paidBaseQuote: `${origin}/api/agent/base-quote`,
      paidOptimize: `${origin}/api/agent/optimize`,
      openapi: `${origin}/api/agent/openapi`,
      manifest: `${origin}/api/agent/manifest`,
    },
    requestExamples: {
      baseQuote: { amountEth: '0.01', targetBps: 25, slippageBps: 15, preferFlashblocks: true },
      optimize: { amountsEth: ['0.005', '0.01', '0.025', '0.05'], targetBps: 25, slippageBps: 15, preferFlashblocks: true },
    },
  }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } });
}
