import { NextResponse } from 'next/server';
import { x402RuntimeStatus } from '../../../../lib/x402-resource';
import { aiLicensePriceAtomic } from '../../../../lib/ai-licensing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const x402 = x402RuntimeStatus();
  const quotePrice = String(process.env.X402_BASE_QUOTE_PRICE_ATOMIC || '1000');
  const optimizePrice = String(process.env.X402_OPTIMIZE_PRICE_ATOMIC || '5000');
  const decisionPrice = String(process.env.X402_DECISION_PRICE_ATOMIC || '10000');
  const aiLicensePrice = aiLicensePriceAtomic();

  return NextResponse.json({
    name: 'Voxel Vault Machine Revenue API',
    version: '2.3.0',
    network: 'Base',
    chainId: 8453,
    capabilities: [
      'flashblocks-pending-state-quotes',
      'weth-usdc-cross-dex-arbitrage-validation',
      'multi-size-net-profit-optimization',
      'short-lived-agent-execution-tickets',
      'x402-usdc-pay-per-request',
      'nft-machine-use-licensing',
      'pay-per-use-ai-asset-rights',
      'human-base-usdc-paylink',
    ],
    safety: {
      readOnly: true,
      signsTransactions: false,
      submitsTransactions: false,
      authorizesSpending: false,
      bridgeAtomicityClaimed: false,
      nftTransfers: false,
      note: 'Paid machine endpoints return market intelligence, non-authorizing quote tickets, or machine-use license receipts only. Licensing never transfers the NFT. Live trading remains a separate owner-controlled atomic executor flow with fresh simulation required. Direct paylinks are human payment prompts and do not automatically issue license receipts.',
    },
    coordinator: {
      defaultMaxQuoteEth: String(process.env.AGENT_MAX_QUOTE_ETH || '0.05'),
      requireFlashblocksByDefault: true,
      defaultTicketLifetimeMs: 1200,
      ticketIsAuthorization: false,
    },
    x402: {
      ...x402,
      prices: {
        baseQuoteAtomicUsdc: quotePrice,
        optimizeAtomicUsdc: optimizePrice,
        decisionAtomicUsdc: decisionPrice,
        aiMachineUseLicenseAtomicUsdc: aiLicensePrice,
      },
    },
    licensing: {
      model: 'single-machine-use-v1',
      repeatUseRequiresNewPayment: true,
      modelTrainingIncluded: false,
      nftOwnershipTransferred: false,
      rightsNotice: 'Licenses cover only rights actually controlled by the configured licensor. NFT ownership alone does not prove copyright ownership.',
    },
    endpoints: {
      publicScan: `${origin}/api/profit-engine/scan`,
      health: `${origin}/api/agent/health`,
      paidBaseQuote: `${origin}/api/agent/base-quote`,
      paidOptimize: `${origin}/api/agent/optimize`,
      paidDecision: `${origin}/api/agent/decision`,
      publicLicenseCatalog: `${origin}/api/licenses/catalog`,
      paidMachineUseLicense: `${origin}/api/licenses/use`,
      directPayPage: `${origin}/pay`,
      directPaylink: `${origin}/api/paylink`,
      licensingPage: `${origin}/ai-licensing`,
      openapi: `${origin}/api/agent/openapi`,
      manifest: `${origin}/api/agent/manifest`,
    },
    requestExamples: {
      baseQuote: { amountEth: '0.01', targetBps: 25, slippageBps: 15, preferFlashblocks: true },
      optimize: { amountsEth: ['0.005', '0.01', '0.025', '0.05'], targetBps: 25, slippageBps: 15, preferFlashblocks: true },
      decision: { amountEth: '0.01', targetBps: 25, slippageBps: 15, requireFlashblocks: true, ticketLifetimeMs: 1200 },
      machineUseLicense: { tokenId: '1', clientId: 'example-agent', useCase: 'render this voxel in one generated scene' },
    },
  }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } });
}