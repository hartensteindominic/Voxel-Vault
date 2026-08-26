import { Contract, formatEther, JsonRpcProvider, Wallet } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;
const APPROVED_VAULT_WALLET = '0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb';
const APPROVED_ROYALTY_BPS = 500;
const COLLECTION_ABI = [
  'function owner() view returns (address)',
  'function mintSigner() view returns (address)',
  'function royaltyReceiver() view returns (address)',
  'function royaltyBps() view returns (uint96)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function royaltyInfo(uint256 tokenId,uint256 salePrice) view returns (address,uint256)',
];

function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  if (PRIVATE_KEY_RE.test(trimmed)) return `0x${trimmed}`;
  if (/^0X[a-fA-F0-9]{64}$/.test(trimmed)) return `0x${trimmed.slice(2)}`;
  return trimmed;
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Base RPC timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readCollection(address: string) {
  for (const rpcUrl of rpcCandidates()) {
    const provider = new JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
    try {
      const code = await withTimeout(provider.getCode(address), 4500);
      if (!code || code === '0x') continue;
      const contract = new Contract(address, COLLECTION_ABI, provider);
      const [owner, mintSigner, royaltyReceiver, royaltyBpsRaw, name, symbol, royaltyInfo] = await withTimeout(Promise.all([
        contract.owner(),
        contract.mintSigner(),
        contract.royaltyReceiver(),
        contract.royaltyBps(),
        contract.name(),
        contract.symbol(),
        contract.royaltyInfo(1, BigInt(10000)),
      ]), 6500);
      return {
        checked: true,
        owner: String(owner),
        mintSigner: String(mintSigner),
        royaltyReceiver: String(royaltyReceiver),
        royaltyBps: Number(royaltyBpsRaw),
        name: String(name),
        symbol: String(symbol),
        royaltyInfoReceiver: String(royaltyInfo?.[0] || ''),
        royaltyInfoAmount: BigInt(royaltyInfo?.[1] || 0).toString(),
      };
    } catch {
      // Try the next public Base RPC.
    } finally {
      provider.destroy();
    }
  }
  return { checked: false } as const;
}

async function readOwnerBalance() {
  for (const rpcUrl of rpcCandidates()) {
    const provider = new JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
    try {
      const balance = await withTimeout(provider.getBalance(APPROVED_VAULT_WALLET), 4500);
      return { checked: true, balanceWei: balance.toString(), balanceEth: formatEther(balance), hasEth: balance > BigInt(0) };
    } catch {
      // Try the next public Base RPC.
    } finally {
      provider.destroy();
    }
  }
  return { checked: false, balanceWei: '0', balanceEth: '0', hasEth: false };
}

