import { createHash, createHmac } from 'node:crypto';
import { Contract, JsonRpcProvider, Wallet, getBytes, id, keccak256, solidityPackedKeccak256, toUtf8Bytes } from 'ethers';
import { NextResponse } from 'next/server';
import { stripe } from '../../../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../../../lib/user-auth';
import { paidPropertyGenerationReceipt } from '../../../../../lib/property-generation-payment';
import { normalizePropertyDraftId, propertyDraftItemId } from '../../../../../lib/property-generation-ids';
import { readCatalog3DByTask } from '../../../../../lib/catalog3dStore';
import { getVoxelFlipDeployment } from '../../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;
const VOXELFLIP_MINT_TOPIC = id('VoxelFlipMinted(uint256,address,bytes32,string)');
const EXISTING_MINT_ABI = [
  'function usedVouchers(bytes32 voucherId) view returns (bool)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];

function clean(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max);
}
function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  if (PRIVATE_KEY_RE.test(trimmed)) return `0x${trimmed}`;
  if (/^0X[a-fA-F0-9]{64}$/.test(trimmed)) return `0x${trimmed.slice(2)}`;
  return trimmed;
}
function signerSecret() {
  const raw = process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY?.trim() || '';
  return raw ? normalizePrivateKey(raw) : '';
}
function hmacHex(value: string) {
  const secret = signerSecret();
  return secret ? createHmac('sha256', secret).update(value).digest('hex') : '';
}
function voucherIdFor(sessionId: string, taskId: string) {
  return `0x${createHash('sha256').update(`property-voxelflip:${sessionId}:${taskId}`).digest('hex')}`;
}
function rpcCandidates() {
  const configured = (process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || '').trim();
  return Array.from(new Set([configured, 'https://base.blockscout.com/api/eth-rpc', 'https://mainnet.base.org', 'https://base.llamarpc.com'].filter(Boolean)));
}
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function mintVoucher(wallet: string, metadataUrl: string, voucherId: string) {
  const secret = signerSecret();
  if (!secret) return null;
  const signer = new Wallet(secret);
  const uriHash = keccak256(toUtf8Bytes(metadataUrl));
  const digest = solidityPackedKeccak256(['address', 'bytes32', 'bytes32'], [wallet, uriHash, voucherId]);
  return { signature: await signer.signMessage(getBytes(digest)), signer: signer.address };
}

