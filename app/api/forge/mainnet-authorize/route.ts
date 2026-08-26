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
type ForgeState = {
  feeWei: bigint;
  configuredSigner: string;
  treasury: string;
  paused: boolean;
  parentApproved: boolean;
};

function rpcCandidates() {
  return Array.from(new Set([
    String(process.env.BASE_RPC_URL || '').trim(),
    String(process.env.VOXELFLIP_RPC_URL || '').trim(),
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org',
    'https://base.blockscout.com/api/eth-rpc',
    'https://base.llamarpc.com',
  ].filter(Boolean)));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 5_500, label = 'Base RPC'): Promise<T> {
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

function compactRpcError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error || 'Base RPC call failed');
  if (/missing revert data/i.test(text)) return 'RPC returned no revert data';
  if (/timed out/i.test(text)) return text;
  return text.length > 220 ? `${text.slice(0, 220)}…` : text;
}

async function readAcrossProviders<T>(
  label: string,
  reader: (provider: JsonRpcProvider) => Promise<T>,
  timeoutMs = 5_500,
): Promise<T> {
  const errors: string[] = [];
  for (const rpc of rpcCandidates()) {
    const provider = new JsonRpcProvider(rpc, BASE_CHAIN_ID, { staticNetwork: true });
    try {
      await withTimeout(provider.getBlockNumber(), 3_500, `${label} health check`);
      return await withTimeout(reader(provider), timeoutMs, label);
    } catch (error) {
      errors.push(compactRpcError(error));
    } finally {
      provider.destroy();
    }
  }

  const last = errors.filter(Boolean).at(-1) || 'RPC unavailable';
  throw new Error(`${label} could not be read after trying ${rpcCandidates().length} Base RPC providers. No ETH was spent. Last error: ${last}`);
}

async function readForgeState(configuredForge: string, productionParent: string): Promise<ForgeState> {
  // Intentionally serialized. Several free Base RPCs accept a health request and
  // then fail when a burst of eth_call requests arrives concurrently.
  const code = await readAcrossProviders('Forge bytecode', provider => provider.getCode(configuredForge), 5_000);
  if (!code || code === '0x') throw new Error('No Forge bytecode exists at the configured Base address. No ETH was spent.');

  const feeWei = BigInt(await readAcrossProviders('Live Forge fee', async provider => {
    const forge = new Contract(configuredForge, FORGE_ABI, provider);
    return forge.forgeFee();
  }));

  const configuredSigner = getAddress(await readAcrossProviders('Forge signer', async provider => {
    const forge = new Contract(configuredForge, FORGE_ABI, provider);
    return forge.forgeSigner();
  }));

  const treasury = getAddress(await readAcrossProviders('Forge treasury', async provider => {
    const forge = new Contract(configuredForge, FORGE_ABI, provider);
    return forge.treasury();
  }));

  const paused = Boolean(await readAcrossProviders('Forge pause state', async provider => {
    const forge = new Contract(configuredForge, FORGE_ABI, provider);
    return forge.paused();
  }));

  const parentApproved = Boolean(await readAcrossProviders('VoxelFlip parent approval', async provider => {
    const forge = new Contract(configuredForge, FORGE_ABI, provider);
    return forge.approvedParentCollections(productionParent);
  }));

  return { feeWei, configuredSigner, treasury, paused, parentApproved };
}

async function verifyParent(wallet: string, parent: { contract: string; tokenId: string }) {
  const owner = getAddress(await readAcrossProviders(`Parent #${parent.tokenId} owner`, async provider => {
    const nft = new Contract(parent.contract, ERC721_ABI, provider);
    return nft.ownerOf(parent.tokenId);
  }));
  if (owner !== wallet) return { owned: false, tokenURI: '' };

  const tokenURI = String(await readAcrossProviders(`Parent #${parent.tokenId} metadata`, async provider => {
    const nft = new Contract(parent.contract, ERC721_ABI, provider);
    return nft.tokenURI(parent.tokenId);
  }) || '').trim();
  return { owned: true, tokenURI };
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

    const live = await readForgeState(configuredForge, productionParent);
    if (live.paused) return NextResponse.json({ error: 'The Base revenue Forge is currently paused.' }, { status: 503 });
    if (!live.parentApproved) return NextResponse.json({ error: 'The reviewed VoxelFlip collection is not approved by the revenue Forge.' }, { status: 503 });

    const signer = revenueForgeSigningWallet();
    if (live.configuredSigner !== signer.address || getAddress(registered.forgeSigner) !== signer.address) {
      return NextResponse.json({ error: 'The protected server Forge signer does not match the registered revenue Forge.' }, { status: 503 });
    }

    // Also serialized to avoid six simultaneous ownerOf/tokenURI calls.
    for (let i = 0; i < parents.length; i += 1) {
      const check = await verifyParent(wallet, parents[i]);
      if (!check.owned) return NextResponse.json({ error: `Connected wallet no longer owns parent ${i + 1}.` }, { status: 409 });
      if (!check.tokenURI) return NextResponse.json({ error: `Parent ${i + 1} has no readable tokenURI.` }, { status: 409 });
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
      feeWei: live.feeWei,
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
      treasury: live.treasury,
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
  }
}
