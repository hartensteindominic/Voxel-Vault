import { Contract, JsonRpcProvider, getAddress, id, isAddress, keccak256, toUtf8Bytes, zeroPadValue } from 'ethers';
import { randomUUID } from 'node:crypto';
import { getVoxelFlipDeployment } from './voxelflip-deployment';

export const AI_LICENSE_VERSION = '1.0.0';
export const AI_LICENSE_KIND = 'single-machine-use-v1';
export const DEFAULT_AI_LICENSE_PRICE_ATOMIC = '10000'; // 0.01 USDC

const BASE_CHAIN_ID = 8453;
const TRANSFER_TOPIC = id('Transfer(address,address,uint256)');
const VOXELFLIP_MINT_TOPIC = id('VoxelFlipMinted(uint256,address,bytes32,string)');
const ERC721_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
];
const LOG_CHUNK = 8_000;
const MAX_CATALOG_ASSETS = 80;
const RPC_TIMEOUT_MS = 6_000;
const EVENT_SCAN_TIMEOUT_MS = 9_000;

type ProviderContext = {
  provider: JsonRpcProvider;
  source: string;
};

export type LicensableAsset = {
  chainId: 8453;
  network: 'Base';
  contract: string;
  tokenId: string;
  owner: string;
  tokenURI: string;
  collectionName: string;
  collectionSymbol: string;
  displayName: string;
};

