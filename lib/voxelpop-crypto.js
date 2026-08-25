import { getInjectedProvider, getMetaMaskDeepLink } from './wallet-connect';

const CHAINS = {
  8453: {
    chainId: '0x2105',
    chainName: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org'],
  },
  1: {
    chainId: '0x1',
    chainName: 'Ethereum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://cloudflare-eth.com'],
    blockExplorerUrls: ['https://etherscan.io'],
  },
};

async function switchChain(provider, numericChainId) {
  const config = CHAINS[numericChainId];
  if (!config) throw new Error('Unsupported ETH payment network.');
  let current = await provider.request({ method: 'eth_chainId' });
  if (current?.toLowerCase() === config.chainId.toLowerCase()) return config;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: config.chainId }] });
  } catch (error) {
    if (error?.code !== 4902 || numericChainId === 1) throw new Error(`Please switch your wallet to ${config.chainName}.`);
    await provider.request({ method: 'wallet_addEthereumChain', params: [config] });
  }
  current = await provider.request({ method: 'eth_chainId' });
  if (current?.toLowerCase() !== config.chainId.toLowerCase()) throw new Error(`Please switch your wallet to ${config.chainName}.`);
  return config;
}

export async function connectVoxelPopCryptoWallet(chainId = 8453) {
  if (typeof window === 'undefined') throw new Error('Wallet checkout is available in the browser only.');
  const provider = getInjectedProvider();
  if (!provider) {
    const error = new Error('Open VoxelPop in MetaMask Mobile or install a compatible wallet to pay with ETH.');
    error.code = 'NO_WALLET_PROVIDER';
    error.deepLink = getMetaMaskDeepLink(window.location.href);
    throw error;
  }
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!accounts?.[0]) throw new Error('Wallet connection was cancelled.');
  const config = await switchChain(provider, Number(chainId));
  return { provider, address: accounts[0], chainId: Number(chainId), chainName: config.chainName };
}

export async function sendVoxelPopEthPayment({ provider, from, receiver, amountWei }) {
  if (!provider || !from || !receiver || !amountWei) throw new Error('ETH payment details are incomplete.');
  const value = `0x${BigInt(String(amountWei)).toString(16)}`;
  const hash = await provider.request({ method: 'eth_sendTransaction', params: [{ from, to: receiver, value }] });
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash || '')) throw new Error('The wallet did not return a valid transaction hash.');
  return hash;
}
