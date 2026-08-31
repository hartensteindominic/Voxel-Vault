import { createHash, randomUUID } from 'node:crypto';
import {
  BASE_CHAIN_ID,
  clean,
  DEFAULT_RECEIVER,
  DEFAULT_VOXELFLIP_CONTRACT,
  DEFAULT_VOXELFLIP_DEPLOYMENT_TX,
  isAddress,
  requireAddress
} from './config';
import { licensePrice, x402Status } from './x402';

export const LICENSE_KIND = 'single-machine-use-v1';
export const LICENSE_VERSION = '1.0.0';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const OWNER_OF_SELECTOR = '0x6352211e';
const TOKEN_URI_SELECTOR = '0xc87b56dd';
const NAME_SELECTOR = '0x06fdde03';
const SYMBOL_SELECTOR = '0x95d89b41';
const LOG_CHUNK = 8000;
const MAX_SCAN_TOKENS = 120;

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

type JsonRpcResponse<T> = {
  result?: T;
  error?: { message?: string };
};

function rpcUrl() {
  return clean(process.env.BASE_RPC_URL, 1200) || 'https://mainnet.base.org';
}

function contractAddress() {
  return requireAddress(process.env.VOXELFLIP_CONTRACT_ADDRESS, DEFAULT_VOXELFLIP_CONTRACT);
}

function licensorAddress() {
  return requireAddress(process.env.AI_LICENSE_LICENSOR_WALLET, DEFAULT_RECEIVER);
}

function deploymentTx() {
  const configured = clean(process.env.VOXELFLIP_DEPLOYMENT_TX, 100);
  return /^0x[a-fA-F0-9]{64}$/.test(configured) ? configured : DEFAULT_VOXELFLIP_DEPLOYMENT_TX;
}

function toQuantity(value: number | bigint) {
  return `0x${BigInt(value).toString(16)}`;
}

function uint256(value: string) {
  if (!/^\d+$/.test(value)) throw new Error('tokenId must be numeric.');
  return BigInt(value).toString(16).padStart(64, '0');
}

function normalizeAddress(value: string) {
  return value.toLowerCase();
}

function addressTopic(address: string) {
  return `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;
}

async function rpc<T>(method: string, params: unknown[], timeoutMs = 8000): Promise<T> {
  const response = await fetch(rpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`Base RPC returned HTTP ${response.status}`);
  const body = (await response.json()) as JsonRpcResponse<T>;
  if (body.error) throw new Error(body.error.message || `Base RPC ${method} failed`);
  return body.result as T;
}

async function ethCall(to: string, data: string) {
  const result = await rpc<string>('eth_call', [{ to, data }, 'latest']);
  if (!result || result === '0x') throw new Error('empty contract response');
  return result;
}

function decodeAddress(data: string) {
  const raw = data.replace(/^0x/, '').padStart(64, '0');
  return `0x${raw.slice(-40)}`;
}

function decodeAbiString(data: string) {
  const hex = data.replace(/^0x/, '');
  if (hex.length < 128) return '';
  const length = Number(BigInt(`0x${hex.slice(64, 128)}`));
  if (!Number.isFinite(length) || length < 0) return '';
  const raw = hex.slice(128, 128 + length * 2);
  const bytes = raw.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [];
  return new TextDecoder().decode(new Uint8Array(bytes)).replace(/\0+$/g, '');
}

async function ownerOf(tokenId: string) {
  return decodeAddress(await ethCall(contractAddress(), `${OWNER_OF_SELECTOR}${uint256(tokenId)}`));
}

async function tokenURI(tokenId: string) {
  return decodeAbiString(await ethCall(contractAddress(), `${TOKEN_URI_SELECTOR}${uint256(tokenId)}`));
}

async function collectionText(selector: string, fallback: string) {
  try {
    const decoded = decodeAbiString(await ethCall(contractAddress(), selector));
    return clean(decoded, 80) || fallback;
  } catch {
    return fallback;
  }
}

async function deploymentStartBlock() {
  const configured = Number(process.env.VOXELFLIP_DEPLOY_BLOCK || 0);
  if (Number.isInteger(configured) && configured > 0) return configured;
  try {
    const receipt = await rpc<{ blockNumber?: string }>('eth_getTransactionReceipt', [deploymentTx()]);
    if (receipt?.blockNumber) return Number.parseInt(receipt.blockNumber, 16);
  } catch {
    return 0;
  }
  return 0;
}

function configuredTokenIds() {
  return Array.from(new Set(
    clean(process.env.LICENSE_TOKEN_IDS, 1000)
      .split(',')
      .map(value => clean(value, 40))
      .filter(value => /^\d+$/.test(value))
  ));
}

async function scanCandidateTokenIds(limit: number) {
  const configured = configuredTokenIds();
  if (configured.length > 0) return configured.slice(0, limit);

  const latestHex = await rpc<string>('eth_blockNumber', []);
  const latest = Number.parseInt(latestHex, 16);
  const start = Math.max(0, await deploymentStartBlock() || latest - 300000);
  const ownerTopic = addressTopic(licensorAddress());
  const found = new Set<string>();

  for (let from = start; from <= latest && found.size < MAX_SCAN_TOKENS; from += LOG_CHUNK) {
    const to = Math.min(latest, from + LOG_CHUNK - 1);
    const logs = await rpc<Array<{ topics?: string[] }>>('eth_getLogs', [{
      address: contractAddress(),
      fromBlock: toQuantity(from),
      toBlock: toQuantity(to),
      topics: [TRANSFER_TOPIC, null, ownerTopic]
    }], 12000).catch(() => []);

    for (const log of logs) {
      const tokenTopic = log.topics?.[3];
      if (!tokenTopic) continue;
      try {
        found.add(BigInt(tokenTopic).toString());
      } catch {
        // Ignore malformed logs from nonstandard RPCs.
      }
    }
  }

  return Array.from(found).reverse().slice(0, limit);
}

export async function resolveLicensableAsset(tokenIdInput: unknown): Promise<LicensableAsset> {
  const tokenId = clean(tokenIdInput, 80);
  if (!/^\d+$/.test(tokenId)) throw new Error('A numeric VoxelFlip token ID is required.');

  const [owner, uri, name, symbol] = await Promise.all([
    ownerOf(tokenId),
    tokenURI(tokenId),
    collectionText(NAME_SELECTOR, 'VoxelFlip'),
    collectionText(SYMBOL_SELECTOR, 'VOXEL')
  ]);

  const licensor = licensorAddress();
  if (!isAddress(owner) || normalizeAddress(owner) !== normalizeAddress(licensor)) {
    throw new Error('This token is not currently owned by the configured Galactic licensor wallet.');
  }
  if (!uri) throw new Error('This token has no readable tokenURI.');

  return {
    chainId: BASE_CHAIN_ID,
    network: 'Base',
    contract: contractAddress(),
    tokenId,
    owner,
    tokenURI: uri,
    collectionName: name,
    collectionSymbol: symbol,
    displayName: `${name} #${tokenId}`
  };
}

