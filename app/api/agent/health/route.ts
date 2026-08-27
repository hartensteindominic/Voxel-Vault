import { getAddress, isAddress } from 'ethers';
import { NextResponse } from 'next/server';
import { x402RuntimeStatus } from '../../../../lib/x402-resource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const executorRaw = String(process.env.NEXT_PUBLIC_BASE_ARB_EXECUTOR_ADDRESS || process.env.BASE_ARB_EXECUTOR_ADDRESS || '').trim();
  const executorAddress = isAddress(executorRaw) ? getAddress(executorRaw) : '';
  const x402 = x402RuntimeStatus();

  return NextResponse.json({
    service: 'voxel-vault-agent-coordinator',
    version: 1,
    status: 'online',
    network: 'Base',
    chainId: 8453,
    coordinator: {
      readOnly: true,
      requiresFlashblocksByDefault: true,
      maxQuoteEth: String(process.env.AGENT_MAX_QUOTE_ETH || '0.05'),
      defaultTicketLifetimeMs: 1200,
      signsTransactions: false,
      submitsTransactions: false,
    },
    execution: {
      enabled: Boolean(executorAddress),
      executorAddress,
      mode: executorAddress ? 'OWNER_WALLET_SIMULATION_REQUIRED' : 'LOCKED',
    },
    x402,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