function clean(value: unknown, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function rpcCandidates() {
  return Array.from(new Set([
    clean(process.env.BASE_RPC_URL, 1000),
    clean(process.env.VOXELFLIP_RPC_URL, 1000),
    clean(process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL, 1000),
    'https://base.blockscout.com/api/eth-rpc',
    'https://mainnet.base.org',
    'https://base-rpc.publicnode.com',
  ].filter(Boolean)));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function healthyProvider(): Promise<ProviderContext> {
  const errors: string[] = [];
  for (const rpc of rpcCandidates()) {
    const provider = new JsonRpcProvider(rpc, BASE_CHAIN_ID, { staticNetwork: true });
    try {
      await withTimeout(provider.getBlockNumber(), 4_000, 'Base RPC health check');
      let source = 'Base RPC';
      try { source = new URL(rpc).hostname || source; } catch {}
      return { provider, source };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      provider.destroy();
    }
  }
  throw new Error(`No Base RPC is available for AI-license ownership verification. ${errors.at(-1) || ''}`);
}

export function aiLicensePriceAtomic() {
  const raw = clean(process.env.X402_AI_LICENSE_PRICE_ATOMIC || DEFAULT_AI_LICENSE_PRICE_ATOMIC, 30);
  return /^\d+$/.test(raw) && BigInt(raw) > BigInt(0) ? raw : DEFAULT_AI_LICENSE_PRICE_ATOMIC;
}

export async function aiLicensorAddress() {
  const deployment = await getVoxelFlipDeployment();
  const configured = clean(process.env.AI_LICENSE_LICENSOR_WALLET, 80);
  if (isAddress(configured)) return getAddress(configured);
  return getAddress(deployment.owner);
}

async function deploymentContext(provider: JsonRpcProvider) {
  const deployment = await getVoxelFlipDeployment();
  if (Number(deployment.chainId) !== BASE_CHAIN_ID || !isAddress(deployment.address)) {
    throw new Error('Reviewed VoxelFlip Base deployment is unavailable.');
  }
  const contract = getAddress(deployment.address);
  const latest = await withTimeout(provider.getBlockNumber(), RPC_TIMEOUT_MS, 'Base latest block');
  let first = Math.max(0, latest - 500_000);
  if (deployment.deploymentTxHash) {
    const receipt = await withTimeout(
      provider.getTransactionReceipt(deployment.deploymentTxHash),
      RPC_TIMEOUT_MS,
      'VoxelFlip deployment receipt',
    ).catch(() => null);
    if (receipt?.blockNumber != null) first = Number(receipt.blockNumber);
  }
  return { deployment, contract, first, latest };
}

async function collectionIdentity(contract: Contract) {
  const [name, symbol] = await Promise.all([
    withTimeout(contract.name(), RPC_TIMEOUT_MS, 'collection name').catch(() => 'VoxelFlip'),
    withTimeout(contract.symbol(), RPC_TIMEOUT_MS, 'collection symbol').catch(() => 'VOXEL'),
  ]);
  return { name: clean(name, 100) || 'VoxelFlip', symbol: clean(symbol, 40) || 'VOXEL' };
}

async function resolveOnProvider(
  provider: JsonRpcProvider,
  contractAddress: string,
  tokenId: string,
  licensor: string,
): Promise<LicensableAsset> {
  if (!/^\d+$/.test(tokenId)) throw new Error('tokenId must be a positive integer string.');
  const nft = new Contract(contractAddress, ERC721_ABI, provider);
  const owner = getAddress(String(await withTimeout(nft.ownerOf(tokenId), RPC_TIMEOUT_MS, 'ownerOf')));
  if (owner !== licensor) {
    throw new Error('This NFT is not currently owned by the configured Voxel Vault licensor, so no machine-use license can be sold for it.');
  }
  const [tokenURI, identity] = await Promise.all([
    withTimeout(nft.tokenURI(tokenId), RPC_TIMEOUT_MS, 'tokenURI').then(value => clean(value, 2_000)).catch(() => ''),
    collectionIdentity(nft),
  ]);
  if (!tokenURI) throw new Error('This NFT has no readable tokenURI, so it is not eligible for machine licensing.');
  return {
    chainId: 8453,
    network: 'Base',
    contract: getAddress(contractAddress),
    tokenId,
    owner,
    tokenURI,
    collectionName: identity.name,
    collectionSymbol: identity.symbol,
    displayName: `${identity.name} #${tokenId}`,
  };
}

export async function resolveLicensableAsset(tokenIdInput: unknown): Promise<LicensableAsset> {
  const tokenId = clean(tokenIdInput, 80);
  if (!/^\d+$/.test(tokenId)) throw new Error('A numeric VoxelFlip tokenId is required.');
  const licensor = await aiLicensorAddress();
  const { provider } = await healthyProvider();
  try {
    const { contract } = await deploymentContext(provider);
    return await resolveOnProvider(provider, contract, tokenId, licensor);
  } finally {
    provider.destroy();
  }
}

async function candidateTokenIds(provider: JsonRpcProvider, contract: string, licensor: string, first: number, latest: number) {
  const ownerTopic = zeroPadValue(licensor, 32);
  const found = new Set<string>();
  for (let start = first; start <= latest && found.size < MAX_CATALOG_ASSETS * 3; start += LOG_CHUNK) {
    const end = Math.min(latest, start + LOG_CHUNK - 1);
    const [transferLogs, mintLogs] = await withTimeout(Promise.all([
      provider.getLogs({ address: contract, fromBlock: start, toBlock: end, topics: [TRANSFER_TOPIC, null, ownerTopic] }),
      provider.getLogs({ address: contract, fromBlock: start, toBlock: end, topics: [VOXELFLIP_MINT_TOPIC, null, ownerTopic] }),
    ]), EVENT_SCAN_TIMEOUT_MS, 'VoxelFlip license catalog event scan');
    for (const log of transferLogs) {
      const topic = log.topics?.[3];
      if (!topic) continue;
      try { found.add(BigInt(topic).toString()); } catch {}
    }
    for (const log of mintLogs) {
      const topic = log.topics?.[1];
      if (!topic) continue;
      try { found.add(BigInt(topic).toString()); } catch {}
    }
  }
  return Array.from(found).slice(-MAX_CATALOG_ASSETS * 2).reverse();
}

export async function listLicensableAssets(limitInput: unknown = 24) {
  const limit = Math.max(1, Math.min(MAX_CATALOG_ASSETS, Number(limitInput) || 24));
  const licensor = await aiLicensorAddress();
  const { provider, source } = await healthyProvider();
  try {
    const { contract, first, latest } = await deploymentContext(provider);
    const ids = await candidateTokenIds(provider, contract, licensor, first, latest);
    const assets: LicensableAsset[] = [];
    for (let index = 0; index < ids.length && assets.length < limit; index += 8) {
      const batch = ids.slice(index, index + 8);
      const resolved = await Promise.all(batch.map(tokenId =>
        resolveOnProvider(provider, contract, tokenId, licensor).catch(() => null),
      ));
      for (const asset of resolved) {
        if (asset) assets.push(asset);
        if (assets.length >= limit) break;
      }
    }
    return {
      assets,
      licensor,
      contract,
      chainId: 8453,
      network: 'Base',
      rpcSource: source,
      priceAtomicUsdc: aiLicensePriceAtomic(),
      licenseKind: AI_LICENSE_KIND,
    };
  } finally {
    provider.destroy();
  }
}

export function buildSingleUseMachineLicense(asset: LicensableAsset, input: {
  useCase?: unknown;
  clientId?: unknown;
}) {
  const issuedAt = new Date().toISOString();
  const nonce = randomUUID();
  const useCase = clean(input.useCase, 240) || 'machine inference / tool use';
  const clientId = clean(input.clientId, 120) || 'unspecified-agent';
  const licenseId = keccak256(toUtf8Bytes([
    AI_LICENSE_KIND,
    asset.contract.toLowerCase(),
    asset.tokenId,
    clientId,
    useCase,
    issuedAt,
    nonce,
  ].join('|')));
  return {
    licenseId,
    version: AI_LICENSE_VERSION,
    kind: AI_LICENSE_KIND,
    issuedAt,
    asset: {
      chainId: asset.chainId,
      network: asset.network,
      contract: asset.contract,
      tokenId: asset.tokenId,
      ownerAtIssue: asset.owner,
      tokenURI: asset.tokenURI,
      displayName: asset.displayName,
    },
    licensee: { clientId },
    declaredUseCase: useCase,
    grant: {
      units: 1,
      scope: 'One machine request, inference, tool action, or generated-output workflow that consumes, references, renders, or transforms the licensed asset.',
      nonExclusive: true,
      nonTransferable: true,
      sublicensingAllowed: false,
      ownershipTransferred: false,
      modelTrainingAllowed: false,
      resaleOfAssetAllowed: false,
      attributionRequired: false,
    },
    repeatUse: 'A new x402 license payment is required for each additional machine-use unit.',
    rightsNotice: 'This receipt licenses only rights actually controlled by the configured licensor. NFT ownership by itself is not a representation that copyright or trademark rights were transferred.',
    proof: {
      settlement: 'The enclosing x402 PAYMENT-RESPONSE and payment.transaction are the settlement proof for this license receipt.',
      onchainOwnershipCheckedAtIssue: true,
    },
  };
}
