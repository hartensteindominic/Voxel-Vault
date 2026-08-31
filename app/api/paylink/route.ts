import { NextResponse } from 'next/server';
import {
  BASE_CHAIN_ID,
  BASE_NETWORK,
  BASE_USDC_ADDRESS,
  baseUsdcPaymentUri,
  licenseAtomicAmount,
  metamaskSendLink
} from '../../../lib/config';
import { licensePrice, x402Status } from '../../../lib/x402';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const status = x402Status();

  return NextResponse.json({
    name: 'Galactic Base USDC Paylink',
    purpose: 'Direct human payment prompt plus x402 machine-use licensing route.',
    chainId: BASE_CHAIN_ID,
    network: 'Base',
    caip2Network: BASE_NETWORK,
    asset: {
      symbol: 'USDC',
      contract: BASE_USDC_ADDRESS,
      decimals: 6
    },
    receiver: status.payTo,
    amount: {
      display: `${licensePrice()} USDC`,
      atomic: licenseAtomicAmount()
    },
    paymentUri: baseUsdcPaymentUri(status.payTo),
    metamaskLink: metamaskSendLink(status.payTo),
    endpoints: {
      paidMachineUseLicense: `${origin}/api/licenses/use`,
      freeCatalog: `${origin}/api/licenses/catalog`,
      agentManifest: `${origin}/api/agent/manifest`,
      openapi: `${origin}/api/agent/openapi`
    },
    note: 'Direct wallet transfers are payment prompts for human buyers. Automatic one-use license receipts are issued by the x402-paid endpoint after server deployment.'
  }, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' }
  });
}
