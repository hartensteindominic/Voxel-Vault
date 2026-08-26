const fs = require('fs');
const hre = require('hardhat');

const BASE_SEPOLIA_CHAIN_ID = 84532n;
const BASE_MAINNET_CHAIN_ID = 8453n;

function requireAddress(name, value, fallback) {
  const candidate = value || fallback;
  if (!candidate || !hre.ethers.isAddress(candidate)) {
    throw new Error(`${name} must be a valid address.`);
  }
  return hre.ethers.getAddress(candidate);
}

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const chainId = network.chainId;

  if (chainId === BASE_MAINNET_CHAIN_ID) {
    throw new Error('REFUSING DEPLOYMENT: this Forge harness can never run on Base mainnet.');
  }
  if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(`REFUSING DEPLOYMENT: expected Base Sepolia chainId 84532, received ${chainId}.`);
  }
  if (process.env.ENABLE_FORGE_TESTNET_DEPLOY !== 'true') {
    throw new Error('Testnet deployment is locked. Set ENABLE_FORGE_TESTNET_DEPLOY=true only when you intentionally approve a Base Sepolia deployment.');
  }

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error('Missing a configured testnet deployer signer.');

  const owner = requireAddress('FORGE_TEST_OWNER', process.env.FORGE_TEST_OWNER, deployer.address);
  const forgeSigner = requireAddress('FORGE_TEST_SIGNER', process.env.FORGE_TEST_SIGNER, deployer.address);
  const feeRecipient = requireAddress('FORGE_TEST_FEE_RECIPIENT', process.env.FORGE_TEST_FEE_RECIPIENT, deployer.address);
  const royaltyBps = Number(process.env.FORGE_TEST_ROYALTY_BPS || '500');
  if (!Number.isInteger(royaltyBps) || royaltyBps < 0 || royaltyBps > 1000) {
    throw new Error('FORGE_TEST_ROYALTY_BPS must be an integer from 0 through 1000.');
  }

  console.log('TESTNET ONLY - Base Sepolia Atomic Forge deployment');
  console.log('Network:', hre.network.name, 'chainId', chainId.toString());
  console.log('Deployer:', deployer.address);
  console.log('Owner:', owner);
  console.log('Forge signer:', forgeSigner);
  console.log('Fee recipient:', feeRecipient);

  // V1 testnet uses a disposable parent collection so production VoxelFlip is never touched.
  const Parent = await hre.ethers.getContractFactory('MockVoxelFlipParent');
  const parent = await Parent.deploy();
  await parent.waitForDeployment();
  const parentAddress = await parent.getAddress();

  const Forge = await hre.ethers.getContractFactory('VoxelForgeAtomic');
  const forge = await Forge.deploy(
    owner,
    parentAddress,
    forgeSigner,
    feeRecipient,
    royaltyBps
  );
  await forge.waitForDeployment();
  const forgeAddress = await forge.getAddress();

  const output = {
    testnetOnly: true,
    network: hre.network.name,
    chainId: chainId.toString(),
    deployer: deployer.address,
    owner,
    forgeSigner,
    feeRecipient,
    royaltyBps,
    MockVoxelFlipParent: parentAddress,
    VoxelForgeAtomic: forgeAddress,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync('deployed-forge-base-sepolia.json', JSON.stringify(output, null, 2));

  console.log('\nBase Sepolia deployment complete.');
  console.log('MockVoxelFlipParent=' + parentAddress);
  console.log('VoxelForgeAtomic=' + forgeAddress);
  console.log('Saved deployed-forge-base-sepolia.json');
  console.log('No production VoxelFlip contract was modified or called.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
