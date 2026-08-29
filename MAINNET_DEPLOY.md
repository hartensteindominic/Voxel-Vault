# Ethereum mainnet deployment (advanced / optional)

This guide is for **advanced optional blockchain infrastructure**. It is not required for the core Voxel Vault product: an authorized house photo → $4.99 digital VoxelPop creation → textured 3D preview → approval → movable voxel works without an Ethereum mainnet deployment.

If you intentionally use this guide, it deploys **real contracts on Ethereum mainnet** (chainId 1), and gas is paid in **real ETH**.

## Before you start

1. Treat the contracts as unaudited unless the exact commit and deployed bytecode have received an independent security review. Existing hardening and tests are **not a substitute for an audit**.
2. Prefer a hardware-backed **multisig** as `MULTISIG_OWNER` and `FEE_RECIPIENT`.
3. Never put `DEPLOYER_PRIVATE_KEY` in Vercel, GitHub, chat, screenshots, logs, or shared shell history. Use a dedicated, minimally funded deployment key only when a local scripted deployment is truly necessary.
4. Keep public mint disabled unless a separately reviewed product decision intentionally enables it.
5. Verify the exact git commit, chain ID, constructor arguments, owner/fee-recipient addresses, and contract source before signing any transaction.

## Local `.env` (do not commit)

```bash
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
DEPLOYER_PRIVATE_KEY=0xYOUR_DEDICATED_DEPLOYMENT_KEY
CONFIRM_MAINNET=yes

# Strongly recommended:
MULTISIG_OWNER=0xYourMultisig
FEE_RECIPIENT=0xYourTreasuryOrMultisig

# Default is public mint OFF. Only set false if you intentionally want open mint:
# DISABLE_PUBLIC_MINT=false

ETHERSCAN_API_KEY=optional_for_verify
```

## Commands

```bash
npm install
npm run chain:compile
npm run chain:deploy:mainnet
```

The script refuses to run if:

- `CONFIRM_MAINNET` is not `yes`;
- RPC chainId is not `1`;
- the deployer has 0 ETH.

Those checks reduce obvious mistakes; they do not prove the deployment is safe or appropriate.

Output includes:

```text
NEXT_PUBLIC_VOXEL_NFT_ADDRESS=0x...
NEXT_PUBLIC_VOXEL_MARKET_ADDRESS=0x...
```

The deployment script may also write `deployed-mainnet-addresses.json`; the repository ignores that generated local file. Contract addresses are public information, but the generated file should not become an accidental source of stale deployment configuration.

## If owner is a multisig

From the multisig, verify the target addresses and calldata, then execute:

1. `nft.setMinter(marketAddress, true)`
2. `nft.setPublicMintEnabled(false)` (recommended)

## Vercel production env

Only after the deployment has been reviewed and intentionally connected to the product:

```bash
NEXT_PUBLIC_EVM_CHAIN_ID=0x1
NEXT_PUBLIC_EVM_CHAIN_NAME=Ethereum
NEXT_PUBLIC_EVM_EXPLORER_URL=https://etherscan.io
NEXT_PUBLIC_VOXEL_NFT_ADDRESS=0x...
NEXT_PUBLIC_VOXEL_MARKET_ADDRESS=0x...
```

Redeploy the Next.js app after changing public contract configuration and verify the exact production commit.

## Verify on Etherscan

```bash
npx hardhat verify --network mainnet <NFT_ADDRESS> <OWNER_ADDRESS>
npx hardhat verify --network mainnet <MARKET_ADDRESS> <OWNER_ADDRESS> <NFT_ADDRESS> <FEE_RECIPIENT>
```

Verification is strongly recommended for any intentional production deployment.

## After-deploy canary

1. Confirm the deployed bytecode, owner, fee recipient, mint permissions, and network in an explorer before using the UI.
2. Test only the smallest practical explicit user-approved action.
3. Confirm explorer links, event data, fee accounting, and any withdrawal path.
4. Monitor balances and permissions; pause the market if something is wrong.
5. Keep the core VoxelPop creator independent from this optional blockchain path.
