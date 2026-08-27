import { BrowserProvider, Contract } from 'ethers';
import { openSeaAssetUrl } from './voxelflip';
import { BASE_SEPOLIA, connectSpatialWallet, ensureBaseSepolia } from './web3-wallet';

export type SpatialMintReview = {
  enabled: boolean;
  chainId: number;
  chainName: string;
  contractAddress: string;
  platformFeeWei: string;
  platformFeeEth: string;
  gasNotice: string;
  paused?: boolean;
};

export type PreparedSpatialMint = {
  assetId: string;
  wallet: string;
  chainId: number;
  chainName: string;
  contractAddress: string;
  metadataUrl: string;
  voucherId: string;
  signature: string;
  platformFeeWei: string;
  platformFeeEth: string;
  gasNotice: string;
};

const ABI = [
  'function mintWithVoucher(string uri,bytes32 voucherId,bytes signature) payable returns (uint256)',
  'event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)',
  'event SpatialVoxelMinted(uint256 indexed tokenId,address indexed owner,bytes32 indexed voucherId,string tokenURI)',
];
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export function spatialMintEnabled() {
  return process.env.NEXT_PUBLIC_SPATIAL_MINT_ENABLED === 'true';
}

export function spatialMintRequiredChainId() {
  return (process.env.NEXT_PUBLIC_SPATIAL_MINT_CHAIN_ID || BASE_SEPOLIA.chainId).toLowerCase();
}

export async function getSpatialMintReview(): Promise<SpatialMintReview> {
  const response = await fetch('/api/spatial-assets/mint/config', { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 503) throw new Error(data?.error || 'Spatial mint configuration unavailable.');
  return {
    enabled: Boolean(data?.enabled),
    chainId: Number(data?.chainId || 84532),
    chainName: String(data?.chainName || 'Base Sepolia'),
    contractAddress: String(data?.contractAddress || ''),
    platformFeeWei: String(data?.platformFeeWei || '0'),
    platformFeeEth: String(data?.platformFeeEth || '0'),
    gasNotice: String(data?.gasNotice || 'Network gas is separate from any VoxelVault platform fee.'),
    paused: Boolean(data?.paused),
  };
}

function extractTokenId(receipt: any, contractAddress: string, wallet: string) {
  const target = contractAddress.toLowerCase();
  const ownerTopic = `0x${wallet.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;
  for (const log of receipt?.logs || []) {
    if (String(log?.address || '').toLowerCase() !== target) continue;
    if (String(log?.topics?.[0] || '').toLowerCase() !== TRANSFER_TOPIC) continue;
    if (String(log?.topics?.[2] || '').toLowerCase() !== ownerTopic) continue;
    try { return BigInt(log.topics[3]).toString(); } catch {}
  }
  return null;
}

export async function dispatchReviewedSpatialMint(input: PreparedSpatialMint) {
  if (!input.assetId || !/^0x[a-fA-F0-9]{40}$/.test(input.wallet) || !/^0x[a-fA-F0-9]{40}$/.test(input.contractAddress)) {
    throw new Error('Spatial mint preparation is incomplete.');
  }
  if (input.chainId !== BASE_SEPOLIA.chainIdDecimal && process.env.NEXT_PUBLIC_SPATIAL_ALLOW_MAINNET !== 'true') {
    throw new Error('Experimental spatial minting is locked to Base Sepolia.');
  }
  if (!input.metadataUrl || !/^0x[a-fA-F0-9]{64}$/.test(input.voucherId) || !/^0x[a-fA-F0-9]{130}$/.test(input.signature)) {
    throw new Error('Spatial mint voucher is incomplete.');
  }

  const connected = await connectSpatialWallet();
  if (connected.address.toLowerCase() !== input.wallet.toLowerCase()) {
    throw new Error(`MetaMask is connected to ${connected.address}, but this mint was prepared for ${input.wallet}.`);
  }
  if (input.chainId === BASE_SEPOLIA.chainIdDecimal) await ensureBaseSepolia(connected.provider);
  const activeChain = Number.parseInt(String(await connected.provider.request({ method: 'eth_chainId' })), 16);
  if (activeChain !== input.chainId) throw new Error(`Switch MetaMask to ${input.chainName} before minting.`);

  let value: bigint;
  try { value = BigInt(input.platformFeeWei || '0'); }
  catch { throw new Error('Prepared platform fee is invalid.'); }
  if (value < 0n) throw new Error('Prepared platform fee is invalid.');

  const browserProvider = new BrowserProvider(connected.provider);
  const signer = await browserProvider.getSigner(connected.address);
  const contract = new Contract(input.contractAddress, ABI, signer);
  const tx = await contract.mintWithVoucher(input.metadataUrl, input.voucherId, input.signature, { value });
  const receipt = await tx.wait();
  if (!receipt || !(receipt.status === 1 || receipt.status === 1n)) throw new Error('The spatial mint transaction did not confirm successfully.');
  const tokenId = extractTokenId(receipt, input.contractAddress, connected.address);
  if (!tokenId) throw new Error('The mint confirmed, but the token ID could not be read. Use verification/recovery instead of minting again.');
  const hash = String(receipt.hash || tx.hash || '');
  return {
    tokenId,
    owner: connected.address,
    hash,
    txHash: hash,
    metadataUrl: input.metadataUrl,
    voucherId: input.voucherId,
    contractAddress: input.contractAddress,
    chainId: input.chainId,
    platformFeeWei: input.platformFeeWei,
  };
}

export function spatialMintOpenSeaUrl(tokenId: string | number, contractAddress: string, chainId = spatialMintRequiredChainId()) {
  return openSeaAssetUrl(tokenId, contractAddress, chainId);
}

export function reviewedMintPageHref(sourceSessionId: string | null | undefined) {
  if (!sourceSessionId) return '/studio';
  return `/voxelflip/mint?${new URLSearchParams({ session_id: sourceSessionId }).toString()}`;
}
