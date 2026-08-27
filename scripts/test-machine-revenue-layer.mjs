import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const core = read('lib/base-profit-engine.ts');
const fastGrid = read('lib/base-fast-grid.ts');
const wide = read('lib/base-wide-scanner.ts');
const scanRoute = read('app/api/profit-engine/scan/route.ts');
const payments = read('lib/x402-resource.ts');
const coordinator = read('lib/agent-coordinator.ts');
const quote = read('app/api/agent/base-quote/route.ts');
const optimize = read('app/api/agent/optimize/route.ts');
const decision = read('app/api/agent/decision/route.ts');
const health = read('app/api/agent/health/route.ts');
const manifest = read('app/api/agent/manifest/route.ts');
const openapi = read('app/api/agent/openapi/route.ts');
const profitPage = read('app/profit-engine/page.js');
const deployPage = read('app/profit-engine/deploy/page.js');

function requireText(source, value, label) {
  if (!source.includes(value)) throw new Error(`Machine revenue check failed: ${label}`);
}

function forbidText(source, value, label) {
  if (source.includes(value)) throw new Error(`Machine revenue check failed: ${label}`);
}

requireText(core, 'https://mainnet-preconf.base.org', 'Base Flashblocks endpoint must be present');
requireText(core, "stateTag: 'pending'", 'Flashblocks must quote pending pre-confirmed state');
requireText(core, "{ blockTag }", 'DEX calls must receive an explicit state block tag');
requireText(core, "stateMode: used.flashblocks ? 'flashblocks-pending' : 'sealed-latest'", 'responses must disclose state source');
requireText(core, "rule: 'NO_TRADE", 'profit engine must keep a hard no-trade rule');
requireText(core, 'Promise.all(UNI_FEE_TIERS.map', 'Uniswap fee tiers must quote concurrently');
requireText(core, "Promise.all([false, true].map", 'Aerodrome pool types must quote concurrently');
requireText(core, 'const [uniFirst, aeroFirst] = await Promise.all', 'both executable first legs must quote concurrently');
requireText(core, 'export async function scanBaseArbitrageBatch', 'V5 must share state and gas across batch capital sizes');
requireText(core, '.slice(0, 6)', 'batch scan must remain bounded to six capital sizes');
requireText(core, 'marginToProfitFloorBps', 'executable quotes must expose distance to the actual profit floor');
forbidText(core, 'eth_sendRawTransaction', 'market-data core must never submit transactions');
forbidText(core, 'DEPLOYER_PRIVATE_KEY', 'market-data core must never read deployer private keys');
forbidText(core, 'new Wallet', 'market-data core must never instantiate a signing wallet');

requireText(fastGrid, 'scanBaseArbitrageBatch', 'boss grid must use the shared-state batch scanner');
requireText(fastGrid, "? 'HOT'", 'boss grid must identify near-profit hot states');
requireText(fastGrid, 'suggestedCadenceMs', 'boss grid must publish bounded watch cadence guidance');
requireText(fastGrid, 'never executes or signs anything', 'boss grid must remain read-only');
forbidText(fastGrid, 'sendTransaction', 'boss grid must never submit transactions');
forbidText(fastGrid, 'eth_sendRawTransaction', 'boss grid must never submit raw transactions');
forbidText(fastGrid, 'PRIVATE_KEY', 'boss grid must never read private keys');
forbidText(fastGrid, 'new Wallet', 'boss grid must never instantiate a signing wallet');

requireText(wide, "'Aerodrome Slipstream'", 'wide scanner must include Slipstream discovery');
requireText(wide, "symbol: 'cbBTC'", 'wide scanner must include cbBTC discovery');
requireText(wide, "symbol: 'cbETH'", 'wide scanner must include cbETH discovery');
requireText(wide, "symbol: 'AERO'", 'wide scanner must include AERO discovery');
requireText(wide, "executionCompatibility: token.symbol === 'USDC'", 'wide scanner must explicitly separate current-executor routes from watch-only routes');
requireText(wide, 'WIDE_SCAN_IS_READ_ONLY', 'wide scanner must declare itself read-only');
forbidText(wide, 'sendTransaction', 'wide scanner must never submit transactions');
forbidText(wide, 'eth_sendRawTransaction', 'wide scanner must never submit raw transactions');
forbidText(wide, 'PRIVATE_KEY', 'wide scanner must never read private keys');
forbidText(wide, 'new Wallet', 'wide scanner must never instantiate a signing wallet');

