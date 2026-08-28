import { createHash, createHmac } from 'crypto';
import { Contract, getBytes, JsonRpcProvider, keccak256, solidityPackedKeccak256, toUtf8Bytes, Wallet } from 'ethers';
import { getVoxelFlipDeployment } from './voxelflip-deployment';

const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;
const VOUCHER_ABI = ['function usedVouchers(bytes32 voucherId) view returns (bool)'];

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
  return process.env.DIGITAL_ESTATES_METADATA_SECRET?.trim() || signingSecret();
}

export function digitalEstateMintReady() {
  const secret = signingSecret();
  return /^0x[a-fA-F0-9]{64}$/.test(secret);
}

export function digitalEstateVoucherId(estateId: string) {
  return `0x${createHash('sha256').update(`voxel-vault:digital-estate:${String(estateId || '').trim().toLowerCase()}`).digest('hex')}`;
}

export function digitalEstateMetadataSignature(estateId: string) {
  const secret = metadataSecret();
  if (!secret) return '';
  return createHmac('sha256', secret)
    .update(`digital-estate-metadata:${String(estateId || '').trim().toLowerCase()}`)
    .digest('hex');
}

export function verifyDigitalEstateMetadataSignature(estateId: string, signature: string) {
  const expected = digitalEstateMetadataSignature(estateId);
  return Boolean(expected && signature && expected.length === signature.length && expected.toLowerCase() === String(signature).toLowerCase());
}

export function digitalEstateMetadataUrl(origin: string, estateId: string) {
  const sig = digitalEstateMetadataSignature(estateId);
  if (!sig) throw new Error('Digital Estate metadata signing is not configured.');
  const url = new URL('/api/digital-estates/metadata', origin);
  url.searchParams.set('estateId', estateId);
  url.searchParams.set('sig', sig);
  return url.toString();
}

export async function buildDigitalEstateVoucher({
  estateId,
  wallet,
  origin,
}: {
  estateId: string;
  wallet: string;
  origin: string;
}) {
  const privateKey = signingSecret();
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) throw new Error('VoxelFlip mint signer is not configured.');
  const signer = new Wallet(privateKey);
  const metadataUrl = digitalEstateMetadataUrl(origin, estateId);
  const voucherId = digitalEstateVoucherId(estateId);
  const uriHash = keccak256(toUtf8Bytes(metadataUrl));
  const digest = solidityPackedKeccak256(['address', 'bytes32', 'bytes32'], [wallet, uriHash, voucherId]);
  const signature = await signer.signMessage(getBytes(digest));
  return { metadataUrl, voucherId, signature, signer: signer.address };
}

export async function isDigitalEstateMinted(estateId: string) {
  const deployment = await getVoxelFlipDeployment();
  const rpc = process.env.VOXELFLIP_RPC_URL?.trim() || process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
  const provider = new JsonRpcProvider(rpc, 8453, { staticNetwork: true });
  try {
    const contract = new Contract(deployment.address, VOUCHER_ABI, provider);
    return Boolean(await contract.usedVouchers(digitalEstateVoucherId(estateId)));
  } finally {
    provider.destroy();
  }
}
