import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const core = read('lib/base-profit-engine.ts');
const payments = read('lib/x402-resource.ts');
const quote = read('app/api/agent/base-quote/route.ts');
const optimize = read('app/api/agent/optimize/route.ts');
const manifest = read('app/api/agent/manifest/route.ts');
const openapi = read('app/api/agent/openapi/route.ts');

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
forbidText(core, 'eth_sendRawTransaction', 'market-data core must never submit transactions');
forbidText(core, 'DEPLOYER_PRIVATE_KEY', 'market-data core must never read deployer private keys');

requireText(payments, "'PAYMENT-REQUIRED'", 'x402 402 challenge header must be emitted');
requireText(payments, "request.headers.get('PAYMENT-SIGNATURE')", 'x402 payment payload header must be consumed');
requireText(payments, "facilitatorCall('verify'", 'x402 payments must be verified before work');
requireText(payments, "facilitatorCall('settle'", 'x402 payments must be settled before paid output is returned');
requireText(payments, "'PAYMENT-RESPONSE'", 'x402 settlement receipt header must be returned');
requireText(payments, "return 'https://api.cdp.coinbase.com/platform/v2/x402'", 'CDP Base-mainnet facilitator path must be supported');
forbidText(payments, 'VOXELFLIP_MINT_SIGNER_PRIVATE_KEY', 'x402 must not reuse mint signer keys');
forbidText(payments, 'VOXELFORGE_SIGNER_PRIVATE_KEY', 'x402 must not reuse Forge signer keys');

requireText(quote, 'withX402Json', 'base quote route must be x402-gated');
requireText(optimize, 'withX402Json', 'optimizer route must be x402-gated');
forbidText(quote, 'executeUniThenAero', 'paid quote route must not execute trades');
forbidText(optimize, 'executeAeroThenUni', 'paid optimizer route must not execute trades');
requireText(manifest, 'signsTransactions: false', 'manifest must disclose that machine endpoints do not sign');
requireText(openapi, 'PAYMENT-SIGNATURE', 'OpenAPI must document x402 payment header');

console.log('Machine revenue layer safety checks passed.');
