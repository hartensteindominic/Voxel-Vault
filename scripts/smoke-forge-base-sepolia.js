const fs = require('fs');
const hre = require('hardhat');

const BASE_SEPOLIA_CHAIN_ID = 84532n;
const BASE_MAINNET_CHAIN_ID = 8453n;

const voucherTypes = {
  ForgeVoucher: [
    { name: 'account', type: 'address' },
    { name: 'parentTokenId0', type: 'uint256' },
    { name: 'parentTokenId1', type: 'uint256' },
    { name: 'parentTokenId2', type: 'uint256' },
    { name: 'parentMetadataHash0', type: 'bytes32' },
    { name: 'parentMetadataHash1', type: 'bytes32' },
    { name: 'parentMetadataHash2', type: 'bytes32' },
    { name: 'recipeHash', type: 'bytes32' },
    { name: 'descendantUriHash', type: 'bytes32' },
    { name: 'feeWei', type: 'uint256' },
    { name: 'voucherId', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
  ],
};

function hashText(value) {
  return hre.ethers.keccak256(hre.ethers.toUtf8Bytes(value));
}

function readDeployment() {
  const path = process.env.FORGE_TEST_DEPLOYMENT_FILE || 'deployed-forge-base-sepolia.json';
  if (!fs.existsSync(path)) {
    throw new Error(`Missing ${path}. Deploy the Base Sepolia test contracts first.`);
  }
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId === BASE_MAINNET_CHAIN_ID) {
    throw new Error('REFUSING SMOKE TEST: this script can never run on Base mainnet.');
  }
  if (network.chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(`REFUSING SMOKE TEST: expected Base Sepolia chainId 84532, received ${network.chainId}.`);
  }
  if (process.env.ENABLE_FORGE_TESTNET_SMOKE !== 'true') {
    throw new Error('Testnet smoke flow is locked. Set ENABLE_FORGE_TESTNET_SMOKE=true only when you intentionally approve testnet transactions.');
  }

  const [wallet] = await hre.ethers.getSigners();
  if (!wallet) throw new Error('Missing a configured Base Sepolia signer.');

  const deployment = readDeployment();
  if (String(deployment.chainId) !== '84532' || deployment.testnetOnly !== true) {
    throw new Error('Deployment file is not a recognized Base Sepolia Forge test deployment.');
  }

  const parentAddress = hre.ethers.getAddress(deployment.MockVoxelFlipParent);
  const forgeAddress = hre.ethers.getAddress(deployment.VoxelForgeAtomic);
  const parentCode = await hre.ethers.provider.getCode(parentAddress);
  const forgeCode = await hre.ethers.provider.getCode(forgeAddress);
  if (parentCode === '0x' || forgeCode === '0x') throw new Error('Testnet contract bytecode is missing.');

  const Parent = await hre.ethers.getContractFactory('MockVoxelFlipParent');
  const Forge = await hre.ethers.getContractFactory('VoxelForgeAtomic');
  const parent = Parent.attach(parentAddress).connect(wallet);
  const forge = Forge.attach(forgeAddress).connect(wallet);

  const configuredForgeSigner = hre.ethers.getAddress(await forge.forgeSigner());
  if (configuredForgeSigner !== hre.ethers.getAddress(wallet.address)) {
    throw new Error('Smoke flow expects the disposable Base Sepolia deployer to be the configured Forge signer. Use a dedicated test signer configuration before running.');
  }

  const parentUris = [
    `ipfs://voxelforge-base-sepolia-smoke/${Date.now()}-parent-1.json`,
    `ipfs://voxelforge-base-sepolia-smoke/${Date.now()}-parent-2.json`,
    `ipfs://voxelforge-base-sepolia-smoke/${Date.now()}-parent-3.json`,
  ];

  const tokenIds = [];
  for (const uri of parentUris) {
    const tx = await parent.mint(wallet.address, uri);
    const receipt = await tx.wait();
    const transfer = receipt.logs
      .map((log) => {
        try { return parent.interface.parseLog(log); } catch { return null; }
      })
      .find((event) => event?.name === 'Transfer' && event.args.from === hre.ethers.ZeroAddress);
    if (!transfer) throw new Error('Could not determine minted parent token ID.');
    tokenIds.push(BigInt(transfer.args.tokenId));
  }

  await (await parent.setApprovalForAll(forgeAddress, true)).wait();

  const descendantURI = `ipfs://voxelforge-base-sepolia-smoke/${Date.now()}-descendant.json`;
  const latest = await hre.ethers.provider.getBlock('latest');
  const feeWei = BigInt(process.env.FORGE_TEST_FEE_WEI || '1000000000000');
  const voucher = {
    account: wallet.address,
    parentTokenId0: tokenIds[0],
    parentTokenId1: tokenIds[1],
    parentTokenId2: tokenIds[2],
    parentMetadataHash0: hashText(parentUris[0]),
    parentMetadataHash1: hashText(parentUris[1]),
    parentMetadataHash2: hashText(parentUris[2]),
    recipeHash: hashText(`base-sepolia-smoke:${tokenIds.join('-')}:recipe-v1`),
    descendantUriHash: hashText(descendantURI),
    feeWei,
    voucherId: hre.ethers.hexlify(hre.ethers.randomBytes(32)),
    deadline: BigInt(latest.timestamp + 300),
  };

  const signature = await wallet.signTypedData(
    {
      name: 'VoxelForge',
      version: '1',
      chainId: network.chainId,
      verifyingContract: forgeAddress,
    },
    voucherTypes,
    voucher
  );

  const beforeFees = await hre.ethers.provider.getBalance(forgeAddress);
  const forgeTx = await forge.forge(voucher, descendantURI, signature, { value: feeWei });
  const forgeReceipt = await forgeTx.wait();
  const afterFees = await hre.ethers.provider.getBalance(forgeAddress);

  for (const tokenId of tokenIds) {
    let burned = false;
    try {
      await parent.ownerOf(tokenId);
    } catch {
      burned = true;
    }
    if (!burned) throw new Error(`Parent ${tokenId} still exists after Forge.`);
  }

  const descendantOwner = await forge.ownerOf(1n);
  if (hre.ethers.getAddress(descendantOwner) !== hre.ethers.getAddress(wallet.address)) {
    throw new Error('Descendant was not minted to the test wallet.');
  }
  if (afterFees - beforeFees !== feeWei) throw new Error('Forge fee was not retained exactly.');

  console.log('BASE SEPOLIA ATOMIC FORGE SMOKE PASSED');
  console.log('Wallet:', wallet.address);
  console.log('Parents:', tokenIds.map(String).join(', '));
  console.log('Descendant token:', '1');
  console.log('Forge tx:', forgeReceipt.hash);
  console.log('Fee retained (wei):', feeWei.toString());
  console.log('This was Base Sepolia only. No production assets were involved.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
