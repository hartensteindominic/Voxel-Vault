import { Contract, getCreateAddress, JsonRpcProvider, Wallet } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment, saveVoxelFlipDeployment } from '../../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';

const APPROVED_OWNER = '0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb';
const APPROVED_ROYALTY_BPS = 500;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const address = typeof body?.address === 'string' ? body.address.trim() : '';
    const txHash = typeof body?.txHash === 'string' ? body.txHash.trim() : '';
    if (!ADDRESS_RE.test(address) || !TX_RE.test(txHash)) {
      return NextResponse.json({ error: 'Deployment address and transaction hash are required.' }, { status: 400 });
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

    const rpcUrl = process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || 'https://mainnet.base.org';
    const provider = new JsonRpcProvider(rpcUrl, 8453);
    const [receipt, transaction] = await Promise.all([
      provider.getTransactionReceipt(txHash),
      provider.getTransaction(txHash),
    ]);
    if (!receipt || receipt.status !== 1 || !transaction) return NextResponse.json({ error: 'The Base deployment transaction is not confirmed.' }, { status: 409 });
    if (transaction.to) return NextResponse.json({ error: 'That transaction is not a contract deployment.' }, { status: 400 });
    if (transaction.from.toLowerCase() !== APPROVED_OWNER.toLowerCase()) return NextResponse.json({ error: 'VoxelFlip must be deployed by the approved owner wallet.' }, { status: 403 });

    const createdAddress = receipt.contractAddress || getCreateAddress({ from: transaction.from, nonce: transaction.nonce });
    if (!createdAddress || createdAddress.toLowerCase() !== address.toLowerCase()) return NextResponse.json({ error: 'The supplied contract address does not match the deployment transaction.' }, { status: 400 });
    const code = await provider.getCode(address);
    if (!code || code === '0x') return NextResponse.json({ error: 'No contract code exists at that Base address.' }, { status: 400 });

    const contract = new Contract(address, ABI, provider);
    const [owner, mintSigner, royaltyReceiver, royaltyBpsRaw, name, symbol, royaltyInfo] = await Promise.all([
      contract.owner(),
      contract.mintSigner(),
      contract.royaltyReceiver(),
      contract.royaltyBps(),
      contract.name(),
      contract.symbol(),
      contract.royaltyInfo(1, BigInt(10000)),
    ]);
    const royaltyBps = Number(royaltyBpsRaw);
    if (String(owner).toLowerCase() !== APPROVED_OWNER.toLowerCase()) return NextResponse.json({ error: 'Contract owner does not match the approved Voxel Vault wallet.' }, { status: 400 });
    if (String(mintSigner).toLowerCase() !== expectedMintSigner.toLowerCase()) return NextResponse.json({ error: 'Contract mint signer does not match the configured VoxelFlip signer.' }, { status: 400 });
    if (String(royaltyReceiver).toLowerCase() !== APPROVED_OWNER.toLowerCase()) return NextResponse.json({ error: 'Royalty receiver does not match the approved Voxel Vault wallet.' }, { status: 400 });
    if (royaltyBps !== APPROVED_ROYALTY_BPS) return NextResponse.json({ error: 'VoxelFlip launch royalty must be exactly 5% (500 bps).' }, { status: 400 });
    if (String(name) !== 'VoxelFlip by Voxel Vault' || String(symbol) !== 'VFLIP') return NextResponse.json({ error: 'The deployed contract is not the expected VoxelFlip collection.' }, { status: 400 });
    if (String(royaltyInfo?.[0] || '').toLowerCase() !== APPROVED_OWNER.toLowerCase() || BigInt(royaltyInfo?.[1] || 0) !== BigInt(500)) {
      return NextResponse.json({ error: 'ERC-2981 royalty verification failed.' }, { status: 400 });
    }

    const block = await provider.getBlock(receipt.blockNumber);
    const deployment = await saveVoxelFlipDeployment({
      address,
      chainId: 8453,
      network: 'base',
      owner: String(owner),
      mintSigner: String(mintSigner),
      royaltyReceiver: String(royaltyReceiver),
      royaltyBps,
      deploymentTxHash: txHash,
      deployedAt: block?.timestamp ? new Date(Number(block.timestamp) * 1000).toISOString() : new Date().toISOString(),
      registeredAt: new Date().toISOString(),
    });

    return NextResponse.json({
      registered: true,
      deployment,
      explorerUrl: `https://basescan.org/address/${address}`,
      openSeaUrl: `https://opensea.io/assets/base/${address}`,
    });
  } catch (error) {
    console.error('VoxelFlip deployment registration failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to register the VoxelFlip deployment.' }, { status: 500 });
  }
}
