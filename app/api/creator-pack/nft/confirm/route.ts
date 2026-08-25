import { Contract, JsonRpcProvider, formatEther } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../../lib/voxelflip-deployment';
import { getVoxelPopEntitlement, updateVoxelPopEntitlementMetadata } from '../../../../../lib/voxelpop-entitlement';
import { attributionFromMetadata, recordVoxelPopEvent } from '../../../../../lib/voxelpop-analytics';
import { recordVoxelFlipLedgerEntry } from '../../../../../lib/voxelflip-profit-ledger';

export const runtime = 'nodejs';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const ABI = ['function ownerOf(uint256 tokenId) view returns (address)','function tokenURI(uint256 tokenId) view returns (string)'];
const RECEIPT_TIMEOUT_MS = 4500;
const CONTRACT_READ_TIMEOUT_MS = 5500;
const ENTITLEMENT_TIMEOUT_MS = 8000;
const OPTIONAL_WRITE_TIMEOUT_MS = 5000;

class RpcTransportError extends Error {
  receiptSeen: boolean;
  constructor(message: string, receiptSeen: boolean) {
    super(message);
    this.name = 'RpcTransportError';
    this.receiptSeen = receiptSeen;
  }
}

function rpcCandidates() {
  const configured = (process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || '').trim();
  return Array.from(new Set([
    configured,
    'https://base.blockscout.com/api/eth-rpc',
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
  ].filter(Boolean)));
}

function readableRpcError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || 'Unknown RPC error');
}

