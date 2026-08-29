import { createHash, createHmac } from 'node:crypto';
import { Contract, getBytes, JsonRpcProvider, keccak256, solidityPackedKeccak256, toUtf8Bytes, Wallet } from 'ethers';
import { getVoxelFlipDeployment } from './voxelflip-deployment';

const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;
const MINT_ABI = [
  'function usedVouchers(bytes32 voucherId) view returns (bool)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'event VoxelFlipMinted(uint256 indexed tokenId,address indexed owner,bytes32 indexed voucherId,string tokenURI)',
];

function normalizePrivateKey(value: string) {
  const trimmed = String(value || '').trim();
  if (PRIVATE_KEY_RE.test(trimmed)) return `0x${trimmed}`;
  if (/^0X[a-fA-F0-9]{64}$/.test(trimmed)) return `0x${trimmed.slice(2)}`;
  return trimmed;
}

function signerKey() {
  const raw = process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY?.trim() || '';
  return raw ? normalizePrivateKey(raw) : '';
}

function rpcCandidates() {
  const configured = String(process.env.VOXELFLIP_RPC_URL || process.env.BASE_RPC_URL || '').trim();
  return Array.from(new Set([
    configured,
    'https://base.blockscout.com/api/eth-rpc',
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
  ].filter(Boolean)));
}

export function propertyVoxelMintReady() {
  return /^0x[a-fA-F0-9]{64}$/.test(signerKey());
}

export function propertyVoxelVoucherId(userId: string, draftId: string, taskId: string) {
  const value = `voxelpop-property:${String(userId || '').trim()}:${String(draftId || '').trim()}:${String(taskId || '').trim()}`;
  return `0x${createHash('sha256').update(value).digest('hex')}`;
}

export function propertyVoxelMetadataSignature(draftId: string, taskId: string) {
  const secret = signerKey();
  if (!secret) return '';
  return createHmac('sha256', secret)
    .update(`voxelpop-property-metadata:${String(draftId || '').trim()}:${String(taskId || '').trim()}`)
    .digest('hex');
}

export function verifyPropertyVoxelMetadataSignature(draftId: string, taskId: string, signature: string) {
  const expected = propertyVoxelMetadataSignature(draftId, taskId);
  return Boolean(expected && signature && expected.length === signature.length && expected.toLowerCase() === String(signature).toLowerCase());
}

export function propertyVoxelMetadataUrl(origin: string, draftId: string, taskId: string) {
  const sig = propertyVoxelMetadataSignature(draftId, taskId);
  if (!sig) throw new Error('VoxelFlip mint signing is not configured.');
  const url = new URL('/api/property-local-voxel/mint/metadata', origin);
  url.searchParams.set('draftId', draftId);
  url.searchParams.set('taskId', taskId);
  url.searchParams.set('sig', sig);
  return url.toString();
}

export async function buildPropertyVoxelVoucher({
  userId,
  draftId,
  taskId,
  wallet,
  origin,
}: {
  userId: string;
  draftId: string;
  taskId: string;
  wallet: string;
  origin: string;
}) {
  const privateKey = signerKey();
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) throw new Error('VoxelFlip mint signer is not configured.');
  const signer = new Wallet(privateKey);
  const voucherId = propertyVoxelVoucherId(userId, draftId, taskId);
  const metadataUrl = propertyVoxelMetadataUrl(origin, draftId, taskId);
  const uriHash = keccak256(toUtf8Bytes(metadataUrl));
  const digest = solidityPackedKeccak256(['address', 'bytes32', 'bytes32'], [wallet, uriHash, voucherId]);
  const signature = await signer.signMessage(getBytes(digest));
  return { voucherId, metadataUrl, signature, signer: signer.address };
}

export async function findExistingPropertyVoxelMint(wallet: string, voucherId: string) {
  const deployment = await getVoxelFlipDeployment();
  let sawUsedVoucher = false;
  for (const rpcUrl of rpcCandidates()) {
    const provider = new JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
    try {
      const contract = new Contract(deployment.address, MINT_ABI, provider);
      const used = Boolean(await contract.usedVouchers(voucherId));
      if (!used) return { checked: true, used: false, mint: null, deployment };
      sawUsedVoucher = true;
      const latest = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latest - 100_000);
      const filter = contract.filters.VoxelFlipMinted(null, null, voucherId);
      const events = await contract.queryFilter(filter, fromBlock, latest);
      const event: any = events[events.length - 1] || null;
      if (!event?.args) return { checked: true, used: true, mint: null, deployment };
      const tokenId = String(event.args.tokenId);
      const currentOwner = String(await contract.ownerOf(tokenId));
      const metadataUrl = String(await contract.tokenURI(tokenId));
      return {
        checked: true,
        used: true,
        mint: {
          tokenId,
          owner: currentOwner,
          mintedOwner: String(event.args.owner || ''),
          metadataUrl,
          txHash: String(event.transactionHash || ''),
          walletMatches: currentOwner.toLowerCase() === wallet.toLowerCase(),
        },
        deployment,
      };
    } catch (error) {
      console.warn('Property VoxelFlip voucher lookup unavailable', rpcUrl, error);
    } finally {
      provider.destroy();
    }
  }
  return { checked: false, used: sawUsedVoucher, mint: null, deployment };
}

export async function verifyPropertyVoxelMintOnBase({
  tokenId,
  txHash,
  wallet,
  metadataUrl,
}: {
  tokenId: string;
  txHash: string;
  wallet: string;
  metadataUrl: string;
}) {
  const deployment = await getVoxelFlipDeployment();
  let lastError: unknown = null;
  for (const rpcUrl of rpcCandidates()) {
    const provider = new JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) throw new Error('The Base transaction receipt is not visible yet.');
      if (receipt.status !== 1) throw new Error('The VoxelFlip mint transaction failed on Base.');
      if (String(receipt.to || '').toLowerCase() !== deployment.address.toLowerCase()) throw new Error('The transaction did not mint from the reviewed VoxelFlip contract.');
      const contract = new Contract(deployment.address, MINT_ABI, provider);
      const [owner, uri] = await Promise.all([contract.ownerOf(tokenId), contract.tokenURI(tokenId)]);
      if (String(owner).toLowerCase() !== wallet.toLowerCase()) throw new Error('The connected wallet does not own this VoxelFlip token.');
      if (String(uri) !== metadataUrl) throw new Error('The minted metadata does not match this VoxelPop property voxel.');
      return { deployment, owner: String(owner), metadataUrl: String(uri) };
    } catch (error) {
      lastError = error;
    } finally {
      provider.destroy();
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Base verification is temporarily unavailable.');
}
