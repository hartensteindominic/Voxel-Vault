import { Wallet } from 'ethers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function GET() {
  const openSeaConfigured = Boolean(process.env.OPENSEA_API_KEY?.trim());
  const signerSecret = process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY?.trim() || '';
  const collectionAddress = process.env.NEXT_PUBLIC_VOXELFLIP_NFT_ADDRESS?.trim() || '';
  const receiver = (process.env.VOXELPOP_CRYPTO_RECEIVER || '0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb').trim();

  let mintSignerAddress = '';
  let mintSignerValid = false;
  if (signerSecret) {
    try {
      mintSignerAddress = new Wallet(signerSecret).address;
      mintSignerValid = true;
    } catch {
      mintSignerValid = false;
    }
  }

  const collectionConfigured = ADDRESS_RE.test(collectionAddress);
  const receiverValid = ADDRESS_RE.test(receiver);

  return NextResponse.json({
    readyForContractDeployment: openSeaConfigured && mintSignerValid && receiverValid,
    readyForMinting: openSeaConfigured && mintSignerValid && receiverValid && collectionConfigured,
    openSeaConfigured,
    mintSignerConfigured: Boolean(signerSecret),
    mintSignerValid,
    mintSignerAddress: mintSignerValid ? mintSignerAddress : null,
    cryptoReceiverConfigured: receiverValid,
    cryptoReceiver: receiverValid ? receiver : null,
    collectionConfigured,
    collectionAddress: collectionConfigured ? collectionAddress : null,
    chain: {
      id: process.env.NEXT_PUBLIC_VOXELFLIP_CHAIN_ID || '0x2105',
      name: process.env.NEXT_PUBLIC_VOXELFLIP_CHAIN_NAME || 'Base',
      rpcConfigured: Boolean(process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL),
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
