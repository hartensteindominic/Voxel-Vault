import { Contract, JsonRpcProvider } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../../lib/voxelflip-deployment';
import { getVoxelPopEntitlement, updateVoxelPopEntitlementMetadata } from '../../../../../lib/voxelpop-entitlement';
import { attributionFromMetadata, recordVoxelPopEvent } from '../../../../../lib/voxelpop-analytics';

export const runtime = 'nodejs';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const ABI = ['function ownerOf(uint256 tokenId) view returns (address)','function tokenURI(uint256 tokenId) view returns (string)'];

function openSeaUrl(contract: string, tokenId: string) {
  return `https://opensea.io/assets/base/${contract}/${tokenId}`;
}
function rpcCandidates() {
  const configured = (process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || '').trim();
  return Array.from(new Set([configured, 'https://base.llamarpc.com', 'https://mainnet.base.org', 'https://base-rpc.publicnode.com'].filter(Boolean)));
}
async function verifyMintOnChain(contractAddress: string, tokenId: string, txHash: string, wallet: string, metadataUrl: string) {
  let lastError: unknown = null;
  for (const rpcUrl of rpcCandidates()) {
    try {
      const provider = new JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) throw new Error('The mint transaction is not visible on this RPC yet.');
      if (receipt.status !== 1) throw new Error('The mint transaction failed.');
      if (receipt.to?.toLowerCase() !== contractAddress.toLowerCase()) throw new Error('The transaction did not mint from the registered VoxelFlip contract.');
      const contract = new Contract(contractAddress.toLowerCase(), ABI, provider);
      const [owner, uri] = await Promise.all([contract.ownerOf(tokenId), contract.tokenURI(tokenId)]);
      if (String(owner).toLowerCase() !== wallet.toLowerCase()) throw new Error('The connected wallet does not own this VoxelFlip token.');
      if (String(uri) !== metadataUrl) throw new Error('The minted token metadata does not match this VoxelPop asset.');
      return true;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unable to verify the mint on Base right now.');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
    const taskId = typeof body?.taskId === 'string' ? body.taskId : '';
    const tokenId = String(body?.tokenId || '').trim();
    const txHash = typeof body?.txHash === 'string' ? body.txHash.trim() : '';
    const wallet = typeof body?.wallet === 'string' ? body.wallet.trim() : '';
    const metadataUrl = typeof body?.metadataUrl === 'string' ? body.metadataUrl.trim() : '';
    const deployment = await getVoxelFlipDeployment();
    const contractAddress = deployment?.address || '';
    if (!sessionId || !taskId || !/^\d+$/.test(tokenId) || !TX_RE.test(txHash) || !ADDRESS_RE.test(wallet) || !/^https:\/\//i.test(metadataUrl)) {
      return NextResponse.json({ error: 'Mint confirmation details are incomplete.' }, { status: 400 });
    }
    if (!ADDRESS_RE.test(contractAddress)) return NextResponse.json({ error: 'VoxelFlip contract is not configured.' }, { status: 503 });

    const entitlement = await getVoxelPopEntitlement(sessionId);
    if (!entitlement) return NextResponse.json({ error: 'A completed VoxelPop purchase is required.' }, { status: 403 });
    if (entitlement.metadata?.mesh_task_0 !== taskId) return NextResponse.json({ error: 'The mint does not match this VoxelPop mesh.' }, { status: 403 });

    await verifyMintOnChain(contractAddress, tokenId, txHash, wallet, metadataUrl);

    try {
      await updateVoxelPopEntitlementMetadata(entitlement, {
        voxelflip_wallet: wallet.toLowerCase(),
        voxelflip_metadata_url: metadataUrl.slice(0, 500),
        voxelflip_token_id: tokenId.slice(0, 80),
        voxelflip_tx_hash: txHash,
      });
    } catch (error) {
      console.warn('VoxelFlip mint confirmed on-chain; optional entitlement persistence is unavailable.', error);
    }

    const attribution = attributionFromMetadata(entitlement.metadata);
    await recordVoxelPopEvent({
      eventName: 'nft_minted', eventKey: `nft_minted:${contractAddress.toLowerCase()}:${tokenId}`, flowId: entitlement.metadata?.flow_id || null,
      stripeSessionId: entitlement.paymentMethod === 'stripe' ? entitlement.id : null, attribution,
      details: { tokenId, wallet: wallet.toLowerCase(), chain: 'Base', payment_method: entitlement.paymentMethod },
    });

    return NextResponse.json({ confirmed: true, tokenId, wallet, contractAddress, openSeaUrl: openSeaUrl(contractAddress, tokenId), explorerUrl: `${process.env.NEXT_PUBLIC_VOXELFLIP_EXPLORER_URL || 'https://basescan.org'}/tx/${txHash}` });
  } catch (error) {
    console.error('VoxelFlip mint confirmation failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to verify the VoxelFlip mint right now.' }, { status: 500 });
  }
}
