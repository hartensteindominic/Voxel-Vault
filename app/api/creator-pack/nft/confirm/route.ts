import { Contract, JsonRpcProvider } from 'ethers';
import { NextResponse } from 'next/server';
import { stripe } from '../../../../../lib/stripe-server';
import { attributionFromMetadata, recordVoxelPopEvent } from '../../../../../lib/voxelpop-analytics';

export const runtime = 'nodejs';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];

function openSeaUrl(contract: string, tokenId: string) {
  const chainId = String(process.env.NEXT_PUBLIC_VOXELFLIP_CHAIN_ID || '0x2105').toLowerCase();
  if (chainId === '0x14a34') return `https://testnets.opensea.io/assets/base_sepolia/${contract}/${tokenId}`;
  if (chainId === '0xaa36a7') return `https://testnets.opensea.io/assets/sepolia/${contract}/${tokenId}`;
  if (chainId === '0x1') return `https://opensea.io/assets/ethereum/${contract}/${tokenId}`;
  return `https://opensea.io/assets/base/${contract}/${tokenId}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
    const taskId = typeof body?.taskId === 'string' ? body.taskId : '';
    const tokenId = String(body?.tokenId || '').trim();
    const txHash = typeof body?.txHash === 'string' ? body.txHash.trim() : '';
    const wallet = typeof body?.wallet === 'string' ? body.wallet.trim() : '';
    const contractAddress = process.env.NEXT_PUBLIC_VOXELFLIP_NFT_ADDRESS || '';
    const rpcUrl = process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || 'https://mainnet.base.org';

    if (!sessionId || !taskId || !/^\d+$/.test(tokenId) || !TX_RE.test(txHash) || !ADDRESS_RE.test(wallet)) {
      return NextResponse.json({ error: 'Mint confirmation details are incomplete.' }, { status: 400 });
    }
    if (!ADDRESS_RE.test(contractAddress)) {
      return NextResponse.json({ error: 'VoxelFlip contract is not configured.' }, { status: 503 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid' || session.metadata?.product !== 'voxelpop-3d-asset') {
      return NextResponse.json({ error: 'A completed VoxelPop purchase is required.' }, { status: 403 });
    }
    if (session.metadata?.mesh_task_0 !== taskId) {
      return NextResponse.json({ error: 'The mint does not match this VoxelPop mesh.' }, { status: 403 });
    }
    if (session.metadata?.voxelflip_wallet?.toLowerCase() !== wallet.toLowerCase()) {
      return NextResponse.json({ error: 'The mint wallet does not match the prepared VoxelFlip.' }, { status: 403 });
    }

    const provider = new JsonRpcProvider(rpcUrl);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      return NextResponse.json({ error: 'The mint transaction is not confirmed yet.' }, { status: 409 });
    }
    if (receipt.to?.toLowerCase() !== contractAddress.toLowerCase()) {
      return NextResponse.json({ error: 'The transaction did not mint from the VoxelFlip contract.' }, { status: 409 });
    }

    const contract = new Contract(contractAddress, ABI, provider);
    const [owner, uri] = await Promise.all([contract.ownerOf(tokenId), contract.tokenURI(tokenId)]);
    if (String(owner).toLowerCase() !== wallet.toLowerCase()) {
      return NextResponse.json({ error: 'The connected wallet does not own this VoxelFlip token.' }, { status: 409 });
    }
    if (!session.metadata?.voxelflip_metadata_url || String(uri) !== session.metadata.voxelflip_metadata_url) {
      return NextResponse.json({ error: 'The minted token metadata does not match this VoxelPop asset.' }, { status: 409 });
    }

    await stripe.checkout.sessions.update(sessionId, {
      metadata: {
        ...(session.metadata || {}),
        voxelflip_token_id: tokenId.slice(0, 80),
        voxelflip_tx_hash: txHash,
      },
    });

    const attribution = attributionFromMetadata(session.metadata);
    await recordVoxelPopEvent({
      eventName: 'nft_minted',
      eventKey: `nft_minted:${contractAddress.toLowerCase()}:${tokenId}`,
      flowId: session.metadata?.flow_id || null,
      stripeSessionId: sessionId,
      attribution,
      details: { tokenId, wallet: wallet.toLowerCase(), chain: process.env.NEXT_PUBLIC_VOXELFLIP_CHAIN_NAME || 'Base' },
    });

    return NextResponse.json({
      confirmed: true,
      tokenId,
      wallet,
      openSeaUrl: openSeaUrl(contractAddress, tokenId),
      explorerUrl: `${process.env.NEXT_PUBLIC_VOXELFLIP_EXPLORER_URL || 'https://basescan.org'}/tx/${txHash}`,
    });
  } catch (error) {
    console.error('VoxelFlip mint confirmation failed', error);
    return NextResponse.json({ error: 'Unable to verify the VoxelFlip mint right now.' }, { status: 500 });
  }
}
