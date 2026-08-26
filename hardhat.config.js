require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];

module.exports = {
  solidity: {
    version: '0.8.26',
    settings: {
      evmVersion: 'cancun',
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      // Base is not one of Hardhat's built-in mainnet histories. Fork tests can
      // otherwise fail before executing contract bytecode with "No known hardfork".
      // These low activation blocks are intentionally test-only: the production
      // VoxelFlip deployment is far newer than Cancun, so every forked block we
      // execute is evaluated with the expected modern EVM rules.
      chains: {
        8453: {
          hardforkHistory: {
            berlin: 1,
            london: 2,
            shanghai: 3,
            cancun: 4,
          },
        },
      },
    },
    // Keep Ethereum Sepolia intact for the legacy VoxelVault deploy script.
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || '',
      accounts: deployerKey,
      chainId: 11155111,
    },
    // Atomic Forge testnet. This is Base Sepolia, NOT Base mainnet.
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      accounts: deployerKey,
      chainId: 84532,
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || '',
      accounts: deployerKey,
      chainId: 1,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || '',
  },
};
