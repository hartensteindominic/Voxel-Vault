import { createHash } from 'crypto';
import { Contract, id, JsonRpcProvider } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../../lib/voxelflip-deployment';
import { getVoxelPopEntitlement, updateVoxelPopEntitlementMetadata } from '../../../../../lib/voxelpop-entitlement';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const TASK_KEY = 'mesh_task_0';
const VOXELFLIP_MINT_TOPIC = id('VoxelFlipMinted(uint256,address,bytes32,string)');
const ABI = [
  'function usedVouchers(bytes32 voucherId) view returns (bool)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];
const RPC_TIMEOUT_MS = 5_000;
const RECOVERY_BUDGET_MS = 26_000;
const LOG_CHUNK = 5_000;
const OPTIONAL_WRITE_TIMEOUT_MS = 4_000;

function voucherIdFor(sessionId: string, taskId: string) {
  return `0x${createHash('sha256').update(`voxelflip:${sessionId}:${taskId}`).digest('hex')}`;
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

async function verifyKnownMint(provider: JsonRpcProvider, contractAddress: string, wallet: string, tokenId: string, txHash: string) {
  if (!/^\d+$/.test(tokenId) || !TX_RE.test(txHash)) return null;
  const contract = new Contract(contractAddress, ABI, provider);
  const [owner, tokenURI, receipt] = await withTimeout(Promise.all([
    contract.ownerOf(tokenId),
    contract.tokenURI(tokenId),
    provider.getTransactionReceipt(txHash),
  ]), RPC_TIMEOUT_MS, 'stored VoxelFlip verification');
  if (!receipt || receipt.status !== 1) return null;
  if (String(receipt.to || '').toLowerCase() !== contractAddress.toLowerCase()) return null;
  if (String(owner).toLowerCase() !== wallet.toLowerCase()) return null;
  return { tokenId, txHash, owner: String(owner), metadataUrl: String(tokenURI) };
}

async function recoverViaRpc(rpcUrl: string, contractAddress: string, wallet: string, voucherId: string, deploymentTxHash: string, known: { tokenId: string; txHash: string } | null, deadline: number) {
  const provider = new JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
  try {
    const remaining = () => Math.max(650, Math.min(RPC_TIMEOUT_MS, deadline - Date.now()));
    if (known && Date.now() < deadline) {
      try {
        const verified = await verifyKnownMint(provider, contractAddress, wallet, known.tokenId, known.txHash);
        if (verified) return { checked: true, used: true, mint: verified };
      } catch {}
    }

    const contract = new Contract(contractAddress, ABI, provider);
    const used = Boolean(await withTimeout(contract.usedVouchers(voucherId), remaining(), 'Base voucher lookup'));
    if (!used) return { checked: true, used: false, mint: null };

    const [latest, deploymentReceipt] = await withTimeout(Promise.all([
      provider.getBlockNumber(),
      deploymentTxHash ? provider.getTransactionReceipt(deploymentTxHash) : Promise.resolve(null),
    ]), remaining(), 'Base recovery range lookup');
    const deploymentBlock = Number(deploymentReceipt?.blockNumber || 0);
    const firstBlock = deploymentBlock > 0 ? deploymentBlock : Math.max(0, latest - 220_000);

    let toBlock = latest;
    while (toBlock >= firstBlock && Date.now() < deadline) {
      const fromBlock = Math.max(firstBlock, toBlock - LOG_CHUNK + 1);
      const logs = await withTimeout(provider.getLogs({
        address: contractAddress,
        fromBlock,
        toBlock,
        topics: [VOXELFLIP_MINT_TOPIC, null, null, voucherId],
      }), remaining(), 'VoxelFlip mint-event lookup');
      if (logs.length) {
        const log = logs[logs.length - 1];
        const tokenTopic = log.topics?.[1];
        const ownerTopic = log.topics?.[2];
        if (!tokenTopic || !ownerTopic) throw new Error('Recovered VoxelFlip event was incomplete.');
        const tokenId = BigInt(tokenTopic).toString();
        const mintedOwner = `0x${ownerTopic.slice(-40)}`;
        if (mintedOwner.toLowerCase() !== wallet.toLowerCase()) {
          return { checked: true, used: true, mint: null, ownerMismatch: mintedOwner };
        }
        const [currentOwner, tokenURI] = await withTimeout(Promise.all([
          contract.ownerOf(tokenId),
          contract.tokenURI(tokenId),
        ]), remaining(), 'Recovered VoxelFlip owner lookup');
        if (String(currentOwner).toLowerCase() !== wallet.toLowerCase()) {
          return { checked: true, used: true, mint: null, ownerMismatch: String(currentOwner) };
        }
        return {
          checked: true,
          used: true,
          mint: { tokenId, txHash: log.transactionHash, owner: String(currentOwner), metadataUrl: String(tokenURI) },
        };
      }
      if (fromBlock === firstBlock) break;
      toBlock = fromBlock - 1;
    }

    return { checked: true, used: true, mint: null };
  } finally {
    provider.destroy();
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
    const taskId = typeof body?.taskId === 'string' ? body.taskId : '';
    const wallet = typeof body?.wallet === 'string' ? body.wallet.trim() : '';
    if (!sessionId || !taskId || !ADDRESS_RE.test(wallet)) {
      return NextResponse.json({ error: 'A connected wallet and completed VoxelPop mesh are required.' }, { status: 400 });
    }

    const entitlement = await getVoxelPopEntitlement(sessionId);
    if (!entitlement) return NextResponse.json({ error: 'A completed VoxelPop purchase is required.' }, { status: 403 });
    if (entitlement.metadata?.[TASK_KEY] !== taskId) return NextResponse.json({ error: 'This 3D mesh does not belong to the current purchase.' }, { status: 403 });

    const deployment = await getVoxelFlipDeployment();
    const contractAddress = String(deployment?.address || '').trim();
    if (!ADDRESS_RE.test(contractAddress)) return NextResponse.json({ error: 'VoxelFlip contract is not configured.' }, { status: 503 });

    const voucherId = voucherIdFor(sessionId, taskId);
    const storedTokenId = String(entitlement.metadata?.voxelflip_token_id || '').trim();
    const storedTxHash = String(entitlement.metadata?.voxelflip_tx_hash || '').trim();
    const storedWallet = String(entitlement.metadata?.voxelflip_wallet || '').trim();
    const known = /^\d+$/.test(storedTokenId) && TX_RE.test(storedTxHash) && (!storedWallet || storedWallet.toLowerCase() === wallet.toLowerCase())
      ? { tokenId: storedTokenId, txHash: storedTxHash }
      : null;

    const deadline = Date.now() + RECOVERY_BUDGET_MS;
    let voucherUsed = false;
    let checked = false;
    let lastError = '';
    for (const rpcUrl of rpcCandidates()) {
      if (Date.now() >= deadline) break;
      try {
        const result = await recoverViaRpc(rpcUrl, contractAddress, wallet, voucherId, String(deployment?.deploymentTxHash || ''), known, deadline);
        checked = checked || result.checked;
        voucherUsed = voucherUsed || result.used;
        if (result.ownerMismatch) {
          return NextResponse.json({
            error: `This VoxelFlip exists, but it is currently owned by ${result.ownerMismatch}. No new mint was sent.`,
            recovered: false,
            voucherUsed: true,
          }, { status: 409 });
        }
        if (result.mint) {
          try {
            await withTimeout(updateVoxelPopEntitlementMetadata(entitlement, {
              voxelflip_wallet: wallet.toLowerCase(),
              voxelflip_metadata_url: String(result.mint.metadataUrl).slice(0, 500),
              voxelflip_token_id: String(result.mint.tokenId).slice(0, 80),
              voxelflip_tx_hash: String(result.mint.txHash),
            }), OPTIONAL_WRITE_TIMEOUT_MS, 'VoxelFlip recovery persistence');
          } catch (error) {
            console.warn('Recovered VoxelFlip could not be persisted to entitlement metadata.', error);
          }
          return NextResponse.json({
            recovered: true,
            voucherUsed: true,
            existingMint: result.mint,
            contractAddress,
            openSeaUrl: `https://opensea.io/assets/base/${contractAddress}/${result.mint.tokenId}`,
            explorerUrl: `${process.env.NEXT_PUBLIC_VOXELFLIP_EXPLORER_URL || 'https://basescan.org'}/tx/${result.mint.txHash}`,
            safety: 'Read-only recovery completed. No mint transaction was created.',
          }, { headers: { 'Cache-Control': 'no-store' } });
        }
        if (result.checked && !result.used) {
          return NextResponse.json({
            recovered: false,
            voucherUsed: false,
            error: 'No existing VoxelFlip mint was found for this purchase. No transaction was sent.',
          }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error || 'Base recovery failed');
        console.warn('VoxelFlip recovery RPC unavailable', rpcUrl, error);
      }
    }

    if (voucherUsed || checked) {
      return NextResponse.json({
        recovered: false,
        voucherUsed,
        error: voucherUsed
          ? 'The voucher is already used, but Base did not return the original mint event in time. No transaction was sent. Try recovery again.'
          : 'Base did not return an existing mint. No transaction was sent.',
      }, { status: voucherUsed ? 409 : 503, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({
      recovered: false,
      error: `Base recovery is temporarily unavailable${lastError ? `: ${lastError}` : '.'} No transaction was sent.`,
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('VoxelFlip read-only recovery failed', error);
    return NextResponse.json({ error: 'Unable to recover the existing VoxelFlip right now. No transaction was sent.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
