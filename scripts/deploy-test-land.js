const { ethers } = require('hardhat');

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 84532n) {
    throw new Error(`Voxel Test Land is Base Sepolia only. Refusing chain ${network.chainId}.`);
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('A deployer wallet is required.');

  console.log('Voxel Vault Test Land');
  console.log('Network: Base Sepolia (84532)');
  console.log('Owner:', deployer.address);
  console.log('Parcels: 64 (8x8)');
  console.log('Mint price: 0.0001 TEST ETH');
  console.log('WARNING: fictional digital parcels only; no real property, rent, deed, security or investment rights.');

  const Land = await ethers.getContractFactory('VoxelTestLand');
  const land = await Land.deploy(deployer.address);
  await land.waitForDeployment();

  console.log('VOXEL_TEST_LAND_ADDRESS=', await land.getAddress());
  console.log('No parcels were minted automatically.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
