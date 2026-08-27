export type SpatialAssetState = 'draft' | 'generating' | 'generated' | 'saved' | 'mint_pending' | 'minted' | 'mint_failed' | 'archived';
export type SpatialAssetSource = 'manual' | 'voxelpop' | 'wallet_import';

export type SpatialAsset = {
  id: string;
  ownerUserId: string;
  sourceKind: SpatialAssetSource;
  sourceSessionId: string | null;
  sourceTaskId: string | null;
  title: string;
  description: string;
  prompt: string;
  imageUrl: string | null;
  modelUrl: string | null;
  state: SpatialAssetState;
  favorite: boolean;
  collectionName: string;
  chainId: number | null;
  contractAddress: string | null;
  tokenId: string | null;
  transactionHash: string | null;
  ownerWallet: string | null;
  metadataUri: string | null;
  auditHash: string | null;
  createdAt: string;
  updatedAt: string;
};

export const SPATIAL_ASSET_STATES: readonly SpatialAssetState[] = [
  'draft', 'generating', 'generated', 'saved', 'mint_pending', 'minted', 'mint_failed', 'archived',
] as const;

export function isSpatialAssetState(value: unknown): value is SpatialAssetState {
  return SPATIAL_ASSET_STATES.includes(String(value || '') as SpatialAssetState);
}

export function shortWallet(value: string | null | undefined) {
  const wallet = String(value || '');
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) return '';
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

export function spatialAssetStatusLabel(asset: Pick<SpatialAsset, 'state' | 'tokenId'>) {
  if (asset.state === 'minted' && asset.tokenId) return `MINTED #${asset.tokenId}`;
  if (asset.state === 'mint_pending') return 'MINT PENDING';
  if (asset.state === 'generated' || asset.state === 'saved') return '3D READY';
  if (asset.state === 'generating') return 'BUILDING 3D';
  if (asset.state === 'mint_failed') return 'MINT NEEDS ATTENTION';
  return asset.state.replaceAll('_', ' ').toUpperCase();
}

export function openSeaUrlForSpatialAsset(asset: Pick<SpatialAsset, 'chainId' | 'contractAddress' | 'tokenId'>) {
  if (!asset.contractAddress || !asset.tokenId) return '';
  const contract = asset.contractAddress;
  if (asset.chainId === 84532) return `https://testnets.opensea.io/assets/base_sepolia/${contract}/${asset.tokenId}`;
  if (asset.chainId === 11155111) return `https://testnets.opensea.io/assets/sepolia/${contract}/${asset.tokenId}`;
  if (asset.chainId === 1) return `https://opensea.io/assets/ethereum/${contract}/${asset.tokenId}`;
  return `https://opensea.io/assets/base/${contract}/${asset.tokenId}`;
}
