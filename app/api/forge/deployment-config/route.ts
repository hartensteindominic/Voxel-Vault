import { parseEther } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';
import { getRevenueForgeDeployment, revenueForgeSigningWallet } from '../../../../lib/forge-revenue-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LAUNCH_FEE_WEI = parseEther('0.001');
const LAUNCH_ROYALTY_BPS = 500;
const EXISTING_BASE_CANDIDATE = '0x34d7E9d8Cae07B61eb1f0c1dABD4876F2429cd3D';

export async function GET() {
  try {
    const parent = await getVoxelFlipDeployment();
    const signer = revenueForgeSigningWallet();
    const existing = await getRevenueForgeDeployment();

    return NextResponse.json({
      chainId: 8453,
      network: 'base',
      requiredOwner: parent.owner,
      forgeSigner: signer.address,
      parentCollection: parent.address,
      feeWei: LAUNCH_FEE_WEI.toString(),
      feeEth: '0.001',
      royaltyBps: LAUNCH_ROYALTY_BPS,
      existingDeployment: existing,
      pendingCandidateAddress: existing ? null : EXISTING_BASE_CANDIDATE,
      safety: 'Only the reviewed VoxelFlip owner wallet may deploy/register this production Forge. That wallet is also the treasury. The Forge signer is a distinct server-derived address whose private key never reaches the browser.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Forge deployment config failed', error);
    return NextResponse.json({ error: 'The production Forge deployment configuration is not ready on this server.' }, { status: 503 });
  }
}
