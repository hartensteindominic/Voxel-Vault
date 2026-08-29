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

for (const label of ['Home', 'Create', 'World', 'Vault', 'More']) assert.match(productMap, new RegExp(`label: '${label}'`));
assert.match(productMap, /SIMPLE_PROPERTY_DOCK/);
assert.doesNotMatch(productMap.split('export const APP_DOCK')[0], /label: '\$1\.99'|label: 'Rented'|label: 'Add'/);
assert.match(productMap, /Authorized photo → \$4\.99 digital creation → local voxel/);
assert.match(productMap, /\$1\.99 Property Demo/);
assert.match(productMap, /fake demo balances only/i);
assert.match(productMap, /No real funds or property rights move/);
assert.match(productMap, /badge: '\$4\.99 DIGITAL'/);
assert.match(productMap, /badge: 'DEMO'/);
assert.match(productMap, /badge: 'PARTNER'/);
assert.match(productMap, /badge: 'TITLE'/);
for (const route of ['/property', '/vault/earth', '/geo', '/studio', '/marketplace', '/real-estate/reits', '/vault/income', '/real-estate/acquire', '/vault/properties/claim', '/admin/integrations']) assert.ok(productMap.includes(`'${route}'`));

assert.match(nav, /APP_DOCK/);
assert.match(nav, /SIMPLE_PROPERTY_DOCK/);
assert.match(nav, /Voxel Vault primary navigation/);
assert.match(nav, /safe-area-inset-bottom/);
assert.match(layout, /3D Property \+ Digital Assets/);
assert.doesNotMatch(vaultLayout, /financial OS/i);
assert.doesNotMatch(vaultLayout, /VaultPortalNav/);
assert.match(interactions, /--vv-tap-min:\s*44px/);
assert.match(interactions, /@media \(pointer: coarse\)/);
assert.match(interactions, /:focus-visible/);
assert.match(interactions, /prefers-reduced-motion: reduce/);
assert.match(interactions, /-webkit-text-size-adjust:\s*100%/);

assert.match(commandCenter, /APP_DOCK, APP_SECTIONS/);
assert.match(commandCenter, /!isSimplePropertyRoute\(pathname\)/);
assert.match(commandCenter, /never automatically spends money, mints an NFT, or starts a paid 3D generation/);
assert.doesNotMatch(commandCenter, /fetch\(|method:\s*['"]POST['"]|wallet\.send|eth_sendTransaction|checkout\.sessions\.create/);

assert.match(rootHome, /START → SIGN IN \+ UPLOAD PHOTO/);
assert.match(rootHome, /Upload a picture\./);
assert.match(rootHome, /\$4\.99 digital creation checkout/);
assert.match(rootHome, /Creation is \$4\.99/);
assert.match(rootHome, /VOXELPOP CREATE/);
assert.match(rootHome, /<strong>\$4\.99<\/strong>/);
assert.match(rootHome, /<b>UPLOAD<\/b>/);
assert.match(rootHome, /<b>\$4\.99<\/b>/);
assert.match(rootHome, /<b>CREATING<\/b>/);
assert.match(rootHome, /<b>3D<\/b>/);
assert.match(rootHome, /<b>MAP<\/b>/);
assert.match(rootHome, /<b>READY<\/b>/);
assert.match(rootHome, /source photo stays on-device/i);
assert.match(rootHome, /No wallet is required to create/i);
assert.match(rootHome, /No Meshy credits are used/i);
assert.match(rootHome, /separate optional actions/i);
assert.match(rootHome, /does not buy the physical property/i);
assert.match(rootHome, /deed\/title, rent, occupancy, or investment rights/);
assert.match(rootHome, /not itself a bank, broker, exchange, custodian, escrow service, or deed registry/);
assert.doesNotMatch(rootHome, /PROPERTY · CASH · CRYPTO · NFT|TRY THE \$1\.99 SLICE|BUY A PIECE|BUY THE WHOLE THING/);

assert.match(slice, /PROPERTY SLICE · SANDBOX/);
assert.match(slice, /DEMO BALANCE · NOT MONEY/);
assert.match(slice, /Simulation only · no checkout · no wallet · no ownership/);
assert.match(slice, /no real funds, deed, equity, security, rent rights, or NFT moved/);
assert.doesNotMatch(slice, /useWalletIdentity|Connect wallet|Crypto estimated value|NFT estimated value|Make the NFT useful|PROPERTY · USD · CRYPTO · NFT/);

assert.match(homeCapabilities, /\/api\/world-atlas\/capabilities/);
for (const label of ['WORLD DATA', 'OPEN STREET', 'MESHY 7', 'MARKET FEEDS']) assert.match(homeCapabilities, new RegExp(label));
assert.match(homeCapabilities, /READY · MANUAL/);
assert.match(homeCapabilities, /no auto-spend/);
assert.match(homeCapabilities, /No API keys or secret values are exposed here/);
assert.match(capabilitiesApi, /automaticGeneration:\s*false/);

assert.match(more, /Everything, without the clutter/i);
assert.match(more, /APP_SECTIONS/);
assert.match(more, /PRODUCT TRUTH RULE/);
assert.match(integrationsApi, /requireVoxelVaultAdmin/);
assert.match(integrationsApi, /MESHY_API_KEY/);
assert.match(integrationsApi, /STRIPE_SECRET_KEY/);
assert.match(integrationsApi, /secretsReturned:\s*false/);
assert.match(integrationsApi, /valuesReturned:\s*false/);
assert.match(integrationsPage, /OWNER · INTEGRATIONS CENTER/);
assert.match(integrationsPage, /SIGN IN WITH GOOGLE/);

for (const state of ['LIVE DIGITAL', 'DEMO', 'PARTNER REQUIRED', 'TITLE REQUIRED']) assert.match(realEstate, new RegExp(state));
assert.match(realEstate, /Real estate,/);
assert.match(realEstate, /without pretending/);
assert.match(realEstate, /Map ≠ collectible ≠ investment ≠ deed/);
assert.match(realEstate, /Voxel Vault is not itself a bank, broker, exchange, custodian, escrow service, or deed registry/);
assert.doesNotMatch(realEstate, /FINANCIAL OS|Your money, made spatial|Spatial financial home/i);
assert.doesNotMatch(realEstate, /guaranteed returns|risk[- ]free|guaranteed profit|guaranteed yield/i);

assert.match(truthDocs, /3D is the interface\. Evidence is the authority\./);
assert.match(truthDocs, /\$4\.99 payment is for one digital VoxelPop creation/);
assert.match(truthDocs, /does not require Meshy credits/);
assert.match(truthDocs, /optional mapped digital-collectible purchase is a separate transaction/);
assert.match(readme, /3D property and digital-asset app/);
assert.match(readme, /pay \*\*\$4\.99\*\* for one VoxelPop digital creation/);
assert.match(readme, /without Meshy credits/);
assert.match(readme, /separate optional collectible checkout/i);
assert.match(readme, /not itself a bank, broker, exchange, custodian, escrow service, or deed registry/i);
assert.doesNotMatch(readme, /legally linked blockchain ownership platform/i);

console.log('Voxel Vault paid upload-first journey + pure $1.99 demo + partner/title separation checks passed');
