/**
 * Base MAINNET deployment for VoxelForgeRevenue.
 *
 * SAFETY:
 * - Refuses to run unless CONFIRM_BASE_FORGE_MAINNET=yes.
 * - Refuses unless chainId === 8453.
 * - Requires explicit owner, forge signer, treasury and forge fee.
 * - The Forge signer should be a separate low-privilege signing key with no treasury funds.
 * - The VoxelFlip parent collection is pinned to the reviewed Base deployment.
 * - This script never deploys from Vercel and never asks for a private key in a browser.
 *
 * Never paste DEPLOYER_PRIVATE_KEY into chat, GitHub, or a public environment.
 */

const hre = require('hardhat');
const fs = require('fs');

const BASE_CHAIN_ID = 8453;
const VOXELFLIP_PARENT_COLLECTION = '0xa00758b05f96ef4409d97c3ffebb6794b2eafbde';

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required ${name}`);
  return value;
}

async function main() {
  if (process.env.CONFIRM_BASE_FORGE_MAINNET !== 'yes') {
    throw new Error('Refusing Base mainnet Forge deploy. Set CONFIRM_BASE_FORGE_MAINNET=yes only after reviewing the final parameters.');
  }

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error('Missing DEPLOYER_PRIVATE_KEY in your secure local environment.');

  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== BASE_CHAIN_ID) throw new Error(`Expected Base mainnet chainId ${BASE_CHAIN_ID}, got ${chainId}.`);

  const owner = required('FORGE_OWNER');
  const forgeSigner = required('FORGE_SIGNER');
  const treasury = required('FORGE_TREASURY');
  const feeEth = required('FORGE_FEE_ETH');
  const royaltyBps = Number(required('FORGE_ROYALTY_BPS'));

  if (!hre.ethers.isAddress(owner)) throw new Error('Invalid FORGE_OWNER');
  if (!hre.ethers.isAddress(forgeSigner)) throw new Error('Invalid FORGE_SIGNER');
  if (!hre.ethers.isAddress(treasury)) throw new Error('Invalid FORGE_TREASURY');
  if (!Number.isInteger(royaltyBps) || royaltyBps < 0 || royaltyBps > 1000) throw new Error('FORGE_ROYALTY_BPS must be an integer from 0 to 1000.');

  const feeWei = hre.ethers.parseEther(feeEth);
  const maxFee = hre.ethers.parseEther('0.1');
  if (feeWei < 0n || feeWei > maxFee) throw new Error('FORGE_FEE_ETH must be between 0 and 0.1 ETH.');

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  if (balance === 0n) throw new Error('Deployment wallet has 0 ETH on Base.');

  console.log('=== Voxel Forge Revenue · Base MAINNET ===');
  console.log('Deployer:', deployer.address);
  console.log('Deployer balance:', hre.ethers.formatEther(balance), 'ETH');
  console.log('Owner:', owner);
  console.log('Forge signer:', forgeSigner);
  console.log('Treasury:', treasury);
  console.log('Approved parent:', VOXELFLIP_PARENT_COLLECTION);
  console.log('Forge fee:', hre.ethers.formatEther(feeWei), 'ETH');
  console.log('Royalty:', royaltyBps, 'bps');

  const Forge = await hre.ethers.getContractFactory('VoxelForgeRevenue');
  const forge = await Forge.deploy(
    owner,
    forgeSigner,
    treasury,
    VOXELFLIP_PARENT_COLLECTION,
    feeWei,
    royaltyBps
  );
  await forge.waitForDeployment();

  const address = await forge.getAddress();
  const deploymentTx = forge.deploymentTransaction();

  const result = {
    chainId: BASE_CHAIN_ID,
    network: 'base',
    contract: address,
    deployer: deployer.address,
    owner,
    forgeSigner,
    treasury,
    approvedParentCollection: VOXELFLIP_PARENT_COLLECTION,
    forgeFeeWei: feeWei.toString(),
    forgeFeeEth: hre.ethers.formatEther(feeWei),
    royaltyBps,
    deploymentTxHash: deploymentTx?.hash || '',
    deployedAt: new Date().toISOString(),
    explorer: `https://basescan.org/address/${address}`,
  };

  fs.writeFileSync('deployed-base-forge-revenue.json', JSON.stringify(result, null, 2));

  console.log('\nDeployment complete:', address);
  console.log('Next: verify source, read owner/signer/treasury/fee back from Base, then run a deliberately small real-money canary Forge before enabling the public UI.');
  console.log('Do not treat this contract as professionally audited software.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
