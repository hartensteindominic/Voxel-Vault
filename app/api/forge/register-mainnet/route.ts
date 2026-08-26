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
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Base RPC timed out.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type VerifiedDeployment = {
  forgeSigner: string;
  treasury: string;
  feeWei: bigint;
  royaltyBps: number;
  deployedAt: string;
};

async function verifyAcrossBaseProviders(params: {
  address: string;
  txHash: string;
  approvedOwner: string;
  parentCollection: string;
  expectedSigner: string;
}): Promise<VerifiedDeployment> {
  let lastError = 'No Base RPC completed the verification.';

  for (const url of rpcCandidates()) {
    const provider = new JsonRpcProvider(url, BASE_CHAIN_ID, { staticNetwork: true });
    try {
      await withTimeout(provider.getBlockNumber(), 4_000);

      const [receipt, tx, code] = await withTimeout(Promise.all([
        provider.getTransactionReceipt(params.txHash),
        provider.getTransaction(params.txHash),
        provider.getCode(params.address),
      ]), 10_000);

      if (!receipt || receipt.status !== 1 || !receipt.contractAddress) {
        throw new Error('The Base deployment transaction is not confirmed successfully.');
      }
      if (getAddress(receipt.contractAddress) !== params.address) {
        throw new Error('Deployment transaction does not match the submitted Forge address.');
      }
      if (!tx || getAddress(tx.from) !== params.approvedOwner) {
        throw new Error('The Forge was not deployed by the reviewed owner wallet.');
      }
      if (!code || code === '0x') {
        throw new Error('No contract bytecode exists at the submitted Base address.');
      }

      const forge = new Contract(params.address, FORGE_ABI, provider);
      // Read getters individually. Some public Base RPCs intermittently fail one
      // eth_call while accepting others; a failed provider is retried as a whole.
      const owner = getAddress(await withTimeout(forge.owner(), 6_000));
      const forgeSigner = getAddress(await withTimeout(forge.forgeSigner(), 6_000));
      const treasury = getAddress(await withTimeout(forge.treasury(), 6_000));
      const feeWei = BigInt(await withTimeout(forge.forgeFee(), 6_000));
      const royaltyBps = Number(await withTimeout(forge.royaltyBps(), 6_000));
      const parentApproved = Boolean(await withTimeout(forge.approvedParentCollections(params.parentCollection), 6_000));
      const paused = Boolean(await withTimeout(forge.paused(), 6_000));

      if (owner !== params.approvedOwner) throw new Error('Production Forge owner does not match the reviewed VoxelFlip owner.');
      if (treasury !== params.approvedOwner) throw new Error('Production Forge treasury does not match the reviewed owner wallet.');
      if (forgeSigner !== params.expectedSigner) throw new Error('Production Forge signer does not match the protected Forge signer.');
      if (feeWei !== LAUNCH_FEE) throw new Error('Production Forge launch fee is not 0.001 ETH.');
      if (royaltyBps !== LAUNCH_ROYALTY_BPS) throw new Error('Production Forge royalty is not the reviewed 500 bps.');
      if (!parentApproved) throw new Error('The reviewed VoxelFlip Base collection is not approved as a parent collection.');
      if (paused) throw new Error('The newly deployed production Forge is unexpectedly paused.');

      const block = await withTimeout(provider.getBlock(receipt.blockNumber), 6_000).catch(() => null);
      return {
        forgeSigner,
        treasury,
        feeWei,
        royaltyBps,
        deployedAt: block?.timestamp ? new Date(Number(block.timestamp) * 1000).toISOString() : '',
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error || 'Base verification failed.');
    } finally {
      provider.destroy();
    }
  }

  throw new Error(`Could not verify the existing Base Forge yet. ${lastError}`);
}

export async function POST(request: Request) {
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

    const expectedSigner = getAddress(revenueForgeSigningWallet().address);
    const verified = await verifyAcrossBaseProviders({
      address,
      txHash,
      approvedOwner,
      parentCollection: getAddress(parent.address),
      expectedSigner,
    });

    const record = await saveRevenueForgeDeployment({
      chainId: 8453,
      network: 'base',
      address,
      deploymentTxHash: txHash,
      owner: approvedOwner,
      forgeSigner: verified.forgeSigner,
      treasury: verified.treasury,
      parentCollection: getAddress(parent.address),
      forgeFeeWei: verified.feeWei.toString(),
      royaltyBps: verified.royaltyBps,
      deployedAt: verified.deployedAt,
      registeredAt: new Date().toISOString(),
    });

    return NextResponse.json({ registered: true, deployment: record }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Revenue Forge registration failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not verify/register the Base revenue Forge.' }, { status: 400 });
  }
}
