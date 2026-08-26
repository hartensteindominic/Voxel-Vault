import { randomBytes } from 'node:crypto';
import { getAddress, hexlify, isAddress, keccak256, toUtf8Bytes } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';
import { getRevenueForgeDeployment, revenueForgeSigningWallet } from '../../../../lib/forge-revenue-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BASE_CHAIN_ID = 8453;
const MAX_AGE_SECONDS = 10 * 60;
const TYPES = {
  ForgeRequest: [
    { name: 'account', type: 'address' },
    { name: 'parentContract0', type: 'address' },
    { name: 'parentTokenId0', type: 'uint256' },
    { name: 'parentContract1', type: 'address' },
    { name: 'parentTokenId1', type: 'uint256' },
    { name: 'parentContract2', type: 'address' },
    { name: 'parentTokenId2', type: 'uint256' },
    { name: 'descendantUriHash', type: 'bytes32' },
    { name: 'feeWei', type: 'uint256' },
    { name: 'requestId', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
  ],
};

type ParentInput = { contract?: string; tokenId?: string | number };

function canonicalParents(parents: ParentInput[]) {
  if (!Array.isArray(parents) || parents.length !== 3) throw new Error('Choose exactly three parent NFTs.');
  return parents.map(parent => {
    const contract = String(parent?.contract || '').trim();
    const tokenId = String(parent?.tokenId ?? '').trim();
    if (!isAddress(contract) || !/^\d+$/.test(tokenId)) throw new Error('Every parent needs a valid Base NFT contract and token ID.');
    return { contract: getAddress(contract), tokenId };
  });
}

function metadataUri(origin: string, requestId: string, parents: { contract: string; tokenId: string }[]) {
  const query = new URLSearchParams({
    r: requestId,
    c0: parents[0].contract,
    t0: parents[0].tokenId,
    c1: parents[1].contract,
    t1: parents[1].tokenId,
    c2: parents[2].contract,
    t2: parents[2].tokenId,
  });
  return `${origin}/api/forge/mainnet-metadata?${query.toString()}`;
}

export async function POST(request: Request) {
  try {
    const registered = await getRevenueForgeDeployment();
    if (!registered?.address) {
      return NextResponse.json({ error: 'The Base mainnet revenue Forge has not been deployed and registered yet.' }, { status: 503 });
    }

    const body = await request.json();
    const walletRaw = String(body?.wallet || '').trim();
    if (!isAddress(walletRaw)) return NextResponse.json({ error: 'Connect a valid Base wallet first.' }, { status: 400 });

    const wallet = getAddress(walletRaw);
    const parents = canonicalParents(body?.parents || []);
    const parentKeys = parents.map(parent => `${parent.contract.toLowerCase()}:${parent.tokenId}`);
    if (new Set(parentKeys).size !== 3) return NextResponse.json({ error: 'Choose three different parent NFTs.' }, { status: 400 });

    const deployment = await getVoxelFlipDeployment();
    const productionParent = getAddress(deployment.address);
    const configuredForge = getAddress(registered.address);
    const configuredParent = getAddress(registered.parentCollection);

    if (configuredParent !== productionParent) {
      return NextResponse.json({ error: 'The registered Forge parent collection does not match the reviewed production VoxelFlip deployment.' }, { status: 503 });
    }
    if (parents.some(parent => parent.contract !== productionParent)) {
      return NextResponse.json({ error: 'Initial mainnet Forge launch accepts the reviewed VoxelFlip Base collection only.' }, { status: 400 });
    }

    const signer = revenueForgeSigningWallet();
    if (getAddress(registered.forgeSigner) !== signer.address) {
      return NextResponse.json({ error: 'The protected server Forge signer does not match the reviewed revenue Forge configuration.' }, { status: 503 });
    }

    const feeWei = BigInt(registered.forgeFeeWei);
    if (feeWei <= BigInt(0)) {
      return NextResponse.json({ error: 'The reviewed Forge fee is invalid.' }, { status: 503 });
    }

    // This endpoint intentionally does not perform live Base eth_call reads.
    // The exact production deployment, signer, treasury, fee and parent collection
    // were already verified during activation and are pinned in reviewed code.
    // The smart contract remains the final authority and re-checks, atomically:
    // pause state, fee equality, parent approval, ownership of all three NFTs,
    // request replay protection, URI hash and the Forge signer authorization.
    const requestId = hexlify(randomBytes(32));
    const configuredOrigin = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
    const origin = configuredOrigin || new URL(request.url).origin;
    const descendantURI = metadataUri(origin, requestId, parents);
    if (Buffer.byteLength(descendantURI, 'utf8') > 1024) {
      return NextResponse.json({ error: 'Generated descendant metadata URL is too long.' }, { status: 500 });
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS);
    const forgeRequest = {
      account: wallet,
      parentContract0: parents[0].contract,
      parentTokenId0: BigInt(parents[0].tokenId),
      parentContract1: parents[1].contract,
      parentTokenId1: BigInt(parents[1].tokenId),
      parentContract2: parents[2].contract,
      parentTokenId2: BigInt(parents[2].tokenId),
      descendantUriHash: keccak256(toUtf8Bytes(descendantURI)),
      feeWei,
      requestId,
      deadline,
    };

    const signature = await signer.signTypedData(
      { name: 'VoxelForgeRevenue', version: '1', chainId: BASE_CHAIN_ID, verifyingContract: configuredForge },
      TYPES,
      forgeRequest
    );

    return NextResponse.json({
      chainId: BASE_CHAIN_ID,
      forge: configuredForge,
      treasury: getAddress(registered.treasury),
      feeWei: forgeRequest.feeWei.toString(),
      request: {
        ...forgeRequest,
        parentTokenId0: forgeRequest.parentTokenId0.toString(),
        parentTokenId1: forgeRequest.parentTokenId1.toString(),
        parentTokenId2: forgeRequest.parentTokenId2.toString(),
        feeWei: forgeRequest.feeWei.toString(),
        deadline: forgeRequest.deadline.toString(),
      },
      descendantURI,
      signature,
      expiresInSeconds: MAX_AGE_SECONDS,
      verificationMode: 'reviewed-pinned-config+onchain-final-enforcement',
      safety: 'No ETH is spent during this review. The Base Forge contract itself performs the final ownership, fee, pause-state, approved-parent and signature checks when MetaMask submits the transaction.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Base mainnet Forge authorization failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not authorize this Forge.' }, { status: 500 });
  }
}
