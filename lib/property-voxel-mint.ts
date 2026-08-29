import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Contract, getBytes, JsonRpcProvider, keccak256, solidityPackedKeccak256, toUtf8Bytes, Wallet } from 'ethers';
import { getVoxelFlipDeployment } from './voxelflip-deployment';

const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const VOUCHER_ABI = [
  'function usedVouchers(bytes32 voucherId) view returns (bool)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];

function normalizePrivateKey(value: string) {
  const trimmed = String(value || '').trim();
  if (PRIVATE_KEY_RE.test(trimmed)) return `0x${trimmed}`;
  if (/^0X[a-fA-F0-9]{64}$/.test(trimmed)) return `0x${trimmed.slice(2)}`;
  return trimmed;
}

function signingSecret() {
  const raw = process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY?.trim() || '';
  return raw ? normalizePrivateKey(raw) : '';
}

function metadataSecret() {
  return process.env.PROPERTY_VOXEL_METADATA_SECRET?.trim() || signingSecret();
}

function cleanName(value: unknown) {
  return String(value || 'VoxelPop Property').trim().slice(0, 72).replace(/[^a-z0-9 .,_-]+/gi, '').replace(/\s+/g, ' ') || 'VoxelPop Property';
}

export function propertyVoxelVoucherId(userId: string, draftId: string, taskId: string) {
  return `0x${createHash('sha256').update(`voxelpop-property-nft-v1:${String(userId).trim()}:${String(draftId).trim()}:${String(taskId).trim()}`).digest('hex')}`;
}

export function propertyVoxelMetadataSignature(draftId: string, taskId: string, name: string) {
  const secret = metadataSecret();
  if (!secret) return '';
  return createHmac('sha256', secret)
    .update(`property-voxel-metadata-v1:${String(draftId).trim()}:${String(taskId).trim()}:${cleanName(name)}`)
    .digest('hex');
}

export function verifyPropertyVoxelMetadataSignature(draftId: string, taskId: string, name: string, signature: string) {
  const expected = propertyVoxelMetadataSignature(draftId, taskId, name);
  const actual = String(signature || '').trim().toLowerCase();
  if (!expected || !actual || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}

export function propertyVoxelMetadataUrl(origin: string, draftId: string, taskId: string, name: string) {
  const safeName = cleanName(name);
  const signature = propertyVoxelMetadataSignature(draftId, taskId, safeName);
  if (!signature) throw new Error('Property voxel metadata signing is not configured.');
  const url = new URL('/api/property-voxel-nft/metadata', origin);
  url.searchParams.set('draftId', draftId);
  url.searchParams.set('taskId', taskId);
  url.searchParams.set('name', safeName);
  url.searchParams.set('sig', signature);
  return url.toString();
}

export function propertyVoxelMintConfigured() {
  return /^0x[a-fA-F0-9]{64}$/.test(signingSecret());
}

export async function buildPropertyVoxelVoucher(input: {
  userId: string;
  draftId: string;
  taskId: string;
  wallet: string;
  name: string;
  origin: string;
}) {
  if (!ADDRESS_RE.test(input.wallet)) throw new Error('Connect a valid wallet before minting.');
  const privateKey = signingSecret();
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) throw new Error('VoxelFlip mint signer is not configured.');
  const signer = new Wallet(privateKey);
  const metadataUrl = propertyVoxelMetadataUrl(input.origin, input.draftId, input.taskId, input.name);
  const voucherId = propertyVoxelVoucherId(input.userId, input.draftId, input.taskId);
  const uriHash = keccak256(toUtf8Bytes(metadataUrl));
  const digest = solidityPackedKeccak256(['address', 'bytes32', 'bytes32'], [input.wallet, uriHash, voucherId]);
  const signature = await signer.signMessage(getBytes(digest));
  return { metadataUrl, voucherId, signature, signer: signer.address, name: cleanName(input.name) };
}

function rpcUrl() {
  return process.env.VOXELFLIP_RPC_URL?.trim() || process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
}

export async function propertyVoxelVoucherUsed(voucherId: string) {
  const deployment = await getVoxelFlipDeployment();
  const provider = new JsonRpcProvider(rpcUrl(), 8453, { staticNetwork: true });
  try {
    const contract = new Contract(deployment.address, VOUCHER_ABI, provider);
    return Boolean(await contract.usedVouchers(voucherId));
  } finally {
    provider.destroy();
  }
}

export async function verifyPropertyVoxelMint(input: {
  tokenId: string;
  wallet: string;
  txHash: string;
  voucherId: string;
  metadataUrl: string;
}) {
  if (!ADDRESS_RE.test(input.wallet)) throw new Error('Mint wallet is invalid.');
  if (!/^0x[a-fA-F0-9]{64}$/.test(String(input.txHash || ''))) throw new Error('Mint transaction hash is invalid.');
  if (!/^\d+$/.test(String(input.tokenId || ''))) throw new Error('Mint token ID is invalid.');
  const deployment = await getVoxelFlipDeployment();
  const provider = new JsonRpcProvider(rpcUrl(), 8453, { staticNetwork: true });
  try {
    const receipt = await provider.getTransactionReceipt(input.txHash);
    if (!receipt || Number(receipt.status) !== 1) throw new Error('The Base mint transaction is not confirmed successfully.');
    if (String(receipt.to || '').toLowerCase() !== deployment.address.toLowerCase()) throw new Error('The transaction did not mint from the reviewed VoxelFlip contract.');
    const contract = new Contract(deployment.address, VOUCHER_ABI, provider);
    const [owner, tokenUri, used] = await Promise.all([
      contract.ownerOf(input.tokenId),
      contract.tokenURI(input.tokenId),
      contract.usedVouchers(input.voucherId),
    ]);
    if (String(owner).toLowerCase() !== input.wallet.toLowerCase()) throw new Error('The connected wallet does not own this minted voxel.');
    if (String(tokenUri) !== input.metadataUrl) throw new Error('The minted token metadata does not match this property voxel.');
    if (!used) throw new Error('The one-time mint voucher is not marked used on Base.');
    return {
      tokenId: String(input.tokenId),
      owner: String(owner),
      txHash: input.txHash,
      metadataUrl: String(tokenUri),
      contractAddress: deployment.address,
      explorerUrl: `https://basescan.org/tx/${input.txHash}`,
      openSeaUrl: `https://opensea.io/assets/base/${deployment.address}/${String(input.tokenId)}`,
    };
  } finally {
    provider.destroy();
  }
}
