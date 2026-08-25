import { Contract, getCreateAddress, JsonRpcProvider, Wallet } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment, saveVoxelFlipDeployment } from '../../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';

const APPROVED_OWNER = '0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb';
const APPROVED_ROYALTY_BPS = 500;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;
const ZERO_TX_HASH = `0x${'0'.repeat(64)}`;
const ABI = [
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
    'https://base-rpc.publicnode.com',
    'https://base.llamarpc.com',
    'https://mainnet.base.org',
  ].filter(Boolean)));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryResolveCreationTxHash(address: string, suppliedTxHash: string) {
  if (TX_RE.test(suppliedTxHash)) return suppliedTxHash;
  try {
    const response = await fetch(`https://base.blockscout.com/api/v2/addresses/${address.toLowerCase()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return '';
    const data = await response.json();
    const recovered = String(data?.creation_transaction_hash || '').trim();
    return TX_RE.test(recovered) ? recovered : '';
  } catch {
    return '';
  }
}

type ContractRead = {
  provider: JsonRpcProvider;
  code: string;
  owner: any;
  mintSigner: any;
  royaltyReceiver: any;
  royaltyBpsRaw: any;
  name: any;
  symbol: any;
  royaltyInfo: any;
};

async function readContractWithRetry(address: string): Promise<ContractRead> {
  let lastError: unknown = null;

  for (const rpcUrl of rpcCandidates()) {
    const provider = new JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const code = await provider.getCode(address.toLowerCase());
        if (!code || code === '0x') throw new Error('Contract code is not visible on this RPC yet.');

        const contract = new Contract(address.toLowerCase(), ABI, provider);
        const [owner, mintSigner, royaltyReceiver, royaltyBpsRaw, name, symbol, royaltyInfo] = await Promise.all([
          contract.owner(),
          contract.mintSigner(),
          contract.royaltyReceiver(),
          contract.royaltyBps(),
          contract.name(),
          contract.symbol(),
          contract.royaltyInfo(1, BigInt(10000)),
        ]);

        return { provider, code, owner, mintSigner, royaltyReceiver, royaltyBpsRaw, name, symbol, royaltyInfo };
      } catch (error) {
        lastError = error;
        if (attempt < 2) await sleep(900 * (attempt + 1));
      }
    }
  }

  const detail = lastError instanceof Error ? lastError.message : 'Unknown Base RPC read failure.';
  throw new Error(`Base contract verification is temporarily unavailable: ${detail}`);
}

async function verifyCreationTx(provider: JsonRpcProvider, address: string, txHash: string) {
  if (!TX_RE.test(txHash)) return { verified: false, blockNumber: null as number | null };
  const [receipt, transaction] = await Promise.all([
    provider.getTransactionReceipt(txHash),
    provider.getTransaction(txHash),
  ]);
  if (!receipt || receipt.status !== 1 || !transaction) throw new Error('The Base deployment transaction is not confirmed.');
  if (transaction.to) throw new Error('That transaction is not a contract deployment.');
  if (transaction.from.toLowerCase() !== APPROVED_OWNER.toLowerCase()) throw new Error('VoxelFlip must be deployed by the approved owner wallet.');
  const createdAddress = receipt.contractAddress || getCreateAddress({ from: transaction.from, nonce: transaction.nonce });
  if (!createdAddress || createdAddress.toLowerCase() !== address.toLowerCase()) throw new Error('The supplied contract address does not match the deployment transaction.');
  return { verified: true, blockNumber: receipt.blockNumber };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const address = typeof body?.address === 'string' ? body.address.trim() : '';
    const suppliedTxHash = typeof body?.txHash === 'string' ? body.txHash.trim() : '';
    if (!ADDRESS_RE.test(address)) {
      return NextResponse.json({ error: 'Deployment address is required.' }, { status: 400 });
    }
    if (suppliedTxHash && !TX_RE.test(suppliedTxHash)) {
      return NextResponse.json({ error: 'The deployment transaction hash is invalid.' }, { status: 400 });
    }

    const existing = await getVoxelFlipDeployment({ bypassCache: true });
    if (existing?.address) {
      if (existing.address.toLowerCase() === address.toLowerCase()) return NextResponse.json({ registered: true, deployment: existing });
      return NextResponse.json({ error: `VoxelFlip is already registered at ${existing.address}.` }, { status: 409 });
    }

    const rawSignerSecret = process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY?.trim() || '';
    if (!rawSignerSecret) return NextResponse.json({ error: 'VoxelFlip mint signer is not configured.' }, { status: 503 });
    let expectedMintSigner = '';
    try { expectedMintSigner = new Wallet(normalizePrivateKey(rawSignerSecret)).address; }
    catch { return NextResponse.json({ error: 'VoxelFlip mint signer configuration is invalid.' }, { status: 503 }); }

    const txHash = await tryResolveCreationTxHash(address, suppliedTxHash);
    const chain = await readContractWithRetry(address);
    const { provider, owner, mintSigner, royaltyReceiver, royaltyBpsRaw, name, symbol, royaltyInfo } = chain;

    const royaltyBps = Number(royaltyBpsRaw);
    if (String(owner).toLowerCase() !== APPROVED_OWNER.toLowerCase()) return NextResponse.json({ error: 'Contract owner does not match the approved Voxel Vault wallet.' }, { status: 400 });
    if (String(mintSigner).toLowerCase() !== expectedMintSigner.toLowerCase()) return NextResponse.json({ error: 'Contract mint signer does not match the configured VoxelFlip signer.' }, { status: 400 });
    if (String(royaltyReceiver).toLowerCase() !== APPROVED_OWNER.toLowerCase()) return NextResponse.json({ error: 'Royalty receiver does not match the approved Voxel Vault wallet.' }, { status: 400 });
    if (royaltyBps !== APPROVED_ROYALTY_BPS) return NextResponse.json({ error: 'VoxelFlip launch royalty must be exactly 5% (500 bps).' }, { status: 400 });
    if (String(name) !== 'VoxelFlip by Voxel Vault' || String(symbol) !== 'VFLIP') return NextResponse.json({ error: 'The deployed contract is not the expected VoxelFlip collection.' }, { status: 400 });
    if (String(royaltyInfo?.[0] || '').toLowerCase() !== APPROVED_OWNER.toLowerCase() || BigInt(royaltyInfo?.[1] || 0) !== BigInt(500)) {
      return NextResponse.json({ error: 'ERC-2981 royalty verification failed.' }, { status: 400 });
    }

    let deployedAt = new Date().toISOString();
    let creationVerified = false;
    if (txHash) {
      const creation = await verifyCreationTx(provider, address, txHash);
      creationVerified = creation.verified;
      if (creation.blockNumber != null) {
        const block = await provider.getBlock(creation.blockNumber);
        if (block?.timestamp) deployedAt = new Date(Number(block.timestamp) * 1000).toISOString();
      }
    }

    const deployment = await saveVoxelFlipDeployment({
      address: address.toLowerCase(),
      chainId: 8453,
      network: 'base',
      owner: String(owner),
      mintSigner: String(mintSigner),
      royaltyReceiver: String(royaltyReceiver),
      royaltyBps,
      deploymentTxHash: txHash || ZERO_TX_HASH,
      deployedAt,
      registeredAt: new Date().toISOString(),
    });

    return NextResponse.json({
      registered: true,
      creationVerified,
      creationTxRecovered: Boolean(txHash),
      deployment,
      explorerUrl: `https://basescan.org/address/${address}`,
      openSeaUrl: `https://opensea.io/assets/base/${address}`,
    });
  } catch (error) {
    console.error('VoxelFlip deployment registration failed', error);
    const message = error instanceof Error ? error.message : 'Unable to register the VoxelFlip deployment.';
    const retryable = /temporarily|not confirmed|not visible|rpc/i.test(message);
    return NextResponse.json({ error: message, retryable }, { status: retryable ? 503 : 500 });
  }
}
