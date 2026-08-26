import { randomBytes } from 'node:crypto';
import { Contract, JsonRpcProvider, getAddress, hexlify, isAddress, keccak256, toUtf8Bytes } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';
import { getRevenueForgeDeployment, revenueForgeSigningWallet } from '../../../../lib/forge-revenue-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BASE_CHAIN_ID = 8453;
const MAX_AGE_SECONDS = 10 * 60;
const ERC721_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];
const FORGE_ABI = [
  'function forgeFee() view returns (uint256)',
  'function forgeSigner() view returns (address)',
  'function treasury() view returns (address)',
  'function paused() view returns (bool)',
  'function approvedParentCollections(address collection) view returns (bool)',
];
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 5_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Base RPC timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function verifiedProvider() {
  let lastError = '';
  for (const url of rpcCandidates()) {
    const provider = new JsonRpcProvider(url, BASE_CHAIN_ID, { staticNetwork: true });
    try {
      await withTimeout(provider.getBlockNumber(), 4_000);
      return provider;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error || 'RPC unavailable');
      provider.destroy();
    }
  }
  throw new Error(lastError || 'No Base RPC is available.');
}

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
  const registered = await getRevenueForgeDeployment();
  if (!registered?.address) {
    return NextResponse.json({ error: 'The Base mainnet revenue Forge has not been deployed and registered yet.' }, { status: 503 });
  }
  const configuredForge = getAddress(registered.address);

  let provider: JsonRpcProvider | null = null;
  try {
    const body = await request.json();
    const walletRaw = String(body?.wallet || '').trim();
    if (!isAddress(walletRaw)) return NextResponse.json({ error: 'Connect a valid Base wallet first.' }, { status: 400 });
    const wallet = getAddress(walletRaw);
    const parents = canonicalParents(body?.parents || []);
    const parentKeys = parents.map(parent => `${parent.contract.toLowerCase()}:${parent.tokenId}`);
    if (new Set(parentKeys).size !== 3) return NextResponse.json({ error: 'Choose three different parent NFTs.' }, { status: 400 });

    const deployment = await getVoxelFlipDeployment();
    const productionParent = getAddress(deployment.address);
    if (parents.some(parent => parent.contract !== productionParent)) {
      return NextResponse.json({ error: 'Initial mainnet Forge launch accepts the reviewed VoxelFlip Base collection only.' }, { status: 400 });
    }

    provider = await verifiedProvider();
    const forge = new Contract(configuredForge, FORGE_ABI, provider);
    const [feeWei, configuredSigner, treasury, paused, parentApproved] = await withTimeout(Promise.all([
      forge.forgeFee(),
      forge.forgeSigner(),
      forge.treasury(),
      forge.paused(),
      forge.approvedParentCollections(productionParent),
    ]), 8_000);

    if (paused) return NextResponse.json({ error: 'The Base revenue Forge is currently paused.' }, { status: 503 });
    if (!parentApproved) return NextResponse.json({ error: 'The reviewed VoxelFlip collection is not approved by the revenue Forge.' }, { status: 503 });

    const signer = revenueForgeSigningWallet();
    if (getAddress(configuredSigner) !== signer.address || getAddress(registered.forgeSigner) !== signer.address) {
      return NextResponse.json({ error: 'The protected server Forge signer does not match the registered revenue Forge.' }, { status: 503 });
    }

    for (let i = 0; i < parents.length; i += 1) {
      const parent = parents[i];
      const nft = new Contract(parent.contract, ERC721_ABI, provider);
      const owner = getAddress(await withTimeout(nft.ownerOf(parent.tokenId)));
      if (owner !== wallet) return NextResponse.json({ error: `Connected wallet no longer owns parent ${i + 1}.` }, { status: 409 });
      const tokenURI = String(await withTimeout(nft.tokenURI(parent.tokenId)) || '').trim();
      if (!tokenURI) return NextResponse.json({ error: `Parent ${i + 1} has no readable tokenURI.` }, { status: 409 });
    }

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
      feeWei: BigInt(feeWei),
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
      treasury: getAddress(treasury),
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
      safety: 'The authorization cannot transfer or burn parent NFTs. MetaMask separately shows the real ETH Forge transaction before payment.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Base mainnet Forge authorization failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not authorize this Forge.' }, { status: 500 });
  } finally {
    provider?.destroy();
  }
}