async function findVoucherMint(contractAddress: string, wallet: string, voucherId: string) {
  let knownUsed = false;
  for (const rpcUrl of rpcCandidates()) {
    const provider = new JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
    try {
      const contract = new Contract(contractAddress, EXISTING_MINT_ABI, provider);
      const used = Boolean(await withTimeout(contract.usedVouchers(voucherId), 4500, 'voucher lookup'));
      if (!used) return { checked: true, used: false, mint: null };
      knownUsed = true;
      const latest = await withTimeout(provider.getBlockNumber(), 4500, 'latest block lookup');
      const firstBlock = Math.max(0, latest - 30_000);
      let toBlock = latest;
      while (toBlock >= firstBlock) {
        const fromBlock = Math.max(firstBlock, toBlock - 1_999);
        const logs = await withTimeout(provider.getLogs({ address: contractAddress, fromBlock, toBlock, topics: [VOXELFLIP_MINT_TOPIC, null, null, voucherId] }), 4500, 'mint-event lookup');
        if (logs.length) {
          const log = logs[logs.length - 1];
          const tokenId = BigInt(log.topics[1]).toString();
          const mintedOwner = `0x${log.topics[2].slice(-40)}`;
          if (mintedOwner.toLowerCase() !== wallet.toLowerCase()) return { checked: true, used: true, mint: null, ownerMismatch: mintedOwner };
          const [owner, metadataUrl] = await withTimeout(Promise.all([contract.ownerOf(tokenId), contract.tokenURI(tokenId)]), 5500, 'existing mint lookup');
          return { checked: true, used: true, mint: { tokenId, txHash: log.transactionHash, owner: String(owner), metadataUrl: String(metadataUrl) } };
        }
        if (fromBlock === firstBlock) break;
        toBlock = fromBlock - 1;
      }
    } catch (error) {
      console.warn('Property VoxelFlip recovery RPC unavailable', rpcUrl, error);
    } finally {
      provider.destroy();
    }
  }
  return { checked: knownUsed, used: knownUsed, mint: null };
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const generationSessionId = clean(body?.generationSessionId, 260);
    const draftId = normalizePropertyDraftId(body?.draftId);
    const taskId = clean(body?.taskId, 180);
    const wallet = clean(body?.wallet, 80);
    if (!generationSessionId || !taskId.startsWith('local-v1:') || !ADDRESS_RE.test(wallet)) {
      return NextResponse.json({ ok: false, error: 'A paid property creation, finished local voxel, and connected wallet are required.' }, { status: 400 });
    }

    const receipt = await paidPropertyGenerationReceipt(auth, stripe, generationSessionId);
    if (receipt.draftId !== draftId) return NextResponse.json({ ok: false, error: 'This payment does not belong to this property creation.' }, { status: 403 });

    const saved = await readCatalog3DByTask(taskId);
    const expectedItemId = propertyDraftItemId(auth.user.id, draftId, 'voxel');
    if (!saved || saved.item_id !== expectedItemId || saved.provider !== 'voxelpop-local-webgl-v1' || saved.status !== 'SUCCEEDED' || !saved.source_image_url) {
      return NextResponse.json({ ok: false, error: 'This finished voxel is not account-bound to the paid property creation.' }, { status: 403 });
    }

    const deployment = await getVoxelFlipDeployment();
    const contractAddress = deployment?.address || '';
    if (!ADDRESS_RE.test(contractAddress)) return NextResponse.json({ ok: false, error: 'VoxelFlip minting is not configured on this deployment.' }, { status: 503 });
    if (!signerSecret()) return NextResponse.json({ ok: false, error: 'The secure VoxelFlip mint signer is not configured on this deployment.' }, { status: 503 });

    const origin = new URL(request.url).origin;
    const name = `VoxelPop Property ${draftId.slice(-6).toUpperCase()}`;
    const metadataSig = hmacHex(`property-metadata:${taskId}|${draftId}|${name}`);
    const metadataUrl = `${origin}/api/property-nft/metadata?${new URLSearchParams({ taskId, draftId, name, sig: metadataSig }).toString()}`;
    const voucherId = voucherIdFor(generationSessionId, taskId);
    const lookup = await findVoucherMint(contractAddress, wallet, voucherId);
    if (!lookup.checked) return NextResponse.json({ ok: false, error: 'Base could not be checked safely yet. No mint was sent; try again.' }, { status: 503 });
    if (lookup.ownerMismatch) return NextResponse.json({ ok: false, error: `This one-time voxel voucher was already minted to ${lookup.ownerMismatch}.`, voucherUsed: true }, { status: 409 });
    if (lookup.used && !lookup.mint) return NextResponse.json({ ok: false, error: 'This voxel voucher is already used on Base. Recovery did not return the mint event yet; do not mint again.', voucherUsed: true }, { status: 409 });

    const canonicalMetadataUrl = lookup.mint?.metadataUrl || metadataUrl;
    const voucher = lookup.used ? null : await mintVoucher(wallet, canonicalMetadataUrl, voucherId);
    return NextResponse.json({
      ok: true,
      ready: true,
      chain: 'Base',
      contractAddress,
      draftId,
      taskId,
      wallet,
      metadataUrl: canonicalMetadataUrl,
      voucherId,
      voucherUsed: lookup.used,
      existingMint: lookup.mint,
      mintConfigured: Boolean(voucher) || Boolean(lookup.mint),
      signature: voucher?.signature || null,
      signer: voucher?.signer || null,
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'The property voxel could not be prepared for minting.' }, { status: 500 });
  }
}
