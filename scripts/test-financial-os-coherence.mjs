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

// One consumer navigation everywhere: Home -> Create -> World -> Vault -> More.
for (const label of ['Home', 'Create', 'World', 'Vault', 'More']) {
  assert.match(productMap, new RegExp(`label: '${label}'`), `canonical product dock should include ${label}`);
}
assert.match(productMap, /SIMPLE_PROPERTY_DOCK/, 'simple property routes should use the canonical consumer dock');
assert.doesNotMatch(productMap.split('export const APP_DOCK')[0], /label: '\$1\.99'|label: 'Rented'|label: 'Add'/, 'demo/rental shortcuts must not clutter the primary dock');
assert.match(productMap, /APP_SECTIONS/);
for (const route of ['/property', '/vault/earth', '/geo', '/studio', '/capture', '/receipt', '/avatar', '/room', '/trade', '/marketplace', '/ai', '/ai-licensing', '/hunt', '/real-estate/reits', '/vault/income', '/real-estate/acquire', '/vault/properties/claim', '/forge/mainnet', '/admin/integrations']) {
  assert.ok(productMap.includes(`'${route}'`), `canonical product map should organize ${route}`);
}
assert.match(productMap, /Authorized photo → \$4\.99 digital creation → local voxel/, 'property directory must expose the actual creation fee and local engine');
assert.match(productMap, /\$1\.99 Property Demo/, 'the tiny property comparison must remain explicitly a demo under More');
assert.match(productMap, /fake demo balances only/i, 'demo description must identify fake balances');
assert.match(productMap, /No real funds or property rights move/, 'demo description must preserve the no-rights boundary');
assert.match(productMap, /badge: '\$4\.99 DIGITAL'/, 'creation must be labeled as paid digital');
assert.match(productMap, /badge: 'DEMO'/, 'sandbox must be labeled demo');
assert.match(productMap, /badge: 'PARTNER'/, 'investment execution must be partner-gated');
assert.match(productMap, /badge: 'TITLE'/, 'real ownership must be title-gated');
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
assert.doesNotMatch(nav, /FINANCIAL_PREFIXES|financialRoute/, 'global app shell should not be restricted to finance-only routes');
assert.match(layout, /FinancialOSNav/);
assert.match(layout, /AppCommandCenter/);
assert.match(layout, /spatial-os-interactions\.css/);
assert.match(layout, /3D Property \+ Digital Assets/, 'public metadata should describe the actual product');
assert.doesNotMatch(vaultLayout, /financial OS/i, 'Vault metadata should not market the product as a financial OS');
assert.doesNotMatch(vaultLayout, /VaultPortalNav/);