function isDeterministicValidationError(error: unknown) {
  const message = readableRpcError(error);
  return (
    message.includes('mint transaction failed on Base') ||
    message.includes('did not mint from the registered VoxelFlip contract') ||
    message.includes('does not own this VoxelFlip token') ||
    message.includes('metadata does not match')
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function bigintValue(value: unknown) {
  try {
    if (typeof value === 'bigint') return value;
    return BigInt(String(value ?? 0));
  } catch {
    return 0n;
  }
}

async function verifyMintViaRpc(rpcUrl: string, contractAddress: string, tokenId: string, txHash: string, wallet: string, metadataUrl: string) {
  const provider = new JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
  let receiptSeen = false;
  try {
    const receipt = await withTimeout(provider.getTransactionReceipt(txHash), RECEIPT_TIMEOUT_MS, 'transaction receipt lookup');
    if (!receipt) throw new RpcTransportError(`${rpcUrl}: transaction not visible yet`, false);
    receiptSeen = true;

    if (receipt.status !== 1) throw new Error('The mint transaction failed on Base.');
    if (receipt.to?.toLowerCase() !== contractAddress.toLowerCase()) throw new Error('The transaction did not mint from the registered VoxelFlip contract.');

    const contract = new Contract(contractAddress, ABI, provider);
    const [owner, uri] = await withTimeout(
      Promise.all([contract.ownerOf(tokenId), contract.tokenURI(tokenId)]),
      CONTRACT_READ_TIMEOUT_MS,
      'VoxelFlip owner and metadata lookup',
    );

    if (String(owner).toLowerCase() !== wallet.toLowerCase()) throw new Error('The connected wallet does not own this VoxelFlip token.');
    if (String(uri) !== metadataUrl) throw new Error('The minted token metadata does not match this VoxelPop asset.');

    const receiptAny = receipt as any;
    const gasUsed = bigintValue(receiptAny.gasUsed);
    const gasPrice = bigintValue(receiptAny.gasPrice ?? receiptAny.effectiveGasPrice);
    const feeWei = bigintValue(receiptAny.fee) || gasUsed * gasPrice;
    const gasPayer = String(receiptAny.from || '').toLowerCase();
    return {
      mintFeeEth: Number(formatEther(feeWei)),
      gasPayer: ADDRESS_RE.test(gasPayer) ? gasPayer : '',
      costAttributableToOwner: gasPayer === wallet.toLowerCase(),
    };
  } catch (error) {
    if (error instanceof RpcTransportError || isDeterministicValidationError(error)) throw error;
    throw new RpcTransportError(`${rpcUrl}: ${readableRpcError(error)}`, receiptSeen);
  } finally {
    provider.destroy();
  }
}

async function verifyMintOnChain(contractAddress: string, tokenId: string, txHash: string, wallet: string, metadataUrl: string) {
  const attempts = rpcCandidates().map(rpcUrl => verifyMintViaRpc(rpcUrl, contractAddress, tokenId, txHash, wallet, metadataUrl));
  try {
    return await Promise.any(attempts);
  } catch (error) {
    const errors = error instanceof AggregateError ? error.errors : [error];
    const deterministic = errors.find(item => !(item instanceof RpcTransportError));
    if (deterministic) throw deterministic;

    const receiptSeen = errors.some(item => item instanceof RpcTransportError && item.receiptSeen);
    const messages = errors.map(readableRpcError);
    console.warn('VoxelFlip RPC verification exhausted', messages);

    if (!receiptSeen) {
      throw new Error('Your mint transaction was submitted, but Base has not exposed the receipt to our verifier yet. Use Resume mint verification instead of minting again.');
    }
    throw new Error('Your VoxelFlip transaction is on Base, but verification is temporarily unavailable. Use Resume mint verification instead of minting again.');
  }
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

    const entitlement = await withTimeout(getVoxelPopEntitlement(sessionId), ENTITLEMENT_TIMEOUT_MS, 'VoxelPop purchase verification');
    if (!entitlement) return NextResponse.json({ error: 'A completed VoxelPop purchase is required.' }, { status: 403 });
    if (entitlement.metadata?.mesh_task_0 !== taskId) return NextResponse.json({ error: 'The mint does not match this VoxelPop mesh.' }, { status: 403 });

    const chainVerification = await verifyMintOnChain(contractAddress, tokenId, txHash, wallet, metadataUrl);

    try {
      await withTimeout(updateVoxelPopEntitlementMetadata(entitlement, {
        voxelflip_wallet: wallet.toLowerCase(),
        voxelflip_metadata_url: metadataUrl.slice(0, 500),
        voxelflip_token_id: tokenId.slice(0, 80),
        voxelflip_tx_hash: txHash,
      }), OPTIONAL_WRITE_TIMEOUT_MS, 'VoxelFlip entitlement persistence');
    } catch (error) {
      console.warn('VoxelFlip mint confirmed on-chain; optional entitlement persistence is unavailable.', error);
    }

    if (chainVerification.costAttributableToOwner && chainVerification.mintFeeEth >= 0) {
      try {
        await withTimeout(recordVoxelFlipLedgerEntry({
          wallet,
          contractAddress,
          tokenId,
          sessionId,
          entryType: 'mint_gas',
          direction: 'cost',
          amountEth: chainVerification.mintFeeEth,
          source: 'base',
          sourceRef: `base:mint:${txHash.toLowerCase()}`,
          txHash,
          settlementStatus: 'verified',
          metadata: { taskId, gasPayer: chainVerification.gasPayer },
        }), OPTIONAL_WRITE_TIMEOUT_MS, 'VoxelFlip mint cost ledger');
      } catch (error) {
        console.warn('VoxelFlip mint confirmed; mint gas could not be persisted to the profit ledger.', error);
      }
    } else if (!chainVerification.costAttributableToOwner) {
      console.warn('VoxelFlip mint gas payer differs from the owner wallet; cost was not attributed automatically.', { wallet, gasPayer: chainVerification.gasPayer, txHash });
    }

    const attribution = attributionFromMetadata(entitlement.metadata);
    try {
      await withTimeout(recordVoxelPopEvent({
        eventName: 'nft_minted', eventKey: `nft_minted:${contractAddress.toLowerCase()}:${tokenId}`, flowId: entitlement.metadata?.flow_id || null,
        stripeSessionId: entitlement.id, attribution,
        details: { tokenId, wallet: wallet.toLowerCase(), chain: 'Base', payment_method: 'stripe' },
      }), OPTIONAL_WRITE_TIMEOUT_MS, 'VoxelFlip mint analytics');
    } catch (error) {
      console.warn('VoxelFlip mint confirmed on-chain; optional mint analytics are unavailable.', error);
    }

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
