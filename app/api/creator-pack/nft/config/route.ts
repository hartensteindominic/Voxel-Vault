import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';

export async function GET() {
  const deployment = await getVoxelFlipDeployment();
  const address = deployment?.address || '';
  return NextResponse.json({
    configured: Boolean(address),
    address: address || null,
    chainId: '0x2105',
    chainName: 'Base',
    rpcUrl: process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || 'https://mainnet.base.org',
    explorerUrl: process.env.NEXT_PUBLIC_VOXELFLIP_EXPLORER_URL || 'https://basescan.org',
    openSeaUrl: address ? `https://opensea.io/assets/base/${address}` : null,
    royaltyBps: deployment?.royaltyBps ?? 500,
    royaltyPercent: (deployment?.royaltyBps ?? 500) / 100,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