assert.match(interactions, /--vv-tap-min:\s*44px/, 'coarse-pointer controls should keep an iPhone-friendly minimum target');
assert.match(interactions, /@media \(pointer: coarse\)/, 'shared interactions should adapt to touch devices');
assert.match(interactions, /:focus-visible/, 'keyboard focus must stay visible across the app shell');
assert.match(interactions, /prefers-reduced-motion: reduce/, 'shared shell must respect reduced motion');
assert.match(interactions, /-webkit-text-size-adjust:\s*100%/, 'iPhone text resizing should remain stable');
assert.doesNotMatch(interactions, /background:\s*#(?:000|05060b)|color-scheme:/i, 'shared interaction polish must not force one visual theme onto every subsystem');

assert.match(commandCenter, /APP_DOCK, APP_SECTIONS/, 'tool finder should index the canonical product map instead of maintaining another route list');
assert.match(commandCenter, /metaKey \|\| event\.ctrlKey/, 'tool finder should support desktop keyboard invocation');
assert.match(commandCenter, /event\.key === '\/'/, 'tool finder should support fast slash invocation outside text fields');
assert.match(commandCenter, /safe-area-inset-bottom/, 'tool finder trigger must respect iPhone safe area');
assert.match(commandCenter, /!isSimplePropertyRoute\(pathname\)/, 'advanced tool search must disappear from the simple core routes');
assert.match(commandCenter, /never automatically spends money, mints an NFT, or starts a paid 3D generation/, 'tool finder must disclose its non-execution boundary');
assert.doesNotMatch(commandCenter, /fetch\(|method:\s*['"]POST['"]|wallet\.send|eth_sendTransaction|checkout\.sessions\.create/, 'tool finder must remain pure navigation and never execute side effects');

// Consumer Home describes the paid local property flow, not a free or Meshy-dependent flow.
assert.match(rootHome, /START → SIGN IN \+ CREATE/, 'root Home should make the account-first transition explicit');
assert.match(rootHome, /href="\/property"/, 'root Home should route the primary CTA into the account-gated maker');
assert.match(rootHome, /Photo → \$4\.99 → voxel → mapped 3D\./, 'root Home should disclose payment inside the actual local-preview/map sequence');
assert.match(rootHome, /Creation costs \$4\.99/, 'root Home must state the digital creation fee');
assert.match(rootHome, /VOXELPOP CREATE/);
assert.match(rootHome, /<strong>\$4\.99<\/strong>/, 'hero visual must not turn no-Meshy into a free-price claim');
assert.match(rootHome, /<b>PHOTO<\/b>/, 'root Home should put the authorized photo first');
assert.match(rootHome, /<b>\$4\.99<\/b>/, 'root Home should show the paid unlock before local generation');
assert.match(rootHome, /<b>VOXEL<\/b>/, 'root Home should expose the local VoxelPop stage');
assert.match(rootHome, /<b>3D<\/b>/, 'root Home should expose mapped interactive 3D');
assert.match(rootHome, /<b>WORLD<\/b>/, 'root Home should preview the asset in World before optional collection');
assert.match(rootHome, /OPTIONAL COLLECT \+ VAULT/, 'root Home should make digital collection optional');
assert.match(rootHome, /source photo stays on-device/i, 'root Home should explain device-local photo handling');
assert.match(rootHome, /A wallet is optional/i, 'wallet must remain optional until a downstream wallet action');
assert.match(rootHome, /No Meshy credits are required/i, 'paid local creation should accurately state zero Meshy dependency');
assert.match(rootHome, /separate optional action/i, 'collection/minting must stay separate from the creation purchase');
assert.match(rootHome, /does not buy the physical property/i, 'root Home must distinguish the voxel from physical real estate');
assert.match(rootHome, /deed\/title, rent, occupancy, or investment rights/, 'root Home must preserve digital versus legal-rights truth');
assert.match(rootHome, /not itself a bank, broker, exchange, custodian, escrow service, or deed registry/);
assert.match(rootHome, /href="\/more"/, 'optional and advanced tools must remain deliberately reachable');
assert.doesNotMatch(rootHome, /YOUR 3D MONEY \+ ASSET WORLD|PROPERTY · CASH · CRYPTO · NFT|TRY THE \$1\.99 SLICE/, 'bank-like and demo-heavy language must not dominate the front door');
assert.doesNotMatch(rootHome, /BUY PIECE|BUY WHOLE|BUY A PIECE|BUY THE WHOLE THING/, 'unverified physical-property purchase execution must stay out of the consumer front door');
assert.doesNotMatch(rootHome, /RealEstatePlatformPage/, 'root home must not alias an older real-estate subsystem');

// Capability status remains safe even though it is not on the consumer front door.
assert.match(homeCapabilities, /\/api\/world-atlas\/capabilities/, 'capability strip must use the safe public readiness endpoint wherever it is surfaced');
for (const label of ['WORLD DATA', 'OPEN STREET', 'MESHY 7', 'MARKET FEEDS']) assert.match(homeCapabilities, new RegExp(label));
assert.match(homeCapabilities, /READY · MANUAL/, 'Meshy readiness must remain explicitly manual');
assert.match(homeCapabilities, /no auto-spend/, 'capabilities must explain that Meshy does not spend credits automatically');
assert.match(homeCapabilities, /Readiness is configuration status, not a promise of market inventory, legal ownership, investment availability or AI-generation rights/, 'readiness must preserve truth boundaries');
assert.match(homeCapabilities, /No API keys or secret values are exposed here/, 'capability display must state the secret-value boundary');
assert.doesNotMatch(homeCapabilities, /process\.env|MESHY_API_KEY|BRIDGE_ACCESS_TOKEN|DOMAIN_CLIENT_SECRET/, 'client capability strip must never reference raw secret environment variables');
assert.match(capabilitiesApi, /automaticGeneration:\s*false/, 'server capability contract must keep Meshy automatic generation disabled');
assert.match(capabilitiesApi, /Boolean\(process\.env\.MESHY_API_KEY\?\.trim\(\)\)/, 'Meshy readiness may expose only a boolean');

assert.match(more, /Everything, without the clutter/i);
assert.match(more, /APP_SECTIONS/);
assert.match(more, /PRODUCT TRUTH RULE/);
assert.match(more, /Explore real places, create 3D assets, manage your Vault/i);

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

// Detailed real-estate uses four explicit states instead of Financial OS positioning.
assert.match(realEstate, /Real estate,/);
assert.match(realEstate, /without pretending/);
for (const state of ['LIVE DIGITAL', 'DEMO', 'PARTNER REQUIRED', 'TITLE REQUIRED']) assert.match(realEstate, new RegExp(state));
assert.match(realEstate, /Map ≠ collectible ≠ investment ≠ deed/);
assert.match(realEstate, /Voxel Vault is not itself a bank, broker, exchange, custodian, escrow service, or deed registry/);
assert.doesNotMatch(realEstate, /FINANCIAL OS|Your money, made spatial|Spatial financial home/i);
assert.doesNotMatch(realEstate, /guaranteed returns|risk[- ]free|guaranteed profit|guaranteed yield/i);
assert.doesNotMatch(realEstate, /token is (?:the )?deed|blockchain deed/i);

assert.match(productTruthDocs, /3D is the interface\. Evidence is the authority\./);
assert.match(productTruthDocs, /\$4\.99 payment is for one digital VoxelPop creation/);
assert.match(productTruthDocs, /does not require Meshy credits/);
assert.match(productTruthDocs, /optional mapped digital-collectible purchase is a separate transaction/);
assert.match(productTruthDocs, /Do not imply Voxel Vault itself is a:/);

assert.match(readme, /3D property and digital-asset app/);
assert.match(readme, /pay \*\*\$4\.99\*\* for one VoxelPop digital creation/);
assert.match(readme, /source photo on the device/);
assert.match(readme, /without Meshy credits/);
assert.match(readme, /separate optional collectible checkout/i);
assert.match(readme, /not itself a bank, broker, exchange, custodian, escrow service, or deed registry/i);
assert.doesNotMatch(readme, /legally linked blockchain ownership platform/i);

console.log('Voxel Vault condensed paid-local Create -> World -> Vault journey + demo/provider/title separation checks passed');
