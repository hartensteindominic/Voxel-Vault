import { Contract, JsonRpcProvider } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../../lib/voxelflip-deployment';
import { getVoxelPopEntitlement, updateVoxelPopEntitlementMetadata } from '../../../../../lib/voxelpop-entitlement';
import { attributionFromMetadata, recordVoxelPopEvent } from '../../../../../lib/voxelpop-analytics';

export const runtime = 'nodejs';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const ABI = ['function ownerOf(uint256 tokenId) view returns (address)','function tokenURI(uint256 tokenId) view returns (string)'];

function rpcCandidates() {
  const configured = (process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || '').trim();
  // PublicNode's Base endpoint can reject ordinary verification calls as archive
  // requests unless a provider token is supplied. Do not use it as a fallback.
  return Array.from(new Set([configured, 'https://mainnet.base.org', 'https://base.llamarpc.com'].filter(Boolean)));
}

function readableRpcError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || 'Unknown RPC error');
}

async function verifyMintOnChain(contractAddress: string, tokenId: string, txHash: string, wallet: string, metadataUrl: string) {
  const transportErrors: string[] = [];
  let receiptSeen = false;

  for (const rpcUrl of rpcCandidates()) {
    try {
      const provider = new JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        transportErrors.push(`${rpcUrl}: transaction not visible yet`);
        continue;
      }
      receiptSeen = true;

      // These are deterministic validation failures. If an RPC successfully
      // returned the receipt, do not hide them behind a later transport error.
      if (receipt.status !== 1) throw new Error('The mint transaction failed on Base.');
      if (receipt.to?.toLowerCase() !== contractAddress.toLowerCase()) throw new Error('The transaction did not mint from the registered VoxelFlip contract.');

      let owner: string;
      let uri: string;
      try {
        const contract = new Contract(contractAddress, ABI, provider);
        [owner, uri] = await Promise.all([contract.ownerOf(tokenId), contract.tokenURI(tokenId)]);
      } catch (error) {
        transportErrors.push(`${rpcUrl}: ${readableRpcError(error)}`);
        continue;
      }

      if (String(owner).toLowerCase() !== wallet.toLowerCase()) throw new Error('The connected wallet does not own this VoxelFlip token.');
      if (String(uri) !== metadataUrl) throw new Error('The minted token metadata does not match this VoxelPop asset.');
      return;
    } catch (error) {
      const message = readableRpcError(error);
      if (
        message.includes('mint transaction failed on Base') ||
        message.includes('did not mint from the registered VoxelFlip contract') ||
        message.includes('does not own this VoxelFlip token') ||
        message.includes('metadata does not match')
      ) {
        throw error;
      }
      transportErrors.push(`${rpcUrl}: ${message}`);
    }
  }

  if (!receiptSeen) {
    throw new Error('Your mint transaction was submitted, but Base has not exposed the receipt to our verifier yet. Use Resume mint verification instead of minting again.');
  }
  console.warn('VoxelFlip RPC verification exhausted', transportErrors);
  throw new Error('Your VoxelFlip transaction is on Base, but verification is temporarily unavailable. Use Resume mint verification instead of minting again.');
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
    if (!sessionId || !taskId || !/^\d+$/.test(tokenId) || !TX_RE.test(txHash) || !ADDRESS_RE.test(wallet) || !/^https:\/\//i.test(metadataUrl)) return NextResponse.json({ error: 'Mint confirmation details are incomplete.' }, { status: 400 });
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
    } catch (error) { console.warn('VoxelFlip mint confirmed on-chain; optional entitlement persistence is unavailable.', error); }

    const attribution = attributionFromMetadata(entitlement.metadata);
    await recordVoxelPopEvent({
      eventName: 'nft_minted', eventKey: `nft_minted:${contractAddress.toLowerCase()}:${tokenId}`, flowId: entitlement.metadata?.flow_id || null,
      stripeSessionId: entitlement.id, attribution,
      details: { tokenId, wallet: wallet.toLowerCase(), chain: 'Base', payment_method: 'stripe' },
    });

    return NextResponse.json({
      confirmed: true,
      tokenId,
      wallet,
      contractAddress,
      openSeaUrl: `https://opensea.io/assets/base/${contractAddress}/${tokenId}`,
      explorerUrl: `${process.env.NEXT_PUBLIC_VOXELFLIP_EXPLORER_URL || 'https://basescan.org'}/tx/${txHash}`,
    });
  } catch (error) {
    console.error('VoxelFlip mint confirmation failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to verify the VoxelFlip mint right now.' }, { status: 500 });
  }
}
