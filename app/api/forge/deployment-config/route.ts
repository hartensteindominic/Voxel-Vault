import { parseEther } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';
import { getRevenueForgeDeployment, revenueForgeSigningWallet } from '../../../../lib/forge-revenue-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LAUNCH_FEE_WEI = parseEther('0.001');
const LAUNCH_ROYALTY_BPS = 500;

export async function GET() {
  try {
    const parent = await getVoxelFlipDeployment();
    const signer = revenueForgeSigningWallet();
    const existing = await getRevenueForgeDeployment();

    return NextResponse.json({
      chainId: 8453,
      network: 'base',
      forgeSigner: signer.address,
      parentCollection: parent.address,
      feeWei: LAUNCH_FEE_WEI.toString(),
      feeEth: '0.001',
      royaltyBps: LAUNCH_ROYALTY_BPS,
      existingDeployment: existing,
      safety: 'Owner and treasury are set to the wallet that approves the Base deployment transaction. The Forge signer is a separate server-derived address; its private key is never sent to the browser.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Forge deployment config failed', error);
    return NextResponse.json({ error: 'The production Forge deployment configuration is not ready on this server.' }, { status: 503 });
  }
}
