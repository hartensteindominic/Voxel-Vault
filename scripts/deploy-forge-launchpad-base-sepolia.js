const fs = require('fs');
const hre = require('hardhat');

const BASE_SEPOLIA_CHAIN_ID = 84532n;
const BASE_MAINNET_CHAIN_ID = 8453n;

function requiredAddress(name, value, fallback) {
  const candidate = String(value || fallback || '').trim();
  if (!hre.ethers.isAddress(candidate)) {
    throw new Error(`${name} must be a valid address.`);
  }
  return hre.ethers.getAddress(candidate);
}

function uintFromEnv(name, fallback) {
  const raw = String(process.env[name] ?? fallback).trim();
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an unsigned integer.`);
  return BigInt(raw);
}

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId === BASE_MAINNET_CHAIN_ID) {
    throw new Error('REFUSING DEPLOYMENT: this launchpad script is Base Sepolia only.');
  }
  if (network.chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(`REFUSING DEPLOYMENT: expected Base Sepolia chainId 84532, received ${network.chainId}.`);
  }
  if (process.env.ENABLE_FORGE_LAUNCHPAD_TESTNET_DEPLOY !== 'true') {
    throw new Error(
      'Launchpad testnet deployment is locked. Set ENABLE_FORGE_LAUNCHPAD_TESTNET_DEPLOY=true only when you intentionally approve Base Sepolia transactions.'
    );
  }

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error('Missing a configured Base Sepolia signer.');

  const owner = requiredAddress('FORGE_FACTORY_OWNER', process.env.FORGE_FACTORY_OWNER, deployer.address);
  const platformTreasury = requiredAddress(
    'FORGE_PLATFORM_TREASURY',
    process.env.FORGE_PLATFORM_TREASURY,
    deployer.address
  );
  const demoCreatorTreasury = requiredAddress(
    'FORGE_DEMO_CREATOR_TREASURY',
    process.env.FORGE_DEMO_CREATOR_TREASURY,
    deployer.address
  );
  const demoSigner = requiredAddress('FORGE_DEMO_SIGNER', process.env.FORGE_DEMO_SIGNER, deployer.address);

  const platformBps = Number(process.env.FORGE_PLATFORM_BPS || '1500');
  if (!Number.isInteger(platformBps) || platformBps < 0 || platformBps > 3000) {
    throw new Error('FORGE_PLATFORM_BPS must be an integer from 0 through 3000.');
  }

  const deployFeeWei = uintFromEnv('FORGE_FACTORY_DEPLOY_FEE_WEI', hre.ethers.parseEther('0.01').toString());
  const demoBasePriceWei = uintFromEnv('FORGE_DEMO_BASE_PRICE_WEI', hre.ethers.parseEther('0.0005').toString());
  const demoIncrementWei = uintFromEnv('FORGE_DEMO_INCREMENT_WEI', hre.ethers.parseEther('0.00001').toString());
  const createDemo = process.env.CREATE_FORGE_LAUNCHPAD_DEMO === 'true';

  console.log('TESTNET ONLY - Base Sepolia Forge Launchpad');
  console.log('Deployer:', deployer.address);
  console.log('Factory owner:', owner);
  console.log('Platform treasury:', platformTreasury);
  console.log('Platform split (bps):', platformBps);
  console.log('Creator deploy fee (wei):', deployFeeWei.toString());
  console.log('Create demo clone:', createDemo);

  const Implementation = await hre.ethers.getContractFactory('ForgeClone');
  const implementation = await Implementation.deploy();
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();

  const Factory = await hre.ethers.getContractFactory('ForgeFactory');
  const factory = await Factory.deploy(
    owner,
    implementationAddress,
    platformTreasury,
    platformBps,
    deployFeeWei
  );
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  let demoForgeAddress = null;
  let demoCreateTxHash = null;

  if (createDemo) {
    // The transaction sender becomes the clone owner. Keep this demo path for a
    // disposable test signer only; production creator ownership should come from
    // the creator's own wallet/smart account.
    const tx = await factory.createForge(
      process.env.FORGE_DEMO_NAME || 'Voxel Forge Demo',
      process.env.FORGE_DEMO_SYMBOL || 'VFD',
      demoCreatorTreasury,
      demoSigner,
      demoBasePriceWei,
      demoIncrementWei,
      { value: deployFeeWei }
    );
    const receipt = await tx.wait();
    demoCreateTxHash = receipt.hash;
    const created = receipt.logs
      .map((log) => {
        try { return factory.interface.parseLog(log); } catch { return null; }
      })
      .find((event) => event?.name === 'ForgeCreated');
    if (!created) throw new Error('Demo ForgeCreated event was not found.');
    demoForgeAddress = hre.ethers.getAddress(created.args.forge);
  }

  const output = {
    testnetOnly: true,
    network: hre.network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    owner,
    platformTreasury,
    platformBps,
    deployFeeWei: deployFeeWei.toString(),
    ForgeCloneImplementation: implementationAddress,
    ForgeFactory: factoryAddress,
    demoForge: demoForgeAddress,
    demoCreateTxHash,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = process.env.FORGE_LAUNCHPAD_DEPLOYMENT_FILE || 'deployed-forge-launchpad-base-sepolia.json';
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log('\nBase Sepolia Forge Launchpad deployment complete.');
  console.log('ForgeClone implementation=' + implementationAddress);
  console.log('ForgeFactory=' + factoryAddress);
  if (demoForgeAddress) console.log('Demo Forge=' + demoForgeAddress);
  console.log('Saved ' + outputPath);
  console.log('No Base mainnet deployment was attempted.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
