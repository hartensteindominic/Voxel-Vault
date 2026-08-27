import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const contract = read('contracts/BaseMultiArbExecutor.sol');
const scanner = read('lib/base-multipair-profit-engine.ts');
const route = read('app/api/profit-engine/multipair/route.ts');
const page = read('app/profit-engine/v6/page.js');
const deploy = read('app/profit-engine/v6/deploy/page.js');
const meter = read('app/profit-engine/v6/ProfitReadinessMeter.js');
const v6Layout = read('app/profit-engine/v6/layout.js');
const hardhat = read('hardhat.config.js');

function requireText(source, value, label) {
  if (!source.includes(value)) throw new Error(`V6 safety check failed: ${label}`);
}
function forbidText(source, value, label) {
  if (source.includes(value)) throw new Error(`V6 safety check failed: ${label}`);
}

requireText(contract, 'address public constant USDC', 'USDC must be a fixed contract constant');
requireText(contract, 'address public constant CBBTC', 'cbBTC must be a fixed contract constant');
requireText(contract, 'address public constant CBETH', 'cbETH must be a fixed contract constant');
requireText(contract, 'address public constant AERO', 'AERO must be a fixed contract constant');
requireText(contract, 'function isSupportedQuoteToken(address token)', 'contract must enforce a quote-token allowlist');
requireText(contract, 'return token == USDC || token == CBBTC || token == CBETH || token == AERO;', 'only the four reviewed quote tokens may execute');
requireText(contract, 'MAX_CAPITAL_PER_CALL = 1 ether', 'per-call capital must remain hard capped');
requireText(contract, 'finalWeth >= capitalWei + minProfitWei', 'contract must enforce its atomic profit floor');
requireText(contract, 'external payable onlyOwner nonReentrant', 'execution must remain owner-only and reentrancy guarded');
requireText(contract, 'require(IERC20(quoteToken).balanceOf(address(this)) == 0', 'quote-token dust must block ambiguous trade state');
forbidText(contract, 'delegatecall', 'executor must never delegatecall arbitrary code');
forbidText(contract, 'selfdestruct', 'executor must never selfdestruct');

requireText(scanner, "symbol: 'USDC'", 'scanner must include USDC');
requireText(scanner, "symbol: 'cbBTC'", 'scanner must include cbBTC');
requireText(scanner, "symbol: 'cbETH'", 'scanner must include cbETH');
requireText(scanner, "symbol: 'AERO'", 'scanner must include AERO');
requireText(scanner, 'MULTI_QUOTE_TOKENS.flatMap', 'scanner must use its fixed reviewed token set');
requireText(scanner, "stateTag: 'pending'", 'Flashblocks pending state must be supported');
requireText(scanner, 'ESTIMATED_MULTI_EXECUTOR_GAS', 'scanner must budget executor gas');
requireText(scanner, 'const requiredGross = op.gasBudgetWei + op.targetProfitWei', 'scanner must include gas plus target in the contract profit floor');
requireText(scanner, 'minProfitWei: requiredGross.toString()', 'scanner must pass the full required gross floor to execution parameters');
requireText(scanner, "scanMode: 'MULTI_PAIR_V6'", 'scanner must disclose V6 mode');
forbidText(scanner, 'Wallet(', 'scanner must never instantiate a signing wallet');
forbidText(scanner, 'PRIVATE_KEY', 'scanner must never read private keys');
forbidText(scanner, 'sendTransaction', 'scanner must never submit transactions');
forbidText(scanner, 'eth_sendRawTransaction', 'scanner must never submit raw transactions');

requireText(route, 'scanBaseMultiPairArbitrage', 'V6 API must use the reviewed multi-pair scanner');
forbidText(route, 'sendTransaction', 'V6 API route must remain read-only');
forbidText(route, 'PRIVATE_KEY', 'V6 API route must never read private keys');

