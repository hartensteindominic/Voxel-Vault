/**
 * Deploy VoxelFlipNFT to Base mainnet.
 *
 * This script intentionally refuses to deploy unless every production control is explicit.
 * NEVER put DEPLOYER_PRIVATE_KEY or VOXELFLIP_MINT_SIGNER_PRIVATE_KEY in GitHub or chat.
 */

const hre = require('hardhat');
const fs = require('fs');

async function main() {
  if (process.env.CONFIRM_BASE_MAINNET !== 'yes') {
    throw new Error('Refusing Base mainnet deploy. Set CONFIRM_BASE_MAINNET=yes only after reviewing the deployment inputs.');
  }

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error('Missing DEPLOYER_PRIVATE_KEY');
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 8453) throw new Error(`Expected Base mainnet chainId 8453, got ${network.chainId}.`);

  const owner = process.env.MULTISIG_OWNER;
  const mintSigner = process.env.VOXELFLIP_MINT_SIGNER_ADDRESS;
  const royaltyReceiver = process.env.VOXELFLIP_ROYALTY_RECEIVER;
  const royaltyBps = Number(process.env.VOXELFLIP_ROYALTY_BPS || '500');
  const contractURI = process.env.VOXELFLIP_CONTRACT_URI || '';

  if (!owner || !hre.ethers.isAddress(owner)) throw new Error('A valid MULTISIG_OWNER is required.');
  if (!mintSigner || !hre.ethers.isAddress(mintSigner)) throw new Error('A valid VOXELFLIP_MINT_SIGNER_ADDRESS is required.');
  if (!royaltyReceiver || !hre.ethers.isAddress(royaltyReceiver)) throw new Error('A valid VOXELFLIP_ROYALTY_RECEIVER is required.');
  if (!Number.isInteger(royaltyBps) || royaltyBps < 0 || royaltyBps > 1000) throw new Error('VOXELFLIP_ROYALTY_BPS must be between 0 and 1000.');

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  if (balance === 0n) throw new Error('Deployer has 0 ETH on Base. Fund it before deploying.');

  console.log('=== VoxelFlip Base mainnet deploy ===');
  console.log('Deployer:', deployer.address);
  console.log('Owner:', owner);
  console.log('Mint signer:', mintSigner);
  console.log('Royalty receiver:', royaltyReceiver);
  console.log('Royalty bps:', royaltyBps);
  console.log('Deployer balance:', hre.ethers.formatEther(balance), 'ETH');

  const Factory = await hre.ethers.getContractFactory('VoxelFlipNFT');
  const contract = await Factory.deploy(owner, mintSigner, royaltyReceiver, royaltyBps, contractURI);
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  const output = {
    chainId: 8453,
    network: 'base',
    VoxelFlipNFT: address,
    deployer: deployer.address,
    owner,
    mintSigner,
    royaltyReceiver,
    royaltyBps,
    contractURI,
    deployedAt: new Date().toISOString(),
    explorer: `https://basescan.org/address/${address}`,
    openSeaCollectionSeed: `https://opensea.io/assets/base/${address}/1`,
  };

  fs.writeFileSync('deployed-voxelflip-base.json', JSON.stringify(output, null, 2));
  console.log('\nVoxelFlipNFT:', address);
  console.log('Set these deployment variables after review:');
  console.log(`NEXT_PUBLIC_VOXELFLIP_NFT_ADDRESS=${address}`);
  console.log('NEXT_PUBLIC_VOXELFLIP_CHAIN_ID=0x2105');
  console.log('NEXT_PUBLIC_VOXELFLIP_CHAIN_NAME=Base');
  console.log('NEXT_PUBLIC_VOXELFLIP_EXPLORER_URL=https://basescan.org');
  console.log('Keep VOXELFLIP_MINT_SIGNER_PRIVATE_KEY server-only and ensure it corresponds to the configured mint signer address.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