export async function listLicensableAssets(limitInput: unknown = 24) {
  const limit = Math.max(1, Math.min(80, Number(limitInput) || 24));
  const ids = await scanCandidateTokenIds(Math.min(MAX_SCAN_TOKENS, limit * 4));
  const assets: LicensableAsset[] = [];

  for (const tokenId of ids) {
    try {
      assets.push(await resolveLicensableAsset(tokenId));
    } catch {
      // Ownership can move. Only currently valid assets stay in the catalog.
    }
    if (assets.length >= limit) break;
  }

  return {
    name: 'Galactic x402 AI Asset Licensing Catalog',
    version: LICENSE_VERSION,
    licenseKind: LICENSE_KIND,
    model: 'pay-per-machine-use',
    repeatUseRequiresNewPayment: true,
    price: licensePrice(),
    x402: x402Status(),
    licensor: licensorAddress(),
    contract: contractAddress(),
    chainId: BASE_CHAIN_ID,
    network: 'Base',
    assets,
    rightsNotice: 'Catalog inclusion means the token is currently owned by the configured licensor wallet. NFT ownership alone does not prove copyright ownership; licenses cover only rights the licensor actually controls.'
  };
}

export function buildSingleUseMachineLicense(asset: LicensableAsset, input: { clientId?: unknown; useCase?: unknown }) {
  const issuedAt = new Date().toISOString();
  const clientId = clean(input.clientId, 120) || 'unspecified-agent';
  const declaredUseCase = clean(input.useCase, 240) || 'machine inference or generated-output workflow';
  const nonce = randomUUID();
  const licenseId = createHash('sha256')
    .update([LICENSE_KIND, asset.contract.toLowerCase(), asset.tokenId, clientId, declaredUseCase, issuedAt, nonce].join('|'))
    .digest('hex');

  return {
    licenseId: `0x${licenseId}`,
    version: LICENSE_VERSION,
    kind: LICENSE_KIND,
    issuedAt,
    asset: {
      chainId: asset.chainId,
      network: asset.network,
      contract: asset.contract,
      tokenId: asset.tokenId,
      ownerAtIssue: asset.owner,
      tokenURI: asset.tokenURI,
      displayName: asset.displayName
    },
    licensee: { clientId },
    declaredUseCase,
    grant: {
      units: 1,
      scope: 'One machine request, inference, tool action, or generated-output workflow that consumes, references, renders, or transforms the licensed asset.',
      nonExclusive: true,
      nonTransferable: true,
      sublicensingAllowed: false,
      ownershipTransferred: false,
      modelTrainingAllowed: false,
      resaleOfAssetAllowed: false,
      attributionRequired: false
    },
    repeatUse: 'A new x402 license payment is required for each additional machine-use unit.',
    rightsNotice: 'This receipt licenses only rights actually controlled by the configured licensor. NFT ownership by itself is not a representation that copyright or trademark rights were transferred.',
    proof: {
      x402: 'The x402 payment response header and settlement transaction are the payment proof for this license receipt.',
      onchainOwnershipCheckedAtIssue: true
    }
  };
}
