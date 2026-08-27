import { getVoxelFlipPublicConfig, mintVoxelFlip, openSeaAssetUrl } from './voxelflip';
import { BASE_SEPOLIA } from './web3-wallet';

export type SpatialMintReview = {
  enabled: boolean;
  chainId: string;
  chainName: string;
  contractAddress: string;
  platformFeeWei: string;
  platformFeeEth: string;
  gasNotice: string;
};

export function spatialMintEnabled() {
  return process.env.NEXT_PUBLIC_SPATIAL_MINT_ENABLED === 'true';
}

export function spatialMintRequiredChainId() {
  return (process.env.NEXT_PUBLIC_SPATIAL_MINT_CHAIN_ID || BASE_SEPOLIA.chainId).toLowerCase();
}

export async function getSpatialMintReview(): Promise<SpatialMintReview> {
  const config = await getVoxelFlipPublicConfig({ refresh: true });
  const contractAddress = String(config?.address || '');
  const configChain = String(config?.chainId || '').toLowerCase();
  const requiredChain = spatialMintRequiredChainId();
  const enabled = spatialMintEnabled();

  if (enabled && configChain !== requiredChain) {
    throw new Error(`Spatial minting is gated to chain ${requiredChain}, but the configured VoxelFlip contract is on ${configChain || 'an unknown chain'}.`);
  }
  if (enabled && !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    throw new Error('Spatial minting is enabled but no reviewed NFT contract is configured.');
  }

  return {
    enabled,
    chainId: requiredChain,
    chainName: requiredChain === BASE_SEPOLIA.chainId ? BASE_SEPOLIA.name : String(config?.chainName || 'Configured network'),
    contractAddress,
    platformFeeWei: '0',
    platformFeeEth: '0',
    gasNotice: 'Network gas is estimated and paid by the connected wallet to the blockchain network. VoxelVault does not receive network gas.',
  };
}

export async function dispatchReviewedSpatialMint(input: { metadataUrl: string; voucherId: string; signature: string }) {
  const review = await getSpatialMintReview();
  if (!review.enabled) throw new Error('Spatial minting is still in testnet review mode. Use the existing reviewed VoxelFlip mint page for production minting.');
  if (review.chainId !== BASE_SEPOLIA.chainId && process.env.NEXT_PUBLIC_SPATIAL_ALLOW_MAINNET !== 'true') {
    throw new Error('Experimental spatial minting refuses mainnet until NEXT_PUBLIC_SPATIAL_ALLOW_MAINNET is explicitly reviewed and enabled.');
  }
  return mintVoxelFlip(input);
}

export function spatialMintOpenSeaUrl(tokenId: string | number, contractAddress: string, chainId = spatialMintRequiredChainId()) {
  return openSeaAssetUrl(tokenId, contractAddress, chainId);
}

export function reviewedMintPageHref(sourceSessionId: string | null | undefined) {
  if (!sourceSessionId) return '/studio';
  return `/voxelflip/mint?${new URLSearchParams({ session_id: sourceSessionId }).toString()}`;
}
