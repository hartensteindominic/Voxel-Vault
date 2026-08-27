require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];
const standardSolidity = {
  version: '0.8.26',
  settings: {
    evmVersion: 'cancun',
    optimizer: { enabled: true, runs: 200 },
  },
};
const viaIrSolidity = {
  version: '0.8.26',
  settings: {
    evmVersion: 'cancun',
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
  },
};

module.exports = {
  solidity: {
    compilers: [standardSolidity],
    overrides: {
      'contracts/VoxelForgeRevenue.sol': viaIrSolidity,
      'contracts/BaseLiquidityManager.sol': viaIrSolidity,
    },
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || '',
      accounts: deployerKey,
      chainId: 11155111,
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || '',
      accounts: deployerKey,
      chainId: 1,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      accounts: deployerKey,
      chainId: 84532,
    },
    base: {
      url: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      accounts: deployerKey,
      chainId: 8453,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || '',
  },
};