requireText(scanRoute, 'normalized.inputWei / BigInt(16)', 'V5 adaptive scan must test a smaller capital size');
requireText(scanRoute, '(normalized.inputWei * BigInt(3)) / BigInt(4)', 'V5 adaptive scan must test a three-quarter size');
requireText(scanRoute, 'normalized.inputWei,', 'adaptive scan must include the user capital cap itself');
forbidText(scanRoute, 'normalized.inputWei * BigInt(2)', 'adaptive scan must never exceed the user capital cap');
requireText(scanRoute, "body?.mode === 'fast' ? 'fast' : 'wide'", 'scan endpoint must split fast and wide modes');
requireText(scanRoute, 'scanBaseArbitrageGridParallel', 'scan endpoint must use boss multi-size executable quotes');
requireText(scanRoute, "scanMode: mode === 'fast' ? 'BOSS_FAST_V5' : 'BOSS_WIDE_V5'", 'scan endpoint must disclose V5 boss mode');
requireText(scanRoute, 'suggestedCadenceMs: grid.suggestedCadenceMs', 'scan endpoint must expose safe burst cadence guidance');
requireText(scanRoute, 'scanBaseWideMarkets', 'wide mode must still run read-only discovery');
forbidText(scanRoute, 'sendTransaction', 'scan route must remain read-only');
forbidText(scanRoute, 'PRIVATE_KEY', 'scan route must never read private keys');

requireText(payments, "'PAYMENT-REQUIRED'", 'x402 402 challenge header must be emitted');
requireText(payments, "request.headers.get('PAYMENT-SIGNATURE')", 'x402 payment payload header must be consumed');
requireText(payments, "facilitatorCall('verify'", 'x402 payments must be verified before work');
requireText(payments, "facilitatorCall('settle'", 'x402 payments must be settled before paid output is returned');
requireText(payments, "'PAYMENT-RESPONSE'", 'x402 settlement receipt header must be returned');
requireText(payments, "return 'https://api.cdp.coinbase.com/platform/v2/x402'", 'CDP Base-mainnet facilitator path must be supported');
forbidText(payments, 'VOXELFLIP_MINT_SIGNER_PRIVATE_KEY', 'x402 must not reuse mint signer keys');
forbidText(payments, 'VOXELFORGE_SIGNER_PRIVATE_KEY', 'x402 must not reuse Forge signer keys');

requireText(coordinator, "mode: 'READ_ONLY_COORDINATOR'", 'coordinator must remain explicitly read-only');
requireText(coordinator, 'requireFlashblocks', 'coordinator must support a Flashblocks-required policy');
requireText(coordinator, 'maxQuoteEth', 'coordinator must expose its quote cap');
requireText(coordinator, 'ticketLifetimeMs', 'coordinator must bound ticket lifetime');
requireText(coordinator, 'authorization: false', 'execution ticket must explicitly not authorize spending');
requireText(coordinator, 'signature: null', 'execution ticket must never contain a coordinator signature');
requireText(coordinator, 'requiresFreshWalletSimulation: true', 'execution candidate must require fresh wallet simulation');
forbidText(coordinator, 'Wallet(', 'coordinator must never instantiate a signing wallet');
forbidText(coordinator, 'sendTransaction', 'coordinator must never send a transaction');
forbidText(coordinator, 'eth_sendRawTransaction', 'coordinator must never submit raw transactions');
forbidText(coordinator, 'PRIVATE_KEY', 'coordinator must never read private keys');

requireText(quote, 'withX402Json', 'base quote route must be x402-gated');
requireText(optimize, 'withX402Json', 'optimizer route must be x402-gated');
requireText(decision, 'withX402Json', 'agent decision route must be x402-gated');
requireText(decision, 'coordinateBaseAgentDecision', 'decision route must use the bounded coordinator');
forbidText(quote, 'executeUniThenAero', 'paid quote route must not execute trades');
forbidText(optimize, 'executeAeroThenUni', 'paid optimizer route must not execute trades');
forbidText(decision, 'executeUniThenAero', 'paid decision route must not execute trades');
requireText(health, 'signsTransactions: false', 'health endpoint must disclose no signing');
requireText(manifest, 'authorizesSpending: false', 'manifest must disclose that tickets do not authorize spending');
requireText(openapi, '/api/agent/decision', 'OpenAPI must document the decision endpoint');
requireText(openapi, 'PAYMENT-SIGNATURE', 'OpenAPI must document x402 payment header');

