import fs from 'node:fs';
import assert from 'node:assert/strict';

const nav = fs.readFileSync(new URL('../app/components/FinancialOSNav.js', import.meta.url), 'utf8');
const commandCenter = fs.readFileSync(new URL('../app/components/AppCommandCenter.js', import.meta.url), 'utf8');
const homeCapabilities = fs.readFileSync(new URL('../app/components/HomeCapabilityStrip.js', import.meta.url), 'utf8');
const capabilitiesApi = fs.readFileSync(new URL('../app/api/world-atlas/capabilities/route.ts', import.meta.url), 'utf8');
const productMap = fs.readFileSync(new URL('../lib/product-map.js', import.meta.url), 'utf8');
const interactions = fs.readFileSync(new URL('../app/spatial-os-interactions.css', import.meta.url), 'utf8');
const rootHome = fs.readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');
const more = fs.readFileSync(new URL('../app/more/page.js', import.meta.url), 'utf8');
const slice = fs.readFileSync(new URL('../app/geo/slice/page.js', import.meta.url), 'utf8');
const integrationsPage = fs.readFileSync(new URL('../app/admin/integrations/page.js', import.meta.url), 'utf8');
const integrationsApi = fs.readFileSync(new URL('../app/api/admin/integrations/status/route.ts', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
const vaultLayout = fs.readFileSync(new URL('../app/vault/layout.js', import.meta.url), 'utf8');
const realEstate = fs.readFileSync(new URL('../app/real-estate/page.js', import.meta.url), 'utf8');
const truthDocs = fs.readFileSync(new URL('../docs/UNIFIED_PROPERTY_MONEY_VAULT.md', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');

// One consumer navigation everywhere: Home -> Create -> World -> Vault -> More.
for (const label of ['Home', 'Create', 'World', 'Vault', 'More']) {
  assert.match(productMap, new RegExp(`label: '${label}'`), `canonical product dock should include ${label}`);
}
assert.match(productMap, /SIMPLE_PROPERTY_DOCK/);
assert.doesNotMatch(productMap.split('export const APP_DOCK')[0], /label: '\$1\.99'|label: 'Rented'|label: 'Add'/);
assert.match(productMap, /APP_SECTIONS/);
for (const route of ['/property', '/vault/earth', '/geo', '/studio', '/capture', '/receipt', '/avatar', '/room', '/trade', '/marketplace', '/ai', '/ai-licensing', '/hunt', '/real-estate/reits', '/vault/income', '/real-estate/acquire', '/vault/properties/claim', '/forge/mainnet', '/admin/integrations']) assert.ok(productMap.includes(`'${route}'`));
assert.match(productMap, /Authorized photo → \$4\.99 digital creation → local voxel/);
assert.match(productMap, /badge: '\$4\.99 DIGITAL'/);
assert.match(productMap, /\$1\.99 Property Sandbox/);
assert.match(productMap, /fake demo balances only/i);
assert.match(productMap, /No real funds or property rights move/);
assert.match(productMap, /badge: 'DEMO'/);
assert.match(productMap, /badge: 'PARTNER'/);
assert.match(productMap, /badge: 'TITLE'/);
assert.match(productMap, /APP_USER_PREFIXES[\s\S]*'\/admin'/);
assert.match(productMap, /isOrganizedUserRoute/);
assert.match(productMap, /isSimplePropertyRoute/);
assert.match(productMap, /dockItemForPath/);

assert.match(nav, /APP_DOCK/);
assert.match(nav, /SIMPLE_PROPERTY_DOCK/);
assert.match(nav, /Voxel Vault primary navigation/);
assert.match(nav, /safe-area-inset-bottom/);
assert.doesNotMatch(nav, /FINANCIAL_PREFIXES|financialRoute/);
assert.match(layout, /FinancialOSNav/);
assert.match(layout, /AppCommandCenter/);
assert.match(layout, /spatial-os-interactions\.css/);
assert.match(layout, /Your 3D Asset Vault/);
assert.match(layout, /3D Property \+ Digital Assets/);
assert.doesNotMatch(vaultLayout, /financial OS/i);
assert.doesNotMatch(vaultLayout, /VaultPortalNav/);

assert.match(interactions, /--vv-tap-min:\s*44px/);
assert.match(interactions, /@media \(pointer: coarse\)/);
assert.match(interactions, /:focus-visible/);
assert.match(interactions, /prefers-reduced-motion: reduce/);
assert.match(interactions, /-webkit-text-size-adjust:\s*100%/);

assert.match(commandCenter, /APP_DOCK, APP_SECTIONS/);
assert.match(commandCenter, /metaKey \|\| event\.ctrlKey/);
assert.match(commandCenter, /event\.key === '\/'/);
assert.match(commandCenter, /safe-area-inset-bottom/);
assert.match(commandCenter, /!isSimplePropertyRoute\(pathname\)/);
assert.match(commandCenter, /never automatically spends money, mints an NFT, or starts a paid 3D generation/);
assert.doesNotMatch(commandCenter, /fetch\(|method:\s*['"]POST['"]|wallet\.send|eth_sendTransaction|checkout\.sessions\.create/);

// Upload-first flow must disclose the real $4.99 price without implying Meshy or wallet dependence.
assert.match(rootHome, /START → SIGN IN \+ UPLOAD PHOTO/);
assert.match(rootHome, /href="\/property"/);
assert.match(rootHome, /Upload a picture\./);
assert.match(rootHome, /After sign-in and your explicit creation checkout \(\$4\.99\)/);
assert.match(rootHome, /Creation is \$4\.99/);
assert.match(rootHome, /VOXELPOP CREATE/);
assert.match(rootHome, /<strong>\$4\.99<\/strong>/);
for (const label of ['UPLOAD', '\$4\.99', 'CREATING', '3D', 'MAP', 'READY']) assert.match(rootHome, new RegExp(`<b>${label}<\\/b>`));
assert.match(rootHome, /Payment, collection and minting remain explicit actions/);
assert.match(rootHome, /No wallet required to create/i);
assert.match(rootHome, /No Meshy credits/i);
assert.match(rootHome, /does not buy the physical property/i);
assert.match(rootHome, /deed\/title, rent, occupancy, or investment rights/);
assert.match(rootHome, /not itself a bank, broker, exchange, custodian, escrow service, or deed registry/);
assert.match(rootHome, /href="\/more"/);
assert.doesNotMatch(rootHome, /YOUR 3D MONEY \+ ASSET WORLD|PROPERTY · CASH · CRYPTO · NFT|TRY THE \$1\.99 SLICE/);
assert.doesNotMatch(rootHome, /BUY PIECE|BUY WHOLE|BUY A PIECE|BUY THE WHOLE THING/);

// $1.99 remains a pure refillable sandbox, never a faux bank/wallet.
assert.match(slice, /PROPERTY SLICE · SANDBOX/);
assert.match(slice, /DEMO BALANCE · NOT MONEY/);
assert.match(slice, /Refill demo credit/);
assert.match(slice, /Free test credit · no payment · no account balance/);
assert.match(slice, /Simulation only · no checkout · no wallet · no ownership/);
assert.match(slice, /no real funds, deed, equity, security, rent rights, or NFT moved/);
assert.doesNotMatch(slice, /useWalletIdentity|Connect wallet|Crypto estimated value|NFT estimated value|Make the NFT useful|PROPERTY · USD · CRYPTO · NFT/);

assert.match(homeCapabilities, /\/api\/world-atlas\/capabilities/);
for (const label of ['WORLD DATA', 'OPEN STREET', 'MESHY 7', 'MARKET FEEDS']) assert.match(homeCapabilities, new RegExp(label));
assert.match(homeCapabilities, /READY · MANUAL/);
assert.match(homeCapabilities, /no auto-spend/);
assert.match(homeCapabilities, /Readiness is configuration status, not a promise of market inventory, legal ownership, investment availability or AI-generation rights/);
assert.match(homeCapabilities, /No API keys or secret values are exposed here/);
assert.doesNotMatch(homeCapabilities, /process\.env|MESHY_API_KEY|BRIDGE_ACCESS_TOKEN|DOMAIN_CLIENT_SECRET/);
assert.match(capabilitiesApi, /automaticGeneration:\s*false/);

assert.match(more, /Everything, without the clutter/i);
assert.match(more, /APP_SECTIONS/);
assert.match(more, /PRODUCT TRUTH RULE/);
assert.match(more, /Explore real places, create 3D assets, manage your Vault/i);

assert.match(integrationsApi, /requireVoxelVaultAdmin/);
assert.match(integrationsApi, /MESHY_API_KEY/);
assert.match(integrationsApi, /STRIPE_SECRET_KEY/);
assert.match(integrationsApi, /secretsReturned:\s*false/);
assert.match(integrationsApi, /valuesReturned:\s*false/);
assert.match(integrationsPage, /OWNER · INTEGRATIONS CENTER/);
assert.match(integrationsPage, /SIGN IN WITH GOOGLE/);

// Real-estate uses four clear states rather than bank-like Financial OS positioning.
for (const state of ['LIVE DIGITAL', 'DEMO', 'PARTNER REQUIRED', 'TITLE REQUIRED']) assert.match(realEstate, new RegExp(state));
assert.match(realEstate, /Real estate,/);
assert.match(realEstate, /without pretending/);
assert.match(realEstate, /Map ≠ collectible ≠ investment ≠ deed/);
assert.match(realEstate, /Demo data only/);
assert.match(realEstate, /Live investing is locked/);
assert.match(realEstate, /\/real-estate\/property\//);
assert.match(realEstate, /Voxel Vault is not itself a bank, broker, exchange, custodian, escrow service, or deed registry/);
assert.doesNotMatch(realEstate, /FINANCIAL OS|Your money, made spatial|Spatial financial home/i);
assert.doesNotMatch(realEstate, /guaranteed returns|risk[- ]free|guaranteed profit|guaranteed yield/i);
assert.doesNotMatch(realEstate, /token is (?:the )?deed|blockchain deed/i);

assert.match(truthDocs, /3D is the interface\. Evidence is the authority\./);
assert.match(truthDocs, /\$4\.99 payment is for one digital VoxelPop creation/);
assert.match(truthDocs, /does not require Meshy credits/);
assert.match(truthDocs, /optional mapped digital-collectible purchase is a separate transaction/);
assert.match(truthDocs, /fake demo credit/);
assert.match(readme, /3D property and digital-asset app/);
assert.match(readme, /pay \*\*\$4\.99\*\* for one VoxelPop digital creation/);
assert.match(readme, /without Meshy credits/);
assert.match(readme, /separate optional collectible checkout/i);
assert.match(readme, /not itself a bank, broker, exchange, custodian, escrow service, or deed registry/i);
assert.doesNotMatch(readme, /legally linked blockchain ownership platform/i);

console.log('Voxel Vault $4.99 paid upload-first journey + refillable pure sandbox + partner/title separation checks passed');
