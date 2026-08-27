import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const manager = read('contracts/BaseLiquidityManager.sol');
const treasury = read('contracts/BaseLiquidityTreasury.sol');
const scanner = read('lib/base-liquidity-scanner.ts');
const route = read('app/api/liquidity-engine/scan/route.ts');
const deploy = read('scripts/deploy-base-liquidity-engine.js');
const envExample = read('.env.example');

function requireText(source, value, label) {
  if (!source.includes(value)) throw new Error(`Liquidity safety check failed: ${label}`);
}
function forbidText(source, value, label) {
  if (source.includes(value)) throw new Error(`Liquidity safety check failed: ${label}`);
}

requireText(manager, 'maxToken0PerPosition', 'manager must cap per-position token0 exposure');
requireText(manager, 'maxToken1PerPosition', 'manager must cap per-position token1 exposure');
requireText(manager, 'maxActivePositions', 'manager must cap concurrent positions');
requireText(manager, 'whenNotPaused', 'new liquidity exposure must be pausable');
requireText(manager, 'onlyOperatorOrOwner', 'execution must be scoped to owner/operator');
requireText(manager, 'recipient: treasury', 'position collection must route directly to treasury');
requireText(manager, 'closeExpired', 'expired positions must have a permissionless cleanup path');
requireText(manager, 'Factory mismatch', 'position manager/factory pairing must be verified');
forbidText(manager, 'delegatecall', 'manager must not use delegatecall');
forbidText(manager, 'tx.origin', 'manager must not use tx.origin authentication');

requireText(treasury, 'onlyOwner', 'treasury withdrawals must remain owner-controlled');
forbidText(treasury, 'swap', 'treasury v1 must not auto-swap proceeds');
forbidText(treasury, 'governance', 'treasury v1 must not perform governance actions');

requireText(scanner, 'https://mainnet-preconf.base.org', 'scanner must support official Base Flashblocks preconfirmation endpoint');
requireText(scanner, "stateTag: 'pending'", 'scanner must read pending preconfirmed state');
requireText(scanner, 'feeGrowthDelta0X128', 'scanner must report raw fee-growth activity');
requireText(scanner, 'not guaranteed fees, APR, or profit', 'scanner must disclose that activity is not guaranteed profit');
forbidText(scanner, 'Wallet(', 'scanner must not instantiate a signing wallet');
forbidText(scanner, 'sendTransaction', 'scanner must not submit transactions');
forbidText(scanner, 'eth_sendRawTransaction', 'scanner must not submit raw transactions');
forbidText(scanner, 'PRIVATE_KEY', 'scanner must not read private keys');
forbidText(route, 'sendTransaction', 'scan API must stay read-only');

requireText(deploy, 'ALLOW_BASE_LIQUIDITY_DEPLOY', 'mainnet deployment must require an explicit unlock flag');
requireText(deploy, "Number(network.chainId) !== 8453", 'deployment must reject non-Base chains');
requireText(deploy, "const operator = optionalAddress('LIQUIDITY_OPERATOR_ADDRESS')", 'operator must be optional/disabled by default');
requireText(envExample, 'ALLOW_BASE_LIQUIDITY_DEPLOY=false', 'example environment must keep deployment locked');
requireText(envExample, 'LIQUIDITY_OPERATOR_ADDRESS=', 'example environment must not silently enable an operator');

console.log('Base liquidity engine safety checks passed.');
