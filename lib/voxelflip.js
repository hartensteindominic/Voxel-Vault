import { BrowserProvider, Contract } from 'ethers';
import { getInjectedProvider, getMetaMaskDeepLink } from './wallet-connect';

export const VOXELFLIP_CHAIN_ID = process.env.NEXT_PUBLIC_VOXELFLIP_CHAIN_ID || '0x2105';
export const VOXELFLIP_CHAIN_NAME = process.env.NEXT_PUBLIC_VOXELFLIP_CHAIN_NAME || 'Base';
export const VOXELFLIP_RPC_URL = process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || 'https://mainnet.base.org';
export const VOXELFLIP_EXPLORER_URL = process.env.NEXT_PUBLIC_VOXELFLIP_EXPLORER_URL || 'https://basescan.org';
export const VOXELFLIP_NFT_ADDRESS = process.env.NEXT_PUBLIC_VOXELFLIP_NFT_ADDRESS || '';

const ABI = [
  'function mintWithVoucher(string uri,bytes32 voucherId,bytes signature) returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)',
  'event VoxelFlipMinted(uint256 indexed tokenId,address indexed owner,bytes32 indexed voucherId,string tokenURI)',
];

let configCache = null;
let configCacheUntil = 0;

export async function getVoxelFlipPublicConfig({ refresh = false } = {}) {
  if (!refresh && configCache && configCacheUntil > Date.now()) return configCache;
  if (typeof window === 'undefined') {
    const address = VOXELFLIP_NFT_ADDRESS;
    return { configured: /^0x[a-fA-F0-9]{40}$/.test(address), address, chainId: VOXELFLIP_CHAIN_ID, chainName: VOXELFLIP_CHAIN_NAME, explorerUrl: VOXELFLIP_EXPLORER_URL };
  }
  const response = await fetch('/api/creator-pack/nft/config', { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'VoxelFlip collection configuration could not be loaded.');
  configCache = data;
  configCacheUntil = Date.now() + 30_000;
  return data;
}

function extractTokenId(receipt) {
  const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  for (const log of receipt?.logs || []) {
    if (log.topics?.[0]?.toLowerCase() === transferTopic && log.topics.length >= 4) {
      try { return BigInt(log.topics[3]).toString(); } catch {}
    }
  }
  return null;
}

async function ensureBase(provider) {
  let chainId = await provider.request({ method: 'eth_chainId' });
  if (chainId?.toLowerCase() === VOXELFLIP_CHAIN_ID.toLowerCase()) return chainId;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: VOXELFLIP_CHAIN_ID }] });
  } catch (error) {
    if (error?.code !== 4902) throw new Error(`Please switch your wallet to ${VOXELFLIP_CHAIN_NAME}.`);
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: VOXELFLIP_CHAIN_ID,
        chainName: VOXELFLIP_CHAIN_NAME,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: [VOXELFLIP_RPC_URL],
        blockExplorerUrls: [VOXELFLIP_EXPLORER_URL],
      }],
    });
  }
  chainId = await provider.request({ method: 'eth_chainId' });
  if (chainId?.toLowerCase() !== VOXELFLIP_CHAIN_ID.toLowerCase()) throw new Error(`Please switch your wallet to ${VOXELFLIP_CHAIN_NAME}.`);
  return chainId;
}

export async function connectVoxelFlipWallet() {
  if (typeof window === 'undefined') throw new Error('Wallet connection is available in the browser only.');
  const provider = getInjectedProvider();
  if (!provider) {
    const error = new Error('Open VoxelPop in MetaMask Mobile or install a compatible wallet to mint your NFT.');
    error.code = 'NO_WALLET_PROVIDER';
    error.deepLink = getMetaMaskDeepLink(window.location.href);
    throw error;
  }
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!accounts?.[0]) throw new Error('Wallet connection was cancelled.');
  const chainId = await ensureBase(provider);
  return { provider, address: accounts[0], chainId };
}

export async function mintVoxelFlip({ metadataUrl, voucherId, signature }) {
  const config = await getVoxelFlipPublicConfig({ refresh: true });
  const contractAddress = config?.address || VOXELFLIP_NFT_ADDRESS;
  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress || '')) throw new Error('VoxelFlip minting is not configured on this deployment yet.');
  if (!metadataUrl || !voucherId || !signature) throw new Error('The VoxelFlip mint voucher is incomplete.');
  const { provider, address } = await connectVoxelFlipWallet();
  const browserProvider = new BrowserProvider(provider);
  const signer = await browserProvider.getSigner(address);
  const contract = new Contract(contractAddress, ABI, signer);
  const tx = await contract.mintWithVoucher(metadataUrl, voucherId, signature);
  const receipt = await tx.wait();
  const tokenId = extractTokenId(receipt);
  return {
    tokenId,
    owner: address,
    hash: receipt?.hash || tx.hash,
    status: receipt?.status === 1 || receipt?.status === 1n ? 'confirmed' : 'submitted',
    explorerUrl: `${config?.explorerUrl || VOXELFLIP_EXPLORER_URL}/tx/${receipt?.hash || tx.hash}`,
    openSeaUrl: tokenId ? openSeaAssetUrl(tokenId, contractAddress, config?.chainId || VOXELFLIP_CHAIN_ID) : '',
  };
}

export function openSeaAssetUrl(tokenId, contractAddress = VOXELFLIP_NFT_ADDRESS, chainId = VOXELFLIP_CHAIN_ID) {
  if (!contractAddress || tokenId == null) return '';
  const id = String(tokenId);
  const chain = String(chainId || '').toLowerCase();
  if (chain === '0x14a34') return `https://testnets.opensea.io/assets/base_sepolia/${contractAddress}/${id}`;
  if (chain === '0xaa36a7') return `https://testnets.opensea.io/assets/sepolia/${contractAddress}/${id}`;
  if (chain === '0x1') return `https://opensea.io/assets/ethereum/${contractAddress}/${id}`;
  return `https://opensea.io/assets/base/${contractAddress}/${id}`;
}
