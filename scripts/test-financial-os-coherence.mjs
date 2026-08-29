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
const integrationsPage = fs.readFileSync(new URL('../app/admin/integrations/page.js', import.meta.url), 'utf8');
const integrationsApi = fs.readFileSync(new URL('../app/api/admin/integrations/status/route.ts', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
const vaultLayout = fs.readFileSync(new URL('../app/vault/layout.js', import.meta.url), 'utf8');
const realEstate = fs.readFileSync(new URL('../app/real-estate/page.js', import.meta.url), 'utf8');
const productTruthDocs = fs.readFileSync(new URL('../docs/UNIFIED_PROPERTY_MONEY_VAULT.md', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');

for (const label of ['Home', 'World', 'Create', 'Vault', 'More']) {
  assert.match(productMap, new RegExp(`label: '${label}'`), `global product dock should include ${label}`);
}
assert.match(productMap, /SIMPLE_PROPERTY_DOCK/, 'simple property product should have a dedicated consumer dock');
for (const label of ['Home', 'Create', '\\$1\\.99', 'Vault', 'Rented', 'World']) {
  assert.match(productMap, new RegExp(`label: '${label}'`), `simple property dock should include ${label}`);
}
for (const status of ['LIVE DIGITAL', 'DEMO', 'PARTNER REQUIRED', 'TITLE REQUIRED']) {
  assert.match(productMap, new RegExp(status), `canonical product map should define ${status}`);
}
assert.match(productMap, /PRODUCT_STATUS/);
assert.match(productMap, /APP_SECTIONS/);
for (const route of ['/property', '/vault/earth', '/geo', '/studio', '/capture', '/receipt', '/avatar', '/room', '/trade', '/marketplace', '/ai', '/ai-licensing', '/hunt', '/real-estate/reits', '/vault/income', '/real-estate/acquire', '/vault/properties/claim', '/forge/mainnet', '/admin/integrations']) {
  assert.ok(productMap.includes(`'${route}'`), `canonical product map should organize ${route}`);
}
assert.match(productMap, /APP_USER_PREFIXES[\s\S]*'\/admin'/, 'owner routes should keep the global app shell');
assert.match(productMap, /isOrganizedUserRoute/);
assert.match(productMap, /isSimplePropertyRoute/);
assert.match(productMap, /dockItemForPath/);

assert.match(nav, /APP_DOCK/);
assert.match(nav, /SIMPLE_PROPERTY_DOCK/);
assert.match(nav, /Voxel Vault primary navigation/);
assert.match(nav, /isOrganizedUserRoute/);
assert.match(nav, /isSimplePropertyRoute/);
assert.match(nav, /safe-area-inset-bottom/);
assert.match(nav, /if \(pathname === '\/property'\) return null;/, 'the property maker should not render a redundant fixed dock');
assert.doesNotMatch(nav, /FINANCIAL_PREFIXES|financialRoute/, 'global app shell should not be restricted to finance routes');
assert.match(layout, /FinancialOSNav/);
assert.match(layout, /AppCommandCenter/);
assert.match(layout, /spatial-os-interactions\.css/);
assert.match(layout, /3D Property \+ Digital Assets/);
assert.doesNotMatch(layout, /Spatial Asset OS/, 'public metadata should no longer market Voxel Vault as an OS');
assert.doesNotMatch(vaultLayout, /VaultPortalNav/);

assert.match(interactions, /--vv-tap-min:\s*44px/, 'coarse-pointer controls should keep an iPhone-friendly minimum target');
assert.match(interactions, /@media \(pointer: coarse\)/, 'shared interactions should adapt to touch devices');
assert.match(interactions, /:focus-visible/, 'keyboard focus must stay visible across the app shell');
assert.match(interactions, /prefers-reduced-motion: reduce/, 'shared shell must respect reduced motion');
assert.match(interactions, /-webkit-text-size-adjust:\s*100%/, 'iPhone text resizing should remain stable');

assert.match(commandCenter, /APP_DOCK, APP_SECTIONS/, 'command center should index the canonical product map');
assert.match(commandCenter, /metaKey \|\| event\.ctrlKey/, 'command center should support desktop keyboard invocation');
assert.match(commandCenter, /event\.key === '\/'/, 'command center should support fast slash invocation outside text fields');
assert.match(commandCenter, /safe-area-inset-bottom/, 'command center trigger must respect iPhone safe area');
assert.match(commandCenter, /!isSimplePropertyRoute\(pathname\)/, 'advanced search must disappear from the simple property routes');
assert.doesNotMatch(commandCenter, /fetch\(|method:\s*['"]POST['"]|wallet\.send|eth_sendTransaction|checkout\.sessions\.create/, 'command center must remain pure navigation');

// Root Home must explain one simple, accurate product before exposing advanced finance concepts.
assert.match(rootHome, /LIVE DIGITAL PROPERTY EXPERIENCE/);
assert.match(rootHome, /Turn a real place into/);
assert.match(rootHome, /a digital voxel/);
assert.match(rootHome, /CREATE A VOXEL/);
assert.match(rootHome, /START → SIGN IN/);
assert.match(rootHome, /PHOTO/);
assert.match(rootHome, /VOXEL/);
assert.match(rootHome, /3D MAP/);
assert.match(rootHome, /WORLD/);
assert.match(rootHome, /COLLECT/);
assert.match(rootHome, /No Meshy credits or generation checkout are required for creation/);
assert.match(rootHome, /A wallet is optional/);
assert.match(rootHome, /does not buy the house, land, deed, rent, equity, or investment rights/);
assert.match(rootHome, /LIVE DIGITAL/);
assert.match(rootHome, /DEMO/);
assert.match(rootHome, /PARTNER REQUIRED/);
assert.match(rootHome, /TITLE REQUIRED/);
assert.match(rootHome, /not itself a bank, broker, exchange, custodian, or deed registry/);
assert.match(rootHome, /href="\/more"/, 'advanced tools must remain deliberately reachable');
assert.doesNotMatch(rootHome, /BUY PIECE|BUY WHOLE|BUY A PIECE|BUY THE WHOLE THING/, 'unverified physical-property purchase execution must stay out of the consumer front door');
assert.doesNotMatch(rootHome, /PROPERTY · CASH · CRYPTO · NFT|Your money,|Financial OS/i, 'homepage must not imply a live all-in-one bank/broker product');
assert.doesNotMatch(rootHome, /RealEstatePlatformPage/, 'root home must not alias the advanced real-estate page');

// The capability component remains safe even though it is outside the consumer front door.
assert.match(homeCapabilities, /\/api\/world-atlas\/capabilities/, 'capability strip must use the safe public readiness endpoint wherever surfaced');
for (const label of ['WORLD DATA', 'OPEN STREET', 'MESHY 7', 'MARKET FEEDS']) assert.match(homeCapabilities, new RegExp(label));
assert.match(homeCapabilities, /READY · MANUAL/, 'Meshy readiness must remain explicitly manual');
assert.match(homeCapabilities, /no auto-spend/, 'capabilities must explain that Meshy does not spend credits automatically');
assert.match(homeCapabilities, /Readiness is configuration status, not a promise of market inventory, legal ownership, investment availability or AI-generation rights/);
assert.match(homeCapabilities, /No API keys or secret values are exposed here/);
assert.doesNotMatch(homeCapabilities, /process\.env|MESHY_API_KEY|BRIDGE_ACCESS_TOKEN|DOMAIN_CLIENT_SECRET/, 'client capability strip must never reference raw secrets');
assert.match(capabilitiesApi, /automaticGeneration:\s*false/, 'server capability contract must keep Meshy automatic generation disabled');
assert.match(capabilitiesApi, /Boolean\(process\.env\.MESHY_API_KEY\?\.trim\(\)\)/, 'Meshy readiness may expose only a boolean');

assert.match(more, /EVERYTHING, CLEARLY LABELED/);
assert.match(more, /Know what works now/);
assert.match(more, /PRODUCT_STATUS/);
assert.match(more, /APP_SECTIONS/);
assert.match(more, /ONE RULE/);
assert.match(more, /never becomes a deed/);

assert.match(integrationsApi, /requireVoxelVaultAdmin/, 'integration status must be owner-authenticated');
assert.match(integrationsApi, /MESHY_API_KEY/);
assert.match(integrationsApi, /STRIPE_SECRET_KEY/);
assert.match(integrationsApi, /BRIDGE_DATASET_ID/);
assert.match(integrationsApi, /DOMAIN_CLIENT_ID/);
assert.match(integrationsApi, /DINARI_API_KEY_ID/);
assert.match(integrationsApi, /ALGORAND_INDEXER_BASE_URL/);
assert.match(integrationsApi, /CDP_API_KEY_ID/);
assert.match(integrationsApi, /secretsReturned:\s*false/);
assert.match(integrationsApi, /valuesReturned:\s*false/);
assert.doesNotMatch(integrationsApi, /return process\.env\[[^\]]+\]/, 'integration API must never return raw env values');
assert.match(integrationsPage, /OWNER · INTEGRATIONS CENTER/);
assert.match(integrationsPage, /getSupabaseBrowserAsync/);
assert.match(integrationsPage, /\/api\/admin\/integrations\/status/);
assert.match(integrationsPage, /SIGN IN WITH GOOGLE/);

// Real-estate area must use explicit status boundaries instead of Financial OS branding.
assert.match(realEstate, /Real estate,/);
assert.match(realEstate, /without pretending/);
assert.match(realEstate, /LIVE DIGITAL/);
assert.match(realEstate, /DEMO/);
assert.match(realEstate, /PARTNER REQUIRED/);
assert.match(realEstate, /TITLE REQUIRED/);
assert.match(realEstate, /Map ≠ collectible ≠ investment ≠ deed/);
assert.match(realEstate, /Voxel Vault is not itself a bank, broker, exchange, custodian, or deed registry/);
assert.doesNotMatch(realEstate, /FINANCIAL OS|Your money, made spatial|Spatial financial home/i);
assert.doesNotMatch(realEstate, /guaranteed returns|risk[- ]free|guaranteed profit|guaranteed yield/i);
assert.doesNotMatch(realEstate, /token is (?:the )?deed|blockchain deed/i);

assert.match(productTruthDocs, /3D is the interface\. Evidence is the authority\./);
for (const status of ['LIVE DIGITAL', 'DEMO', 'PARTNER REQUIRED', 'TITLE REQUIRED']) assert.match(productTruthDocs, new RegExp(status));
assert.match(productTruthDocs, /not itself a bank|Avoid implying Voxel Vault itself is a:/i);
assert.match(readme, /3D property and digital-asset app/);
assert.match(readme, /LIVE DIGITAL/);
assert.match(readme, /DEMO/);
assert.match(readme, /PARTNER REQUIRED/);
assert.match(readme, /TITLE REQUIRED/);
assert.match(readme, /not itself a bank, broker, exchange, custodian, escrow service, or deed registry/i);
assert.doesNotMatch(readme, /legally linked blockchain ownership platform/i);

console.log('Voxel Vault condensed product truth + app shell + real-estate status regression tests passed');
