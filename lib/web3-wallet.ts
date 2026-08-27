import { formatEther } from 'ethers';
import { discoverMetaMaskProvider, getMetaMaskDeepLink } from './wallet-connect';

export const BASE_MAINNET = {
  chainId: '0x2105',
  chainIdDecimal: 8453,
  name: 'Base Mainnet',
  rpcUrl: 'https://mainnet.base.org',
  explorerUrl: 'https://base.blockscout.com',
} as const;

export const BASE_SEPOLIA = {
  chainId: '0x14a34',
  chainIdDecimal: 84532,
  name: 'Base Sepolia',
  rpcUrl: 'https://sepolia.base.org',
  explorerUrl: 'https://sepolia-explorer.base.org',
} as const;

export type SpatialWalletConnection = {
  provider: any;
  address: string;
  chainId: string;
  chainIdDecimal: number;
};

function validAddress(value: unknown) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ''));
}

export async function connectSpatialWallet(): Promise<SpatialWalletConnection> {
  if (typeof window === 'undefined') throw new Error('Wallet connection is available in the browser only.');
  const provider: any = await discoverMetaMaskProvider();
  if (!provider) {
    const error: any = new Error('MetaMask was not detected. Open VoxelVault inside MetaMask Mobile or install the extension.');
    error.code = 'NO_WALLET_PROVIDER';
    error.deepLink = getMetaMaskDeepLink(window.location.href);
    throw error;
  }
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  const address = String(accounts?.[0] || '');
  if (!validAddress(address)) throw new Error('Wallet connection was cancelled.');
  const chainId = String(await provider.request({ method: 'eth_chainId' }) || '0x0').toLowerCase();
  return { provider, address, chainId, chainIdDecimal: Number.parseInt(chainId, 16) || 0 };
}

export async function ensureBaseSepolia(provider: any) {
  const current = String(await provider.request({ method: 'eth_chainId' }) || '').toLowerCase();
  if (current === BASE_SEPOLIA.chainId) return BASE_SEPOLIA.chainId;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_SEPOLIA.chainId }] });
  } catch (error: any) {
    if (error?.code !== 4902) throw new Error('Switch to Base Sepolia in your wallet to use experimental spatial minting.');
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: BASE_SEPOLIA.chainId,
        chainName: BASE_SEPOLIA.name,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: [BASE_SEPOLIA.rpcUrl],
        blockExplorerUrls: [BASE_SEPOLIA.explorerUrl],
      }],
    });
  }
  const next = String(await provider.request({ method: 'eth_chainId' }) || '').toLowerCase();
  if (next !== BASE_SEPOLIA.chainId) throw new Error('Base Sepolia was not selected.');
  return next;
}

export async function signWalletLinkMessage(provider: any, address: string, message: string) {
  if (!validAddress(address) || !message) throw new Error('Wallet proof request is incomplete.');
  const signature = await provider.request({ method: 'personal_sign', params: [message, address] });
  if (!/^0x[a-fA-F0-9]{130}$/.test(String(signature || ''))) throw new Error('Wallet signature was not returned.');
  return String(signature);
}

export async function readWalletBalance(provider: any, address: string) {
  if (!validAddress(address)) return { wei: '0', eth: '0' };
  const hex = String(await provider.request({ method: 'eth_getBalance', params: [address, 'latest'] }) || '0x0');
  let wei = BigInt(0);
  try { wei = BigInt(hex); } catch {}
  return { wei: wei.toString(), eth: formatEther(wei) };
}

export function spatialNetworkLabel(chainId: string | number | null | undefined) {
  const value = typeof chainId === 'number' ? chainId : Number.parseInt(String(chainId || '0x0'), 16);
  if (value === BASE_MAINNET.chainIdDecimal) return BASE_MAINNET.name;
  if (value === BASE_SEPOLIA.chainIdDecimal) return BASE_SEPOLIA.name;
  if (!value) return 'Not connected';
  return `Chain ${value}`;
}
