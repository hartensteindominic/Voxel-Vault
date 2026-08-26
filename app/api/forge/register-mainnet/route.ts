import { Contract, JsonRpcProvider, getAddress, isAddress, parseEther } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';
import { revenueForgeSigningWallet, saveRevenueForgeDeployment } from '../../../../lib/forge-revenue-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BASE_CHAIN_ID = 8453;
const LAUNCH_FEE = parseEther('0.001');
const LAUNCH_ROYALTY_BPS = 500;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const FORGE_ABI = [
  'function owner() view returns (address)',
  'function forgeSigner() view returns (address)',
  'function treasury() view returns (address)',
  'function forgeFee() view returns (uint256)',
  'function royaltyBps() view returns (uint96)',
  'function approvedParentCollections(address) view returns (bool)',
  'function paused() view returns (bool)',
];

function rpcCandidates() {
  return Array.from(new Set([
    String(process.env.BASE_RPC_URL || '').trim(),
    String(process.env.VOXELFLIP_RPC_URL || '').trim(),
    'https://base.blockscout.com/api/eth-rpc',
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base-rpc.publicnode.com',
  ].filter(Boolean)));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 6_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Base RPC timed out.')), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function providerForBase() {
  for (const url of rpcCandidates()) {
    const provider = new JsonRpcProvider(url, BASE_CHAIN_ID, { staticNetwork: true });
    try {
      await withTimeout(provider.getBlockNumber(), 4_000);
      return provider;
    } catch {
      provider.destroy();
    }
  }
  throw new Error('No Base RPC is available to verify the deployment.');
}

export async function POST(request: Request) {
  let provider: JsonRpcProvider | null = null;
  try {
    const body = await request.json();
    const walletRaw = String(body?.wallet || '').trim();
    const addressRaw = String(body?.address || '').trim();
    const txHash = String(body?.txHash || '').trim();
    if (!isAddress(walletRaw) || !isAddress(addressRaw) || !TX_RE.test(txHash)) {
      return NextResponse.json({ error: 'A valid owner wallet, deployed contract address, and deployment transaction hash are required.' }, { status: 400 });
    }

    const wallet = getAddress(walletRaw);
    const address = getAddress(addressRaw);
    const parent = await getVoxelFlipDeployment();
    const approvedOwner = getAddress(parent.owner);
    if (wallet !== approvedOwner) {
      return NextResponse.json({ error: 'Only the reviewed VoxelFlip owner wallet can register the production revenue Forge.' }, { status: 403 });
    }

    provider = await providerForBase();
    const [receipt, tx] = await withTimeout(Promise.all([
      provider.getTransactionReceipt(txHash),
      provider.getTransaction(txHash),
    ]), 8_000);
    if (!receipt || receipt.status !== 1 || !receipt.contractAddress) throw new Error('The Base deployment transaction is not confirmed successfully.');
    if (getAddress(receipt.contractAddress) !== address) throw new Error('Deployment transaction does not match the submitted Forge address.');
    if (!tx || getAddress(tx.from) !== approvedOwner) throw new Error('The Forge was not deployed by the reviewed owner wallet.');

    const code = await withTimeout(provider.getCode(address));
    if (!code || code === '0x') throw new Error('No contract bytecode exists at the submitted Base address.');

    const forge = new Contract(address, FORGE_ABI, provider);
    const [owner, forgeSigner, treasury, feeWei, royaltyBps, parentApproved, paused] = await withTimeout(Promise.all([
      forge.owner(),
      forge.forgeSigner(),
      forge.treasury(),
      forge.forgeFee(),
      forge.royaltyBps(),
      forge.approvedParentCollections(parent.address),
      forge.paused(),
    ]), 8_000);

    const expectedSigner = revenueForgeSigningWallet().address;
    if (getAddress(owner) !== approvedOwner) throw new Error('Production Forge owner does not match the reviewed VoxelFlip owner.');
    if (getAddress(treasury) !== approvedOwner) throw new Error('Production Forge treasury does not match the reviewed owner wallet.');
    if (getAddress(forgeSigner) !== getAddress(expectedSigner)) throw new Error('Production Forge signer does not match the protected server-derived signer.');
    if (BigInt(feeWei) !== LAUNCH_FEE) throw new Error('Production Forge launch fee is not 0.001 ETH.');
    if (Number(royaltyBps) !== LAUNCH_ROYALTY_BPS) throw new Error('Production Forge royalty is not the reviewed 500 bps.');
    if (!parentApproved) throw new Error('The reviewed VoxelFlip Base collection is not approved as a parent collection.');
    if (paused) throw new Error('The newly deployed production Forge is unexpectedly paused.');

    const block = await withTimeout(provider.getBlock(receipt.blockNumber)).catch(() => null);
    const record = await saveRevenueForgeDeployment({
      chainId: 8453,
      network: 'base',
      address,
      deploymentTxHash: txHash,
      owner: approvedOwner,
      forgeSigner: getAddress(forgeSigner),
      treasury: getAddress(treasury),
      parentCollection: getAddress(parent.address),
      forgeFeeWei: BigInt(feeWei).toString(),
      royaltyBps: Number(royaltyBps),
      deployedAt: block?.timestamp ? new Date(Number(block.timestamp) * 1000).toISOString() : '',
      registeredAt: new Date().toISOString(),
    });

    return NextResponse.json({ registered: true, deployment: record }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Revenue Forge registration failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not verify/register the Base revenue Forge.' }, { status: 400 });
  } finally {
    provider?.destroy();
  }
}
