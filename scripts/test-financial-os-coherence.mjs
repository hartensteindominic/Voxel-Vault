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
const home = fs.readFileSync(new URL('../app/real-estate/page.js', import.meta.url), 'utf8');

for (const label of ['Home', 'Create', 'World', 'Vault', 'More']) {
  assert.match(productMap, new RegExp(`label: '${label}'`), `global product dock should include ${label}`);
}
assert.match(productMap, /SIMPLE_PROPERTY_DOCK/, 'simple property product should have a dedicated consumer dock');
for (const label of ['Home', 'Create', 'World', 'Vault']) {
  assert.match(productMap, new RegExp(`label: '${label}'`), `simple property dock should include ${label}`);
}
assert.doesNotMatch(productMap, /label: 'Add'|label: '\$1\.99'|label: 'Rented'/, 'simple dock should not mix sandbox or rental concepts into the primary four-item navigation');
assert.match(productMap, /APP_SECTIONS/);
for (const route of ['/property', '/world', '/vault/earth', '/geo', '/studio', '/marketplace', '/real-estate/reits', '/vault/income', '/real-estate/acquire', '/vault/properties/claim', '/forge/mainnet', '/admin/integrations']) {
  assert.ok(productMap.includes(`'${route}'`), `canonical product map should organize ${route}`);
}
assert.match(productMap, /badge: 'SANDBOX'/, 'sandbox financial concepts must be labeled in the canonical product map');
assert.match(productMap, /badge: 'PROVIDER-GATED'/, 'regulated investment execution must be visibly provider-gated');
assert.match(productMap, /badge: 'OBSERVED ONLY'/, 'income records must distinguish observed history from promised yield');
assert.match(productMap, /Digital possession is not deed ownership/, 'digital twins must not imply real-property title');
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
assert.match(nav, /if \(pathname === '\/property'\) return null;/, 'the bare property maker should not render a redundant fixed dock');
assert.doesNotMatch(nav, /FINANCIAL_PREFIXES|financialRoute/, 'global app shell should not be restricted to a finance-only prefix list');
assert.match(layout, /FinancialOSNav/);
assert.match(layout, /AppCommandCenter/);
assert.match(layout, /spatial-os-interactions\.css/);
assert.match(layout, /Spatial Asset OS/, 'architecture metadata may remain without putting jargon on the simple consumer home');
assert.doesNotMatch(vaultLayout, /VaultPortalNav/);

