import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Contract, getBytes, JsonRpcProvider, keccak256, solidityPackedKeccak256, toUtf8Bytes, Wallet } from 'ethers';
import { getVoxelFlipDeployment } from './voxelflip-deployment';

const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;
const VOUCHER_ABI = ['function usedVouchers(bytes32 voucherId) view returns (bool)'];

function clean(value: unknown, max = 180) {
  return String(value || '').trim().slice(0, max);
}

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
  return process.env.PROPERTY_LOCAL_MINT_METADATA_SECRET?.trim() || signingSecret();
}

export function propertyLocalMintReady() {
  return /^0x[a-fA-F0-9]{64}$/.test(signingSecret());
}

export function propertyLocalVoucherId(userId: string, draftId: string, taskId: string) {
  return `0x${createHash('sha256').update(`voxel-vault:property-local:${clean(userId, 180)}:${clean(draftId, 100)}:${clean(taskId, 180)}`).digest('hex')}`;
}

export function propertyLocalMetadataSignature(taskId: string, draftId: string, name: string) {
  const secret = metadataSecret();
  if (!secret) return '';
  return createHmac('sha256', secret)
    .update(`property-local-metadata:${clean(taskId, 180)}:${clean(draftId, 100)}:${clean(name, 90)}`)
    .digest('hex');
}

export function verifyPropertyLocalMetadataSignature(taskId: string, draftId: string, name: string, signature: string) {
  const expected = propertyLocalMetadataSignature(taskId, draftId, name);
  const actual = clean(signature, 128).toLowerCase();
  if (!expected || expected.length !== actual.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
  } catch {
    return false;
  }
}

export function propertyLocalMetadataUrl(origin: string, taskId: string, draftId: string, name: string) {
  const sig = propertyLocalMetadataSignature(taskId, draftId, name);
  if (!sig) throw new Error('Property voxel metadata signing is not configured.');
  const url = new URL('/api/property-local-voxel/mint/metadata', origin);
  url.searchParams.set('taskId', clean(taskId, 180));
  url.searchParams.set('draftId', clean(draftId, 100));
  url.searchParams.set('name', clean(name, 90) || 'VoxelPop Property');
  url.searchParams.set('sig', sig);
  return url.toString();
}

export async function buildPropertyLocalMintVoucher({
  userId,
  draftId,
  taskId,
  wallet,
  name,
  origin,
}: {
  userId: string;
  draftId: string;
  taskId: string;
  wallet: string;
  name: string;
  origin: string;
}) {
  const privateKey = signingSecret();
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) throw new Error('VoxelFlip mint signer is not configured.');
  const signer = new Wallet(privateKey);
  const metadataUrl = propertyLocalMetadataUrl(origin, taskId, draftId, name);
  const voucherId = propertyLocalVoucherId(userId, draftId, taskId);
  const uriHash = keccak256(toUtf8Bytes(metadataUrl));
  const digest = solidityPackedKeccak256(['address', 'bytes32', 'bytes32'], [wallet, uriHash, voucherId]);
  const signature = await signer.signMessage(getBytes(digest));
  return { metadataUrl, voucherId, signature, signer: signer.address };
}

export async function isPropertyLocalVoucherUsed(voucherId: string) {
  const deployment = await getVoxelFlipDeployment();
  const rpc = process.env.VOXELFLIP_RPC_URL?.trim() || process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
  const provider = new JsonRpcProvider(rpc, 8453, { staticNetwork: true });
  try {
    const contract = new Contract(deployment.address, VOUCHER_ABI, provider);
    return Boolean(await contract.usedVouchers(voucherId));
  } finally {
    provider.destroy();
  }
}
