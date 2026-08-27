const { ethers } = require('hardhat');

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 84532n) {
    throw new Error(`Property pilot deployment is Base Sepolia only. Refusing chain ${network.chainId}.`);
  }

  const [deployer] = await ethers.getSigners();
  const propertyLabel = process.env.PILOT_PROPERTY_ID || 'PILOT-0001';
  const legalEntityReference = process.env.PILOT_LEGAL_ENTITY_REFERENCE || 'DEMO PROPERTY LLC - NOT A LIVE OFFERING';
  const deedReference = process.env.PILOT_DEED_REFERENCE || 'DEMO DEED RECORD - NOT VERIFIED';
  const legalAgreementReference = process.env.PILOT_LEGAL_AGREEMENT_REFERENCE || 'DEMO OPERATING AGREEMENT - NOT EXECUTED';
  const metadataURI = process.env.PILOT_PROPERTY_METADATA_URI || 'https://www.voxelvault.io/real-estate';
  const maxSupply = BigInt(process.env.PILOT_PROPERTY_MAX_UNITS || '100000');

  const propertyId = ethers.keccak256(ethers.toUtf8Bytes(propertyLabel));
  const legalEntityHash = ethers.keccak256(ethers.toUtf8Bytes(legalEntityReference));
  const deedRecordHash = ethers.keccak256(ethers.toUtf8Bytes(deedReference));
  const legalAgreementHash = ethers.keccak256(ethers.toUtf8Bytes(legalAgreementReference));

  console.log('Voxel Vault Real Property Pilot');
  console.log('Network: Base Sepolia (84532)');
  console.log('Deployer:', deployer.address);
  console.log('Property:', propertyLabel);
  console.log('WARNING: testnet contracts do not establish legal ownership or authorize an investment offering.');

  const Registry = await ethers.getContractFactory('PropertyRegistry');
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();

  const InterestToken = await ethers.getContractFactory('PropertyInterestToken');
  const interestToken = await InterestToken.deploy(
    `Voxel Vault ${propertyLabel}`,
    'VVRE',
    propertyId,
    legalAgreementHash,
    maxSupply,
    deployer.address
  );
  await interestToken.waitForDeployment();

  const Passport = await ethers.getContractFactory('PropertyPassport');
  const passport = await Passport.deploy(deployer.address, await registry.getAddress());
  await passport.waitForDeployment();

  const DistributionVault = await ethers.getContractFactory('PropertyDistributionVault');
  const distributionVault = await DistributionVault.deploy(deployer.address, await interestToken.getAddress());
  await distributionVault.waitForDeployment();

  await (await registry.registerProperty(
    propertyId,
    deployer.address,
    await interestToken.getAddress(),
    legalEntityHash,
    deedRecordHash,
    metadataURI
  )).wait();

  console.log('PROPERTY_REGISTRY_ADDRESS=', await registry.getAddress());
  console.log('PROPERTY_INTEREST_TOKEN_ADDRESS=', await interestToken.getAddress());
  console.log('PROPERTY_PASSPORT_ADDRESS=', await passport.getAddress());
  console.log('PROPERTY_DISTRIBUTION_VAULT_ADDRESS=', await distributionVault.getAddress());
  console.log('PROPERTY_ID_HASH=', propertyId);
  console.log('Distribution claims are restricted to wallets currently allowlisted by the property interest token.');
  console.log('Property Passport is NOT minted at deployment because the property registry record starts unverified.');
  console.log('After independent verification, mintVerifiedPassport may mint one non-transferable identity NFT for the property.');
  console.log('Registry record is intentionally unverified and inactive after deployment.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});