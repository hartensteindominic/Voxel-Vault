import { Wallet } from 'ethers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const APPROVED_VAULT_WALLET = '0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb';
const APPROVED_ROYALTY_BPS = 500;

export async function GET() {
  const openSeaConfigured = Boolean(process.env.OPENSEA_API_KEY?.trim());
  const signerSecret = process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY?.trim() || '';
  const configuredSignerAddress = process.env.VOXELFLIP_MINT_SIGNER_ADDRESS?.trim() || '';
  const collectionAddress = process.env.NEXT_PUBLIC_VOXELFLIP_NFT_ADDRESS?.trim() || '';
  const receiver = (process.env.VOXELPOP_CRYPTO_RECEIVER || APPROVED_VAULT_WALLET).trim();
  const royaltyReceiver = (process.env.VOXELFLIP_ROYALTY_RECEIVER || APPROVED_VAULT_WALLET).trim();
  const owner = (process.env.MULTISIG_OWNER || APPROVED_VAULT_WALLET).trim();

  let mintSignerAddress = '';
  let mintSignerValid = false;
  let mintSignerMatchesConfiguredAddress = true;
  if (signerSecret) {
    try {
      mintSignerAddress = new Wallet(signerSecret).address;
      mintSignerValid = true;
      if (ADDRESS_RE.test(configuredSignerAddress)) {
        mintSignerMatchesConfiguredAddress = mintSignerAddress.toLowerCase() === configuredSignerAddress.toLowerCase();
      }
    } catch {
      mintSignerValid = false;
    }
  }

  const collectionConfigured = ADDRESS_RE.test(collectionAddress);
  const receiverValid = ADDRESS_RE.test(receiver);
  const ownerValid = ADDRESS_RE.test(owner);
  const royaltyReceiverValid = ADDRESS_RE.test(royaltyReceiver);
  const launchIdentityValid = ownerValid && royaltyReceiverValid && receiverValid;
  const secretsReady = openSeaConfigured && mintSignerValid && mintSignerMatchesConfiguredAddress;

  return NextResponse.json({
    approvedLaunch: {
      royaltyBps: APPROVED_ROYALTY_BPS,
      royaltyPercent: 5,
      defaultOwner: APPROVED_VAULT_WALLET,
      defaultRoyaltyReceiver: APPROVED_VAULT_WALLET,
      creatorEarningsEnforcement: 'optional-v1',
    },
    readyForContractDeployment: secretsReady && launchIdentityValid,
    readyForMinting: secretsReady && launchIdentityValid && collectionConfigured,
    openSeaConfigured,
    mintSignerConfigured: Boolean(signerSecret),
    mintSignerValid,
    mintSignerMatchesConfiguredAddress,
    mintSignerAddress: mintSignerValid ? mintSignerAddress : null,
    cryptoReceiverConfigured: receiverValid,
    cryptoReceiver: receiverValid ? receiver : null,
    ownerConfigured: ownerValid,
    owner: ownerValid ? owner : null,
    royaltyReceiverConfigured: royaltyReceiverValid,
    royaltyReceiver: royaltyReceiverValid ? royaltyReceiver : null,
    collectionConfigured,
    collectionAddress: collectionConfigured ? collectionAddress : null,
    chain: {
      id: process.env.NEXT_PUBLIC_VOXELFLIP_CHAIN_ID || '0x2105',
      name: process.env.NEXT_PUBLIC_VOXELFLIP_CHAIN_NAME || 'Base',
      rpcConfigured: Boolean(process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL),
    },
    nextStep: collectionConfigured
      ? 'Run one paid VoxelPop -> mesh -> VoxelFlip mint -> OpenSea -> import-back test.'
      : 'Deploy VoxelFlipNFT to Base, then configure NEXT_PUBLIC_VOXELFLIP_NFT_ADDRESS with the deployed address.',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
