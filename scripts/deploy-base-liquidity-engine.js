const { ethers } = require('hardhat');

const WETH = '0x4200000000000000000000000000000000000006';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const UNISWAP_V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
const UNISWAP_V3_POSITION_MANAGER = '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1';
const ZERO = ethers.ZeroAddress;

function requiredAddress(name) {
  const value = String(process.env[name] || '').trim();
  if (!ethers.isAddress(value) || value === ZERO) throw new Error(`${name} must be a non-zero EVM address.`);
  return ethers.getAddress(value);
}

function optionalAddress(name) {
  const value = String(process.env[name] || '').trim();
  return value && ethers.isAddress(value) ? ethers.getAddress(value) : ZERO;
}

function positiveBigInt(name, fallback) {
  const value = String(process.env[name] || fallback).trim();
  if (!/^\d+$/.test(value) || BigInt(value) <= 0n) throw new Error(`${name} must be a positive integer.`);
  return BigInt(value);
}

async function main() {
  if (String(process.env.ALLOW_BASE_LIQUIDITY_DEPLOY || '').toLowerCase() !== 'true') {
    throw new Error('Deployment locked. Set ALLOW_BASE_LIQUIDITY_DEPLOY=true only for an intentional reviewed Base deployment.');
  }

  const network = await ethers.provider.getNetwork();
  if (Number(network.chainId) !== 8453) throw new Error(`Base mainnet required; got chain ${network.chainId}.`);

  const owner = requiredAddress('LIQUIDITY_OWNER_ADDRESS');
  const operator = optionalAddress('LIQUIDITY_OPERATOR_ADDRESS');
  const maxWethPerPosition = positiveBigInt('LIQUIDITY_MAX_WETH_PER_POSITION_WEI', ethers.parseEther('0.02').toString());
  const maxUsdcPerPosition = positiveBigInt('LIQUIDITY_MAX_USDC_PER_POSITION_ATOMIC', ethers.parseUnits('50', 6).toString());
  const maxWethAllocated = positiveBigInt('LIQUIDITY_MAX_WETH_ALLOCATED_WEI', ethers.parseEther('0.05').toString());
  const maxUsdcAllocated = positiveBigInt('LIQUIDITY_MAX_USDC_ALLOCATED_ATOMIC', ethers.parseUnits('150', 6).toString());
  const maxActivePositions = Number(process.env.LIQUIDITY_MAX_ACTIVE_POSITIONS || '2');
  if (!Number.isInteger(maxActivePositions) || maxActivePositions < 1 || maxActivePositions > 16) {
    throw new Error('LIQUIDITY_MAX_ACTIVE_POSITIONS must be an integer from 1 to 16.');
  }

  const [token0, token1] = BigInt(WETH) < BigInt(USDC) ? [WETH, USDC] : [USDC, WETH];
  if (token0 !== WETH) throw new Error('Unexpected Base token ordering. Deployment stopped.');

  const Treasury = await ethers.getContractFactory('BaseLiquidityTreasury');
  const treasury = await Treasury.deploy(owner, token0, token1);
  await treasury.waitForDeployment();
  const treasuryAddress = ethers.getAddress(await treasury.getAddress());

  const Manager = await ethers.getContractFactory('BaseLiquidityManager');
  const manager = await Manager.deploy(
    owner,
    operator,
    treasuryAddress,
    UNISWAP_V3_POSITION_MANAGER,
    UNISWAP_V3_FACTORY,
    token0,
    token1,
    maxWethPerPosition,
    maxUsdcPerPosition,
    maxWethAllocated,
    maxUsdcAllocated,
    maxActivePositions
  );
  await manager.waitForDeployment();
  const managerAddress = ethers.getAddress(await manager.getAddress());

  const liveFactory = ethers.getAddress(await manager.factory());
  const livePositionManager = ethers.getAddress(await manager.positionManager());
  const liveTreasury = ethers.getAddress(await manager.treasury());
  const liveOwner = ethers.getAddress(await manager.owner());
  if (
    liveFactory !== ethers.getAddress(UNISWAP_V3_FACTORY)
    || livePositionManager !== ethers.getAddress(UNISWAP_V3_POSITION_MANAGER)
    || liveTreasury !== treasuryAddress
    || liveOwner !== owner
  ) {
    throw new Error('Post-deployment verification failed. Do not fund this deployment.');
  }

  console.log(JSON.stringify({
    network: 'base',
    chainId: Number(network.chainId),
    owner,
    operator,
    treasury: treasuryAddress,
    manager: managerAddress,
    uniswapV3Factory: UNISWAP_V3_FACTORY,
    nonfungiblePositionManager: UNISWAP_V3_POSITION_MANAGER,
    token0,
    token1,
    limits: {
      maxWethPerPosition: maxWethPerPosition.toString(),
      maxUsdcPerPosition: maxUsdcPerPosition.toString(),
      maxWethAllocated: maxWethAllocated.toString(),
      maxUsdcAllocated: maxUsdcAllocated.toString(),
      maxActivePositions,
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
