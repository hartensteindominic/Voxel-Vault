import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const core = read('lib/ai-licensing.ts');
const catalog = read('app/api/licenses/catalog/route.ts');
const paid = read('app/api/licenses/use/route.ts');
const page = read('app/ai-licensing/page.tsx');
const manifest = read('app/api/agent/manifest/route.ts');
const openapi = read('app/api/agent/openapi/route.ts');

function requireText(source, value, label) {
  if (!source.includes(value)) throw new Error(`AI licensing check failed: ${label}`);
}
function forbidText(source, value, label) {
  if (source.includes(value)) throw new Error(`AI licensing check failed: ${label}`);
}

requireText(core, "AI_LICENSE_KIND = 'single-machine-use-v1'", 'license kind must remain explicitly single-use');
requireText(core, "DEFAULT_AI_LICENSE_PRICE_ATOMIC = '10000'", 'default license price must remain explicit in atomic USDC');
requireText(core, 'nft.ownerOf(tokenId)', 'current NFT ownership must be checked on Base');
requireText(core, 'if (owner !== licensor)', 'only the configured current licensor owner may offer a token');
requireText(core, 'nft.tokenURI(tokenId)', 'license receipt must resolve the NFT tokenURI');
requireText(core, 'units: 1', 'each payment must issue exactly one machine-use unit');
requireText(core, 'modelTrainingAllowed: false', 'V1 must not silently grant model-training rights');
requireText(core, 'A new x402 license payment is required for each additional machine-use unit.', 'repeat machine use must require another payment');
requireText(core, 'NFT ownership by itself is not a representation', 'rights notice must not equate NFT ownership with copyright');
forbidText(core, 'PRIVATE_KEY', 'licensing core must never read a private key');
forbidText(core, 'new Wallet', 'licensing core must never instantiate a signing wallet');
forbidText(core, 'sendTransaction', 'licensing core must never submit transactions');
forbidText(core, 'eth_sendRawTransaction', 'licensing core must never submit raw transactions');

requireText(catalog, 'listLicensableAssets', 'catalog must derive from verified licensable assets');
requireText(catalog, 'x402RuntimeStatus()', 'catalog must disclose whether machine payments are active');
forbidText(catalog, 'withX402Json', 'catalog must remain free for discovery');

requireText(paid, 'resolveLicensableAsset(tokenId)', 'paid endpoint must validate asset eligibility before payment challenge');
requireText(paid, 'withX402Json(request', 'paid endpoint must use the reviewed x402 settlement flow');
requireText(paid, 'amountAtomic: aiLicensePriceAtomic()', 'paid endpoint must charge the configured per-use license price');
requireText(paid, 'buildSingleUseMachineLicense', 'paid endpoint must return the single-use license receipt');
forbidText(paid, 'sendTransaction', 'paid endpoint must never directly submit an NFT transaction');
forbidText(paid, 'PRIVATE_KEY', 'paid endpoint must never read wallet private keys');

requireText(page, 'Your NFT can earn', 'public licensing storefront must explain the product');
requireText(page, '/api/licenses/use', 'storefront must publish the machine-use endpoint');
requireText(page, 'one machine-use unit', 'storefront must disclose per-use licensing');
requireText(page, "x402.configured?'LIVE':'NEEDS CONFIG'", 'storefront must never pretend x402 is live when it is not configured');

requireText(manifest, '/api/licenses/catalog', 'machine manifest must expose the public license catalog');
requireText(manifest, '/api/licenses/use', 'machine manifest must expose the paid machine-use license endpoint');
requireText(openapi, "'/api/licenses/catalog'", 'OpenAPI must document the public license catalog');
requireText(openapi, "'/api/licenses/use'", 'OpenAPI must document the paid machine-use license endpoint');

console.log('AI licensing V1 safety checks passed.');