export async function GET() {
  const openSeaConfigured = Boolean(process.env.OPENSEA_API_KEY?.trim());
  const rawSignerSecret = process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY?.trim() || '';
  const configuredSignerAddress = process.env.VOXELFLIP_MINT_SIGNER_ADDRESS?.trim() || '';
  const deployment = await getVoxelFlipDeployment();
  const collectionAddress = deployment?.address || '';
  const collectionConfigured = ADDRESS_RE.test(collectionAddress);

  let mintSignerAddress = '';
  let mintSignerValid = false;
  let mintSignerMatchesConfiguredAddress = true;
  if (rawSignerSecret) {
    try {
      mintSignerAddress = new Wallet(normalizePrivateKey(rawSignerSecret)).address;
      mintSignerValid = true;
      if (ADDRESS_RE.test(configuredSignerAddress)) {
        mintSignerMatchesConfiguredAddress = mintSignerAddress.toLowerCase() === configuredSignerAddress.toLowerCase();
      }
    } catch {
      mintSignerValid = false;
    }
  }

  const [chain, baseFunding] = await Promise.all([
    collectionConfigured ? readCollection(collectionAddress) : Promise.resolve({ checked: false } as const),
    readOwnerBalance(),
  ]);

  const collectionIdentityValid = Boolean(
    chain.checked
    && String(chain.owner || '').toLowerCase() === APPROVED_VAULT_WALLET.toLowerCase()
    && String(chain.royaltyReceiver || '').toLowerCase() === APPROVED_VAULT_WALLET.toLowerCase()
    && Number(chain.royaltyBps) === APPROVED_ROYALTY_BPS
    && chain.name === 'VoxelFlip by Voxel Vault'
    && chain.symbol === 'VFLIP'
    && String(chain.royaltyInfoReceiver || '').toLowerCase() === APPROVED_VAULT_WALLET.toLowerCase()
    && String(chain.royaltyInfoAmount || '') === '500'
  );
  const mintSignerMatchesCollection = Boolean(
    mintSignerValid
    && chain.checked
    && ADDRESS_RE.test(String(chain.mintSigner || ''))
    && String(chain.mintSigner).toLowerCase() === mintSignerAddress.toLowerCase()
  );
  const deploymentRecordMatchesChain = Boolean(
    chain.checked
    && deployment
    && String(deployment.owner || '').toLowerCase() === String(chain.owner || '').toLowerCase()
    && String(deployment.mintSigner || '').toLowerCase() === String(chain.mintSigner || '').toLowerCase()
    && String(deployment.royaltyReceiver || '').toLowerCase() === String(chain.royaltyReceiver || '').toLowerCase()
    && Number(deployment.royaltyBps) === Number(chain.royaltyBps)
  );

  const readyForMinting = Boolean(
    openSeaConfigured
    && mintSignerValid
    && mintSignerMatchesConfiguredAddress
    && collectionConfigured
    && collectionIdentityValid
    && mintSignerMatchesCollection
    && deploymentRecordMatchesChain
  );

  let nextStep = 'Review VoxelFlip launch configuration.';
  if (!collectionConfigured) nextStep = 'No reviewed production collection is configured. Stop before any wallet action.';
  else if (!chain.checked) nextStep = 'The collection is configured, but Base RPC verification is unavailable. Retry preflight before minting.';
  else if (!collectionIdentityValid) nextStep = 'The configured collection failed the live Base identity/royalty verification. Do not mint or deploy another contract.';
  else if (!deploymentRecordMatchesChain) nextStep = 'The pinned deployment record does not match the live Base contract. Correct the reviewed deployment record before minting.';
  else if (!mintSignerValid) nextStep = 'Finish the server-only VoxelFlip mint-signer configuration.';
  else if (!mintSignerMatchesConfiguredAddress) nextStep = 'The server-derived mint signer does not match VOXELFLIP_MINT_SIGNER_ADDRESS. Correct the environment configuration.';
  else if (!mintSignerMatchesCollection) nextStep = 'The server-derived mint signer does not match the live collection mint signer. Do not mint until they match.';
  else if (!openSeaConfigured) nextStep = 'Finish the OpenSea API server configuration before the owner self-test.';
  else if (readyForMinting) nextStep = 'Run one owner/self-test: paid VoxelPop -> image -> GLB -> mint VoxelFlip -> OpenSea -> import back into VoxelPop.';

  return NextResponse.json({
    approvedLaunch: {
      royaltyBps: APPROVED_ROYALTY_BPS,
      royaltyPercent: 5,
      defaultOwner: APPROVED_VAULT_WALLET,
      defaultRoyaltyReceiver: APPROVED_VAULT_WALLET,
      creatorEarningsEnforcement: 'optional-v1',
    },
    readyForContractDeployment: false,
    readyForMinting,
    openSeaConfigured,
    mintSignerConfigured: Boolean(rawSignerSecret),
    mintSignerValid,
    mintSignerMatchesConfiguredAddress,
    mintSignerAddress: mintSignerValid ? mintSignerAddress : null,
    mintSignerMatchesCollection,
    collectionConfigured,
    collectionAddress: collectionConfigured ? collectionAddress : null,
    collectionVerified: Boolean(chain.checked && collectionIdentityValid),
    deploymentRecordMatchesChain,
    deploymentTxHash: deployment?.deploymentTxHash || null,
    liveCollection: chain.checked ? {
      owner: chain.owner,
      mintSigner: chain.mintSigner,
      royaltyReceiver: chain.royaltyReceiver,
      royaltyBps: chain.royaltyBps,
      name: chain.name,
      symbol: chain.symbol,
    } : null,
    baseFunding,
    chain: {
      id: '0x2105',
      name: 'Base',
      checked: Boolean(chain.checked),
      rpcConfigured: Boolean(process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL),
    },
    nextStep,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
