const { ethers } = require('hardhat');

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 84532n) {
    throw new Error(`Canonical property registry deployment is Base Sepolia only. Refusing chain ${network.chainId}.`);
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('A deployment signer is required.');

  console.log('Voxel Vault Canonical Property Identity Registry');
  console.log('Network: Base Sepolia (84532)');
  console.log('Owner:', deployer.address);
  console.log('WARNING: this contract is only a digital identity registry. It does not transfer a deed, create property ownership, create rent rights, or issue an investment security.');

  const Registry = await ethers.getContractFactory('CanonicalPropertyRegistry');
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();

  console.log('CANONICAL_PROPERTY_REGISTRY_ADDRESS=', await registry.getAddress());
  console.log('No property was registered or verified during deployment.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
