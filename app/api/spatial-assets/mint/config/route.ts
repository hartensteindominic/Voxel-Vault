import { formatEther } from 'ethers';
import { NextResponse } from 'next/server';
import {
  assertSpatialMintServerReady,
  spatialMintChainId,
  spatialMintContract,
  spatialMintContractAddress,
  spatialMintExplorerUrl,
  spatialMintProvider,
  spatialMintServerEnabled,
} from '../../../../../lib/spatial-mint-server';

export const runtime = 'nodejs';

export async function GET() {
  if (!spatialMintServerEnabled()) {
    return NextResponse.json({
      enabled: false,
      chainId: spatialMintChainId(),
      contractAddress: spatialMintContractAddress() || null,
      reason: 'Experimental spatial minting is disabled until the Base Sepolia deployment is reviewed.',
    });
  }

  let provider: any = null;
  try {
    const config = assertSpatialMintServerReady();
    provider = spatialMintProvider();
    const contract = spatialMintContract(provider);
    const [feeWei, paused, voucherSigner, feeRecipient] = await Promise.all([
      contract.mintFeeWei(),
      contract.paused(),
      contract.voucherSigner(),
      contract.feeRecipient(),
    ]);
    return NextResponse.json({
      enabled: true,
      chainId: config.chainId,
      chainName: config.chainId === 84532 ? 'Base Sepolia' : 'Base Mainnet',
      contractAddress: config.contractAddress,
      explorerUrl: spatialMintExplorerUrl(),
      paused: Boolean(paused),
      voucherSigner: String(voucherSigner),
      feeRecipient: String(feeRecipient),
      platformFeeWei: feeWei.toString(),
      platformFeeEth: formatEther(feeWei),
      gasNotice: 'Network gas is separate from the VoxelVault platform fee and is paid by your wallet to the blockchain network.',
    });
  } catch (error) {
    console.error('spatial mint config failed', error);
    return NextResponse.json({ enabled: false, error: error instanceof Error ? error.message : 'Spatial mint configuration unavailable.' }, { status: 503 });
  } finally {
    provider?.destroy?.();
  }
}
