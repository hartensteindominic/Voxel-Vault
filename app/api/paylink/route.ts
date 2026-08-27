import { NextResponse } from 'next/server';
import { aiLicensePriceAtomic } from '../../../lib/ai-licensing';
import { BASE_USDC, X402_NETWORK, x402RuntimeStatus } from '../../../lib/x402-resource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function displayUsdc(atomic: string) {
  const value = Number(atomic) / 1_000_000;
  return Number.isFinite(value) ? `$${value.toFixed(value < 0.01 ? 4 : 2)} USDC` : '$0.01 USDC';
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const x402 = x402RuntimeStatus();
  const amountAtomic = aiLicensePriceAtomic();
  const receiver = x402.payTo;
  const paymentUri = `ethereum:${BASE_USDC}@8453/transfer?address=${receiver}&uint256=${amountAtomic}`;

  return NextResponse.json({
    name: 'Voxel Vault Base USDC Paylink',
    purpose: 'Human-friendly Base USDC payment prompt plus x402 machine-use licensing route.',
    network: 'Base',
    chainId: 8453,
    caip2Network: X402_NETWORK,
    asset: {
      symbol: 'USDC',
      contract: BASE_USDC,
      decimals: 6,
    },
    receiver,
    amount: {
      display: displayUsdc(amountAtomic),
      atomic: amountAtomic,
    },
    paymentUri,
    metamaskLink: `https://metamask.app.link/send/${receiver}@8453`,
    endpoints: {
      directPayPage: `${origin}/pay`,
      publicPage: `${origin}/ai-licensing`,
      freeCatalog: `${origin}/api/licenses/catalog`,
      paidMachineUseLicense: `${origin}/api/licenses/use`,
      agentManifest: `${origin}/api/agent/manifest`,
      openapi: `${origin}/api/agent/openapi`,
    },
    status: {
      x402Configured: x402.configured,
      facilitatorHost: x402.facilitatorHost,
    },
    note: 'Direct wallet transfers are human payment prompts and do not automatically issue a one-use license receipt. The x402-paid endpoint issues machine-use license receipts after verification and settlement.',
  }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } });
}
