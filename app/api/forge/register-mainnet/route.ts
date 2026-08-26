import { Contract, JsonRpcProvider, getAddress, id, isAddress, parseEther } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';
import { revenueForgeSigningWallet, saveRevenueForgeDeployment } from '../../../../lib/forge-revenue-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BASE_CHAIN_ID = 8453;
const LAUNCH_FEE = parseEther('0.001');
const LAUNCH_ROYALTY_BPS = 500;
const EXPECTED_RUNTIME_BYTES = 11727;
const EXPECTED_NAME = 'Voxel Forge Descendant';
const EXPECTED_SYMBOL = 'VFORGE';
const EXPECTED_MAX_FORGE_FEE = parseEther('0.1');
const EXPECTED_MAX_ROYALTY_BPS = 1000;
const EXPECTED_FORGE_TYPEHASH = id('ForgeRequest(address account,address parentContract0,uint256 parentTokenId0,address parentContract1,uint256 parentTokenId1,address parentContract2,uint256 parentTokenId2,bytes32 descendantUriHash,uint256 feeWei,bytes32 requestId,uint64 deadline)');
const TX_RE = /^0x[a-fA-F0-9]{64}$/;

const FORGE_ABI = [
  'function owner() view returns (address)',
  'function forgeSigner() view returns (address)',
  'function treasury() view returns (address)',
  'function forgeFee() view returns (uint256)',
  'function royaltyBps() view returns (uint96)',
  'function approvedParentCollections(address) view returns (bool)',
  'function paused() view returns (bool)',
  'function MAX_FORGE_FEE() view returns (uint256)',
  'function MAX_ROYALTY_BPS() view returns (uint96)',
  'function FORGE_TYPEHASH() view returns (bytes32)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  'function eip712Domain() view returns (bytes1 fields,string name,string version,uint256 chainId,address verifyingContract,bytes32 salt,uint256[] extensions)',
  'function nextTokenId() view returns (uint256)',
  'function totalForges() view returns (uint256)',
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
  txHash?: string;
  approvedOwner: string;
  parentCollection: string;
  expectedSigner: string;
}): Promise<VerifiedDeployment> {
  let lastError = 'No Base RPC completed the verification.';

  for (const url of rpcCandidates()) {
    const provider = new JsonRpcProvider(url, BASE_CHAIN_ID, { staticNetwork: true });
    try {
      await withTimeout(provider.getBlockNumber(), 4_000);
      const code = await withTimeout(provider.getCode(params.address), 8_000);
      if (!code || code === '0x') throw new Error('No contract bytecode exists at the submitted Base address.');

      // VoxelForgeRevenue inherits OpenZeppelin EIP712. Solidity patches EIP-712
      // immutables (including the verifying contract/domain separator) into the
      // deployed runtime, so a raw hash of generic compiler runtime bytecode is
      // not stable across contract addresses. Length + contract behavior/domain
      // checks below are the deployment-safe fingerprint.
      const runtimeBytes = (code.length - 2) / 2;
      if (runtimeBytes !== EXPECTED_RUNTIME_BYTES) {
        throw new Error(`Unexpected Forge runtime size (${runtimeBytes} bytes). Expected ${EXPECTED_RUNTIME_BYTES}.`);
      }

      let deployedAt = '';
      if (params.txHash) {
        const [receipt, tx] = await withTimeout(Promise.all([
          provider.getTransactionReceipt(params.txHash),
          provider.getTransaction(params.txHash),
        ]), 10_000);
        if (!receipt || receipt.status !== 1 || !receipt.contractAddress) throw new Error('The Base deployment transaction is not confirmed successfully.');
        if (getAddress(receipt.contractAddress) !== params.address) throw new Error('Deployment transaction does not match the submitted Forge address.');
        if (!tx || getAddress(tx.from) !== params.approvedOwner) throw new Error('The Forge was not deployed by the reviewed owner wallet.');
        const block = await withTimeout(provider.getBlock(receipt.blockNumber), 6_000).catch(() => null);
        deployedAt = block?.timestamp ? new Date(Number(block.timestamp) * 1000).toISOString() : '';
      }

      const forge = new Contract(params.address, FORGE_ABI, provider);

      // Read each invariant separately so one flaky public RPC causes a provider
      // retry rather than a false negative for the whole production contract.
      const owner = getAddress(await withTimeout(forge.owner(), 6_000));
      const forgeSigner = getAddress(await withTimeout(forge.forgeSigner(), 6_000));
      const treasury = getAddress(await withTimeout(forge.treasury(), 6_000));
      const feeWei = BigInt(await withTimeout(forge.forgeFee(), 6_000));
      const royaltyBps = Number(await withTimeout(forge.royaltyBps(), 6_000));
      const parentApproved = Boolean(await withTimeout(forge.approvedParentCollections(params.parentCollection), 6_000));
      const paused = Boolean(await withTimeout(forge.paused(), 6_000));
      const maxForgeFee = BigInt(await withTimeout(forge.MAX_FORGE_FEE(), 6_000));
      const maxRoyaltyBps = Number(await withTimeout(forge.MAX_ROYALTY_BPS(), 6_000));
      const forgeTypehash = String(await withTimeout(forge.FORGE_TYPEHASH(), 6_000)).toLowerCase();
      const name = String(await withTimeout(forge.name(), 6_000));
      const symbol = String(await withTimeout(forge.symbol(), 6_000));
      const supports721 = Boolean(await withTimeout(forge.supportsInterface('0x80ac58cd'), 6_000));
      const supports2981 = Boolean(await withTimeout(forge.supportsInterface('0x2a55205a'), 6_000));
      const domain = await withTimeout(forge.eip712Domain(), 6_000);
      const domainName = String(domain[1]);
      const domainVersion = String(domain[2]);
      const domainChainId = BigInt(domain[3]);
      const domainContract = getAddress(domain[4]);
      const nextTokenId = BigInt(await withTimeout(forge.nextTokenId(), 6_000));
      const totalForges = BigInt(await withTimeout(forge.totalForges(), 6_000));

      if (owner !== params.approvedOwner) throw new Error('Production Forge owner does not match the reviewed VoxelFlip owner.');
      if (treasury !== params.approvedOwner) throw new Error('Production Forge treasury does not match the reviewed owner wallet.');
      if (forgeSigner !== params.expectedSigner) throw new Error('Production Forge signer does not match the protected Forge signer.');
      if (feeWei !== LAUNCH_FEE) throw new Error('Production Forge launch fee is not 0.001 ETH.');
      if (royaltyBps !== LAUNCH_ROYALTY_BPS) throw new Error('Production Forge royalty is not the reviewed 500 bps.');
      if (!parentApproved) throw new Error('The reviewed VoxelFlip Base collection is not approved as a parent collection.');
      if (paused) throw new Error('The production Forge is paused.');
      if (maxForgeFee !== EXPECTED_MAX_FORGE_FEE) throw new Error('Forge maximum fee constant does not match the reviewed contract.');
      if (maxRoyaltyBps !== EXPECTED_MAX_ROYALTY_BPS) throw new Error('Forge maximum royalty constant does not match the reviewed contract.');
      if (forgeTypehash !== EXPECTED_FORGE_TYPEHASH.toLowerCase()) throw new Error('Forge EIP-712 request type does not match the reviewed contract.');
      if (name !== EXPECTED_NAME || symbol !== EXPECTED_SYMBOL) throw new Error('Forge ERC-721 identity does not match the reviewed contract.');
      if (!supports721 || !supports2981) throw new Error('Forge ERC-721/ERC-2981 interfaces do not match the reviewed contract.');
      if (domainName !== 'VoxelForgeRevenue' || domainVersion !== '1' || domainChainId !== BigInt(BASE_CHAIN_ID) || domainContract !== params.address) {
        throw new Error('Forge EIP-712 domain does not match this Base deployment.');
      }
      if (nextTokenId < 1n || totalForges !== nextTokenId - 1n) throw new Error('Forge token/forge counters are inconsistent.');

      return { forgeSigner, treasury, feeWei, royaltyBps, deployedAt };
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
    const txHashRaw = String(body?.txHash || '').trim();
    if (!isAddress(walletRaw) || !isAddress(addressRaw) || (txHashRaw && !TX_RE.test(txHashRaw))) {
      return NextResponse.json({ error: 'A valid owner wallet and deployed Base contract address are required.' }, { status: 400 });
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
      txHash: txHashRaw || undefined,
      approvedOwner,
      parentCollection: getAddress(parent.address),
      expectedSigner,
    });

    const record = await saveRevenueForgeDeployment({
      chainId: 8453,
      network: 'base',
      address,
      deploymentTxHash: txHashRaw,
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