requireText(page, "const [autoWatch,setAutoWatch]=useState(true)", 'V6 auto-watch must start enabled');
requireText(page, "fetch('/api/profit-engine/multipair'", 'V6 auto-watch must only call the read-only scanner API');
requireText(page, 'verifyMultiExecutor(candidate,browserProvider)', 'V6 executor must be live-verified before execution');
requireText(page, 'getAddress(connectedWallet)!==APPROVED_OWNER', 'V6 execution must require the reviewed owner wallet');
requireText(page, 'fn.staticCall(...args', 'V6 must perform a fresh no-spend simulation');
requireText(page, 'fn.estimateGas(...args', 'V6 must perform a fresh wallet gas estimate');
requireText(page, 'simulatedGross-estimatedWalletGas<target', 'fresh gas must still leave the configured net target');
requireText(page, 'SIMULATE + EXECUTE ATOMICALLY', 'V6 execution must remain an explicit user action');
forbidText(page, 'execute(data.best)', 'V6 auto-watch must never auto-execute a candidate');
forbidText(page, 'eth_sendRawTransaction', 'V6 browser must not bypass wallet signing');
forbidText(page, 'new Wallet', 'V6 browser must not instantiate a private signing wallet');
forbidText(page, 'PRIVATE_KEY', 'V6 browser must never read private keys');

requireText(meter, "const READY_TEXT='PROFIT FLOOR CLEARED'", 'readiness meter must key off the reviewed V6 profitable state');
requireText(meter, 'MutationObserver', 'readiness meter must observe the existing V6 state instead of driving execution');
requireText(meter, 'READY TO SIMULATE', 'profitable state must be visually unmistakable');
requireText(meter, 'BPS TO GO', 'non-profitable state must show exact distance to the floor');
requireText(meter, 'findActionButton', 'ready banner may locate the explicit simulation control');
requireText(meter, 'scrollIntoView', 'ready banner may only navigate the user to the explicit action');
forbidText(meter, "fetch('/api/profit-engine/multipair'", 'readiness meter must not create a duplicate scanner loop');
forbidText(meter, '.click()', 'readiness meter must never click the execute button automatically');
forbidText(meter, 'sendTransaction', 'readiness meter must never submit a transaction');
forbidText(meter, 'eth_sendRawTransaction', 'readiness meter must never submit a raw transaction');
forbidText(meter, 'Wallet(', 'readiness meter must never create a signing wallet');
forbidText(meter, 'PRIVATE_KEY', 'readiness meter must never read private keys');
requireText(v6Layout, '<ProfitReadinessMeter />', 'V6 route layout must mount the readiness meter');

requireText(deploy, "EXPECTED_BYTECODE_SHA256='cee514d98a08a191a5d4db4253fe3712c23c2207ae1199b16ef58904b22a05ee'", 'V6 deploy page must pin the CI bytecode hash');
requireText(deploy, "fetch('/profit-engine/multi-executor-bytecode.txt'", 'V6 deploy page must load only the pinned creation bytecode');
requireText(deploy, 'verify.isSupportedQuoteToken(EXPECTED.usdc)', 'deployment must verify the USDC allowlist entry');
requireText(deploy, 'verify.isSupportedQuoteToken(EXPECTED.cbbtc)', 'deployment must verify the cbBTC allowlist entry');
requireText(deploy, 'verify.isSupportedQuoteToken(EXPECTED.cbeth)', 'deployment must verify the cbETH allowlist entry');
requireText(deploy, 'verify.isSupportedQuoteToken(EXPECTED.aeroToken)', 'deployment must verify the AERO allowlist entry');
requireText(deploy, 'MULTI_EXECUTOR_STORAGE_KEY', 'verified V6 deployment must activate on the same device');
requireText(deploy, '/profit-engine/v6?executor=', 'post-deploy verification failures must offer read-only recovery instead of redeployment');
forbidText(deploy, 'PRIVATE_KEY', 'V6 deploy page must never read private keys');

requireText(hardhat, "'contracts/BaseMultiArbExecutor.sol': viaIrSolidity", 'V6 contract must use its reviewed viaIR compiler override');

console.log('V6 multi-pair Profit Engine safety checks passed.');
