import { createHmac } from 'node:crypto';
import { Contract, JsonRpcProvider, Wallet, getBytes, keccak256, solidityPackedKeccak256, toUtf8Bytes } from 'ethers';

export const SPATIAL_MINT_ABI = [
  'function usedVouchers(bytes32 voucherId) view returns (bool)',
  'function voucherSigner() view returns (address)',
  'function feeRecipient() view returns (address)',
  'function mintFeeWei() view returns (uint256)',
  'function paused() view returns (bool)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRIVATE_KEY_RE = /^(0x)?[a-fA-F0-9]{64}$/;

function normalizedPrivateKey(value: string) {
  const raw = value.trim();
  if (!PRIVATE_KEY_RE.test(raw)) return '';
  return raw.startsWith('0x') ? raw : `0x${raw}`;
}

export function spatialMintServerEnabled() {
  return process.env.SPATIAL_MINT_ENABLED === 'true';
}

export function spatialMintChainId() {
  return Number(process.env.SPATIAL_MINT_CHAIN_ID || 84532);
}

export function spatialMintContractAddress() {
  return String(process.env.SPATIAL_NFT_CONTRACT_ADDRESS || '').trim();
}

export function spatialMintRpcUrl() {
  const chainId = spatialMintChainId();
  return String(process.env.SPATIAL_MINT_RPC_URL || (chainId === 84532 ? 'https://sepolia.base.org' : '')).trim();
}

export function spatialMintExplorerUrl() {
  const chainId = spatialMintChainId();
  if (chainId === 84532) return 'https://sepolia-explorer.base.org';
  if (chainId === 8453) return 'https://base.blockscout.com';
  return '';
}

export function assertSpatialMintServerReady({ requireSigner = false, requireMetadataSecret = false } = {}) {
  if (!spatialMintServerEnabled()) throw new Error('Spatial minting is not enabled on this deployment.');
  const chainId = spatialMintChainId();
  if (chainId === 8453 && process.env.SPATIAL_ALLOW_MAINNET !== 'true') throw new Error('Spatial mainnet minting is locked.');
  if (chainId !== 84532 && chainId !== 8453) throw new Error('Spatial mint chain is not supported.');
  const contractAddress = spatialMintContractAddress();
  if (!ADDRESS_RE.test(contractAddress)) throw new Error('Spatial NFT contract is not configured.');
  const rpcUrl = spatialMintRpcUrl();
  if (!/^https:\/\//i.test(rpcUrl)) throw new Error('Spatial mint RPC is not configured.');
  if (requireSigner && !normalizedPrivateKey(String(process.env.SPATIAL_NFT_VOUCHER_SIGNER_PRIVATE_KEY || ''))) {
    throw new Error('Spatial mint voucher signer is not configured.');
  }
  if (requireMetadataSecret && String(process.env.SPATIAL_MINT_METADATA_SECRET || '').length < 32) {
    throw new Error('Spatial mint metadata secret is not configured.');
  }
  return { chainId, contractAddress, rpcUrl };
}

export function spatialMintProvider() {
  const config = assertSpatialMintServerReady();
  return new JsonRpcProvider(config.rpcUrl, config.chainId, { staticNetwork: true });
}

export function spatialMintContract(provider?: JsonRpcProvider) {
  const config = assertSpatialMintServerReady();
  return new Contract(config.contractAddress, SPATIAL_MINT_ABI, provider || spatialMintProvider());
}

export function spatialMintMetadataSignature(assetId: string) {
  assertSpatialMintServerReady({ requireMetadataSecret: true });
  return createHmac('sha256', String(process.env.SPATIAL_MINT_METADATA_SECRET)).update(`spatial-metadata:${assetId}:v1`).digest('hex');
}

export function spatialMintMediaSignature(assetId: string, kind: 'model' | 'image') {
  assertSpatialMintServerReady({ requireMetadataSecret: true });
  return createHmac('sha256', String(process.env.SPATIAL_MINT_METADATA_SECRET)).update(`spatial-media:${assetId}:${kind}:v1`).digest('hex');
}

export function spatialMintSignatureValid(assetId: string, value: string, kind?: 'model' | 'image') {
  const expected = kind ? spatialMintMediaSignature(assetId, kind) : spatialMintMetadataSignature(assetId);
  return /^[a-f0-9]{64}$/i.test(value) && value.toLowerCase() === expected.toLowerCase();
}

export function spatialMintVoucherId(assetId: string) {
  return keccak256(toUtf8Bytes(`voxelvault-spatial:${assetId}:v1`));
}

export async function signSpatialMintVoucher(wallet: string, metadataUrl: string, voucherId: string) {
  const config = assertSpatialMintServerReady({ requireSigner: true });
  if (!ADDRESS_RE.test(wallet)) throw new Error('Valid mint wallet required.');
  const privateKey = normalizedPrivateKey(String(process.env.SPATIAL_NFT_VOUCHER_SIGNER_PRIVATE_KEY || ''));
  const signer = new Wallet(privateKey);
  const uriHash = keccak256(toUtf8Bytes(metadataUrl));
  const digest = solidityPackedKeccak256(['address', 'bytes32', 'bytes32'], [wallet, uriHash, voucherId]);
  const signature = await signer.signMessage(getBytes(digest));
  return { signature, signer: signer.address, chainId: config.chainId, contractAddress: config.contractAddress };
}