assert.match(interactions, /--vv-tap-min:\s*44px/, 'coarse-pointer controls should keep an iPhone-friendly minimum target');
assert.match(interactions, /@media \(pointer: coarse\)/, 'shared interactions should adapt to touch devices');
assert.match(interactions, /:focus-visible/, 'keyboard focus must stay visible across the app shell');
assert.match(interactions, /prefers-reduced-motion: reduce/, 'shared shell must respect reduced motion');
assert.match(interactions, /-webkit-text-size-adjust:\s*100%/, 'iPhone text resizing should remain stable');
assert.doesNotMatch(interactions, /background:\s*#(?:000|05060b)|color-scheme:/i, 'shared interaction polish must not force one visual theme onto every subsystem');

assert.match(commandCenter, /APP_DOCK, APP_SECTIONS/, 'command center should index the canonical product map instead of maintaining another route list');
assert.match(commandCenter, /metaKey \|\| event\.ctrlKey/, 'command center should support desktop keyboard invocation');
assert.match(commandCenter, /event\.key === '\/'/, 'command center should support fast slash invocation outside text fields');
assert.match(commandCenter, /safe-area-inset-bottom/, 'command center trigger must respect iPhone safe area');
assert.match(commandCenter, /!isSimplePropertyRoute\(pathname\)/, 'advanced command search must disappear from the simple Home, Create, World and Vault routes');
assert.match(commandCenter, /Search is navigation only\. It never executes trades, mints, Meshy generations or property actions\./, 'command center must disclose its non-execution boundary');
assert.doesNotMatch(commandCenter, /fetch\(|method:\s*['"]POST['"]|wallet\.send|eth_sendTransaction|checkout\.sessions\.create/, 'command center must remain pure navigation and never execute side effects');

// Consumer Home is intentionally much smaller than the underlying Spatial Asset OS.
assert.match(rootHome, /START → SIGN IN/, 'root Home should make the account-first transition explicit');
assert.match(rootHome, /href="\/property"/, 'root Home should route the primary CTA into the account-gated maker');
assert.match(rootHome, /PHOTO → VOXEL PREVIEW → 3D MAP → WORLD/, 'root Home must describe the actual zero-credit map-backed property flow');
assert.match(rootHome, /<b>PHOTO<\/b>/, 'root Home should put the authorized photo first');
assert.match(rootHome, /<b>VOXEL<\/b>/, 'root Home should expose the local VoxelPop preview');
assert.match(rootHome, /<b>3D<\/b>/, 'root Home should expose the source-backed 3D map stage');
assert.match(rootHome, /<b>WORLD<\/b>/, 'root Home should expose My World before optional collection');
assert.match(rootHome, /COLLECT \+ VAULT/, 'root Home should make digital collection and Vault delivery the end of the loop');
assert.match(rootHome, /Creation itself is free/i, 'root Home should distinguish free creation from optional collection');
assert.match(rootHome, /A wallet is optional/i, 'wallet must remain optional until a user chooses the downstream mint path');
assert.match(rootHome, /does not buy the physical property/i, 'root Home must distinguish collecting a voxel from buying physical property');
assert.match(rootHome, /deed\/title, rent, occupancy, or investment rights/, 'root Home must preserve model versus legal-rights truth');
assert.match(rootHome, /href="\/more"/, 'advanced tools must remain deliberately reachable');
assert.match(rootHome, /\$1\.99 Slice[\s\S]*sandbox/i, 'home must label the $1.99 feature as a sandbox');
assert.match(rootHome, /Real investing[\s\S]*provider-gated/i, 'home must label real investing as provider-gated');
assert.doesNotMatch(rootHome, /PROPERTY · CASH · CRYPTO · NFT/, 'consumer home must not market four legally different categories as one undifferentiated product');
assert.doesNotMatch(rootHome, /builds the first 3D|applies the VoxelPop look|creates the final movable voxel/i, 'consumer home must not describe the retired Meshy pipeline');
assert.doesNotMatch(rootHome, /BUY PIECE|BUY WHOLE|BUY A PIECE|BUY THE WHOLE THING/, 'unverified physical-property purchase execution must stay out of the consumer front door');
assert.doesNotMatch(rootHome, /RealEstatePlatformPage/, 'root home must not alias an older real-estate subsystem');

// $1.99 is a clean sandbox, not a faux bank/wallet surface.
assert.match(slice, /PROPERTY SLICE · SANDBOX/);
assert.match(slice, /DEMO BALANCE · NOT MONEY/);
assert.match(slice, /Simulation only · no checkout · no wallet · no ownership/);
assert.match(slice, /no real funds, deed, equity, security, rent rights, or NFT moved/);
assert.doesNotMatch(slice, /useWalletIdentity|Connect wallet|Crypto estimated value|NFT estimated value|Make the NFT useful|PROPERTY · USD · CRYPTO · NFT/, 'slice sandbox must not visually imitate live wallet, crypto, NFT or banking execution');

// Capability component and endpoint remain safe even though they are advanced surfaces.
assert.match(homeCapabilities, /\/api\/world-atlas\/capabilities/, 'capability strip must use the safe public readiness endpoint wherever it is surfaced');
for (const label of ['WORLD DATA', 'OPEN STREET', 'MESHY 7', 'MARKET FEEDS']) assert.match(homeCapabilities, new RegExp(label));
assert.match(homeCapabilities, /READY · MANUAL/, 'Meshy readiness must remain explicitly manual');
assert.match(homeCapabilities, /no auto-spend/, 'capabilities must explain that Meshy does not spend credits automatically');
assert.match(homeCapabilities, /Readiness is configuration status, not a promise of market inventory, legal ownership, investment availability or AI-generation rights/, 'readiness must preserve truth boundaries');
assert.match(homeCapabilities, /No API keys or secret values are exposed here/, 'capability display must state the secret-value boundary');
assert.doesNotMatch(homeCapabilities, /process\.env|MESHY_API_KEY|BRIDGE_ACCESS_TOKEN|DOMAIN_CLIENT_SECRET/, 'client capability strip must never reference raw secret environment variables');
assert.match(capabilitiesApi, /automaticGeneration:\s*false/, 'server capability contract must keep Meshy automatic generation disabled');
assert.match(capabilitiesApi, /Boolean\(process\.env\.MESHY_API_KEY\?\.trim\(\)\)/, 'Meshy readiness may expose only a boolean');

assert.match(more, /ONLY WHEN YOU NEED IT/);
assert.match(more, /APP_SECTIONS/);
assert.match(more, /No blurred promises/);
assert.match(more, /live, digital-only, sandboxed, evidence-based, owner-only, or dependent on an approved external provider/);
assert.match(more, /A digital voxel is a digital asset/);

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

// Detailed real-estate area remains an advanced fail-closed subsystem.
assert.match(home, /Explore → invest → verify → observe → own/);
assert.match(home, /Your money,/);
assert.match(home, /provider-backed investment assets/i);
assert.match(home, /observed income/i);
assert.match(home, /recorded title/i);
assert.match(home, /Provider-gated/i);
assert.match(home, /Live investing is locked/);
assert.match(home, /Demo data only/);
assert.match(home, /Direct property closes through normal title systems/);
assert.match(home, /Every number should know where it came from/);
assert.match(home, /Start with access\. Build toward ownership\./);
assert.match(home, /Fail-closed for real money/);
assert.doesNotMatch(home, /guaranteed returns|risk[- ]free|guaranteed profit|guaranteed yield/i);
assert.doesNotMatch(home, /token is (?:the )?deed|blockchain deed/i);

console.log('Voxel Vault condensed product hierarchy + zero-credit property journey + unambiguous sandbox + advanced provider gates coherence tests passed');