requireText(deployPage, "window.localStorage.setItem(EXECUTOR_STORAGE_KEY,address)", 'verified deployment must be activatable on the same device without a server secret');
requireText(deployPage, 'getAddress(owner)!==APPROVED_OWNER', 'deployment must verify the reviewed owner before device activation');
requireText(deployPage, 'getAddress(uni)!==EXPECTED.uni', 'deployment must verify the reviewed Uniswap router');
requireText(deployPage, 'getAddress(aero)!==EXPECTED.aero', 'deployment must verify the reviewed Aerodrome router');
requireText(deployPage, 'VERIFY EXISTING EXECUTOR', 'failed post-deploy reads must offer recovery instead of redeployment');
requireText(deployPage, '/profit-engine?executor=', 'recovery must pass only the public deployed contract address');
forbidText(deployPage, 'PRIVATE_KEY', 'browser deployment page must never read private keys');

requireText(profitPage, "const fromUrl=params.get('executor')", 'profit page must accept an existing executor recovery address');
requireText(profitPage, 'setExecutorVerified(false)', 'recovered executor must start unverified');
requireText(profitPage, "const [targetBps,setTargetBps]=useState('5')", 'V5 UI must keep a positive net-profit target by default');
requireText(profitPage, 'const [autoWatch,setAutoWatch]=useState(true)', 'V5 boss auto-watch must start enabled');
requireText(profitPage, 'const manualPauseRef=useRef(false)', 'boss watcher must distinguish explicit user pause from automatic candidate pause');
requireText(profitPage, 'const nextDelayRef=useRef(12000)', 'boss watcher must start from a bounded cadence');
requireText(profitPage, 'Math.max(4000,Math.min(15000', 'boss watcher burst cadence must stay bounded between 4s and 15s');
requireText(profitPage, "autoCycleRef.current%8===0?'wide':'fast'", 'boss watcher must use fast scans between periodic wide scans');
requireText(profitPage, "document.addEventListener('visibilitychange',resumeWhenVisible)", 'boss watcher must resume when an unpaused page returns to the foreground');
requireText(profitPage, "setStatus('BOSS AUTO WATCH PAUSED BY YOU.", 'explicit pause must be clearly disclosed');
requireText(profitPage, "'TURN BOSS AUTO WATCH ON'", 'off state must render an explicit resume action');
requireText(profitPage, 'manualPauseRef.current=false;\n          autoCycleRef.current=0;\n          setAutoWatch(true);', 'manual non-profitable scans must restart continuous watch');
requireText(profitPage, 'BOSS AUTO WATCH IS ON and will keep hunting.', 'manual scan status must agree with the actual watch state');
requireText(profitPage, "heat==='HOT'", 'boss UI must react to near-profit hot states');
requireText(profitPage, 'if(data.best)', 'boss watcher must detect profitable candidates');
requireText(profitPage, 'if(automatic)setAutoWatch(false)', 'boss watcher must pause when a candidate is found');
forbidText(profitPage, 'execute(data.best)', 'boss auto-watch must never execute a discovered candidate automatically');
requireText(profitPage, 'const code=await browserProvider.getCode(candidate)', 'verification must first confirm deployed bytecode exists');
requireText(profitPage, 'const executorAddress=await verifyExecutor(candidate,browserProvider);', 'device executor must be re-verified live before use');
requireText(profitPage, 'getAddress(connectedWallet)!==APPROVED_OWNER', 'execution must require the reviewed owner wallet');
requireText(profitPage, 'fn.staticCall(...args', 'execution must run a fresh no-spend static simulation');
requireText(profitPage, 'fn.estimateGas(...args', 'execution must run a fresh wallet gas estimate');
requireText(profitPage, 'simulatedGross-estimatedWalletGas<target', 'wallet execution must still clear the net target after estimated gas');
requireText(profitPage, 'Boss auto-watch only reads quotes', 'UI must disclose that boss auto-watch cannot execute');
requireText(profitPage, 'Closest executable:', 'UI must surface the nearest executable route instead of only NO TRADE');
requireText(profitPage, 'Wide market radar', 'UI must clearly separate wide discovery from execution');
requireText(profitPage, 'This is the only execution-capable section', 'UI must identify the only execution-capable section');
requireText(profitPage, 'WATCH ONLY', 'wide signals must be visibly non-executable');
forbidText(profitPage, 'PRIVATE_KEY', 'browser execution page must never read private keys');
forbidText(profitPage, 'eth_sendRawTransaction', 'browser execution page must not bypass wallet signing');
forbidText(profitPage, 'new Wallet', 'boss auto-watch page must not instantiate a signing wallet');

console.log('Machine revenue layer safety checks passed.');
