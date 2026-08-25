import { formatEther, JsonRpcProvider, Wallet } from 'ethers';
import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;
const APPROVED_VAULT_WALLET = '0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb';
const APPROVED_ROYALTY_BPS = 500;

function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  if (PRIVATE_KEY_RE.test(trimmed)) return `0x${trimmed}`;
  if (/^0X[a-fA-F0-9]{64}$/.test(trimmed)) return `0x${trimmed.slice(2)}`;
  return trimmed;
}

export async function GET() {
  const openSeaConfigured = Boolean(process.env.OPENSEA_API_KEY?.trim());
  const rawSignerSecret = process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY?.trim() || '';
  const signerSecret = normalizePrivateKey(rawSignerSecret);
  const configuredSignerAddress = process.env.VOXELFLIP_MINT_SIGNER_ADDRESS?.trim() || '';
  const deployment = await getVoxelFlipDeployment();
  const collectionAddress = deployment?.address || (process.env.NEXT_PUBLIC_VOXELFLIP_NFT_ADDRESS?.trim() || '');
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
  const secretsReady = openSeaConfigured && mintSignerValid;
  const rpcUrl = process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || 'https://mainnet.base.org';

  let ownerBaseBalanceWei = '0';
  let ownerBaseBalanceEth = '0';
  let baseBalanceChecked = false;
  try {
    const provider = new JsonRpcProvider(rpcUrl, 8453);
    const balance = await provider.getBalance(APPROVED_VAULT_WALLET);
    ownerBaseBalanceWei = balance.toString();
    ownerBaseBalanceEth = formatEther(balance);
    baseBalanceChecked = true;
  } catch {
    baseBalanceChecked = false;
  }
  const ownerHasBaseEth = BigInt(ownerBaseBalanceWei) > BigInt(0);

  let nextStep = 'Review launch configuration.';
  if (collectionConfigured) nextStep = 'Run one paid VoxelPop -> mesh -> VoxelFlip mint -> OpenSea -> import-back test.';
  else if (!openSeaConfigured) nextStep = 'Finish OpenSea API server configuration.';
  else if (!mintSignerValid) nextStep = 'Finish VoxelFlip mint-signer private-key configuration.';
  else if (baseBalanceChecked && !ownerHasBaseEth) nextStep = 'Move a small amount of ETH to the approved owner wallet on Base for deployment gas.';
  else if (launchIdentityValid) nextStep = 'Connect the approved owner wallet on /voxelflip/launch and approve one fresh Base deployment transaction.';

  return NextResponse.json({
    approvedLaunch: {
      royaltyBps: APPROVED_ROYALTY_BPS,
      royaltyPercent: 5,
      defaultOwner: APPROVED_VAULT_WALLET,
      defaultRoyaltyReceiver: APPROVED_VAULT_WALLET,
      creatorEarningsEnforcement: 'optional-v1',
    },
    readyForContractDeployment: secretsReady && launchIdentityValid && !collectionConfigured && (!baseBalanceChecked || ownerHasBaseEth),
    readyForMinting: secretsReady && launchIdentityValid && collectionConfigured,
    openSeaConfigured,
    mintSignerConfigured: Boolean(rawSignerSecret),
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
    deploymentTxHash: deployment?.deploymentTxHash || null,
    baseFunding: {
      checked: baseBalanceChecked,
      hasEth: ownerHasBaseEth,
      balanceWei: ownerBaseBalanceWei,
      balanceEth: ownerBaseBalanceEth,
    },
    chain: {
      id: '0x2105',
      name: 'Base',
      rpcConfigured: Boolean(process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL),
    },
    nextStep,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
