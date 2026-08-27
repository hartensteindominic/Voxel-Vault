const hre = require('hardhat');

function requiredAddress(name) {
  const value = String(process.env[name] || '').trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error(`${name} must be an explicit EVM address.`);
  return value;
}

async function main() {
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  if (chainId !== 84532) {
    throw new Error(`SpatialVoxelNFT deployment is testnet-only in this release. Expected Base Sepolia (84532), received ${chainId}.`);
  }

  const owner = requiredAddress('SPATIAL_NFT_OWNER_ADDRESS');
  const voucherSigner = requiredAddress('SPATIAL_NFT_SIGNER_ADDRESS');
  const feeRecipient = requiredAddress('SPATIAL_NFT_FEE_RECIPIENT');
  const mintFeeWei = BigInt(String(process.env.SPATIAL_NFT_MINT_FEE_WEI || '0'));
  if (mintFeeWei < 0n) throw new Error('SPATIAL_NFT_MINT_FEE_WEI cannot be negative.');

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying SpatialVoxelNFT to Base Sepolia from ${deployer.address}`);
  console.log(`Owner: ${owner}`);
  console.log(`Voucher signer: ${voucherSigner}`);
  console.log(`Platform fee recipient: ${feeRecipient}`);
  console.log(`Platform mint fee: ${mintFeeWei.toString()} wei`);

  const Factory = await hre.ethers.getContractFactory('SpatialVoxelNFT');
  const contract = await Factory.deploy(owner, voucherSigner, feeRecipient, mintFeeWei);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`SpatialVoxelNFT deployed: ${address}`);
  console.log('Keep NEXT_PUBLIC_SPATIAL_MINT_ENABLED=false until this address, signer, API routes, and a full test mint are reviewed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
