import { Contract, JsonRpcProvider } from 'ethers';
import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import { paidPropertyGenerationReceipt } from '../../../../lib/property-generation-payment';
import { normalizePropertyDraftId, propertyDraftItemId } from '../../../../lib/property-generation-ids';
import { readCatalog3DByTask } from '../../../../lib/catalog3dStore';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const ABI = ['function ownerOf(uint256 tokenId) view returns (address)', 'function tokenURI(uint256 tokenId) view returns (string)'];

function clean(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max);
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
async function verifyOnChain(contractAddress: string, tokenId: string, txHash: string, wallet: string, metadataUrl: string) {
  const failures: string[] = [];
  for (const rpcUrl of rpcCandidates()) {
    const provider = new JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
    try {
      const receipt = await withTimeout(provider.getTransactionReceipt(txHash), 5000, 'Base receipt lookup');
      if (!receipt) throw new Error('Mint transaction is not visible on Base yet.');
      if (receipt.status !== 1) throw new Error('The mint transaction failed on Base.');
      if (String(receipt.to || '').toLowerCase() !== contractAddress.toLowerCase()) throw new Error('The transaction did not call the configured VoxelFlip contract.');
      const contract = new Contract(contractAddress, ABI, provider);
      const [owner, uri] = await withTimeout(Promise.all([contract.ownerOf(tokenId), contract.tokenURI(tokenId)]), 6000, 'VoxelFlip token lookup');
      if (String(owner).toLowerCase() !== wallet.toLowerCase()) throw new Error('The connected wallet does not own this token.');
      if (String(uri) !== metadataUrl) throw new Error('The minted NFT metadata does not match this property voxel.');
      return { owner: String(owner), metadataUrl: String(uri) };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    } finally {
      provider.destroy();
    }
  }
  throw new Error(failures.some((message) => /failed on Base|did not call|does not own|does not match/i.test(message))
    ? failures.find((message) => /failed on Base|did not call|does not own|does not match/i.test(message)) || 'Mint verification failed.'
    : 'Your mint was submitted, but Base verification is not available yet. Resume verification instead of minting again.');
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const generationSessionId = clean(body?.generationSessionId, 260);
    const draftId = normalizePropertyDraftId(body?.draftId);
    const taskId = clean(body?.taskId, 180);
    const tokenId = clean(body?.tokenId, 80);
    const txHash = clean(body?.txHash, 80);
    const wallet = clean(body?.wallet, 80);
    const metadataUrl = clean(body?.metadataUrl, 1000);
    if (!generationSessionId || !taskId.startsWith('local-v1:') || !/^\d+$/.test(tokenId) || !TX_RE.test(txHash) || !ADDRESS_RE.test(wallet) || !/^https:\/\//i.test(metadataUrl)) {
      return NextResponse.json({ ok: false, error: 'Mint confirmation details are incomplete.' }, { status: 400 });
    }

    const receipt = await paidPropertyGenerationReceipt(auth, stripe, generationSessionId);
    if (receipt.draftId !== draftId) return NextResponse.json({ ok: false, error: 'This payment does not belong to this property creation.' }, { status: 403 });
    const saved = await readCatalog3DByTask(taskId);
    if (!saved || saved.item_id !== propertyDraftItemId(auth.user.id, draftId, 'voxel') || saved.provider !== 'voxelpop-local-webgl-v1' || saved.status !== 'SUCCEEDED') {
      return NextResponse.json({ ok: false, error: 'This voxel does not belong to the paid signed-in property creation.' }, { status: 403 });
    }

    const deployment = await getVoxelFlipDeployment();
    const contractAddress = deployment?.address || '';
    if (!ADDRESS_RE.test(contractAddress)) return NextResponse.json({ ok: false, error: 'VoxelFlip minting is not configured.' }, { status: 503 });
    const verified = await verifyOnChain(contractAddress, tokenId, txHash, wallet, metadataUrl);

    return NextResponse.json({
      ok: true,
      confirmed: true,
      tokenId,
      txHash,
      wallet: verified.owner,
      contractAddress,
      metadataUrl: verified.metadataUrl,
      network: 'Base',
      explorerUrl: `${process.env.NEXT_PUBLIC_VOXELFLIP_EXPLORER_URL || 'https://basescan.org'}/tx/${txHash}`,
      openSeaUrl: `https://opensea.io/assets/base/${contractAddress}/${tokenId}`,
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to verify this property voxel mint.' }, { status: 500 });
  }
}
