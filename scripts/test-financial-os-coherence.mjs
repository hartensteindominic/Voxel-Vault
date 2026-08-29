import fs from 'node:fs';
import assert from 'node:assert/strict';

const nav = fs.readFileSync(new URL('../app/components/FinancialOSNav.js', import.meta.url), 'utf8');
const navCss = fs.readFileSync(new URL('../app/components/FinancialOSNav.module.css', import.meta.url), 'utf8');
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
const realEstateHome = fs.readFileSync(new URL('../app/real-estate/page.js', import.meta.url), 'utf8');

for (const label of ['Home', 'Create', 'World', 'Vault', 'More']) {
  assert.match(productMap, new RegExp(`label: '${label}'`), `canonical product map should include ${label}`);
}
assert.match(productMap, /SIMPLE_PROPERTY_DOCK/, 'simple property routes should use the canonical consumer dock');
assert.match(productMap, /APP_SECTIONS/, 'advanced routes should remain organized outside the core creation flow');
assert.match(productMap, /Authorized photo → \$4\.99 3D voxel photo → approval → movable voxel → optional World\/map\/mint\./, 'property directory copy must preserve voxel-photo-before-movable-voxel ordering');
assert.match(productMap, /\$1\.99 Property Sandbox/, 'the property comparison must stay explicitly sandboxed');
assert.match(productMap, /No real funds or property rights move/, 'sandbox description must preserve the no-rights boundary');
assert.match(productMap, /badge: 'PROVIDER-GATED'/, 'regulated investment tools must remain visibly provider-gated');
assert.match(productMap, /A token or VoxelPop item is never the deed/, 'direct ownership path must keep title separate from the token');

assert.match(nav, /APP_DOCK/, 'mobile navigation must use the canonical app dock');
assert.match(nav, /SIMPLE_PROPERTY_DOCK/, 'core VoxelPop routes must use the simple dock');
assert.match(nav, /SIMPLE_PROPERTY_DOCK\.filter\(\(item\) => item\.id !== 'more'\)/, 'core mobile navigation must stay condensed to Home, Create, World, and Vault');
assert.match(nav, /isOrganizedUserRoute/, 'navigation should render only on organized product routes');
assert.match(navCss, /safe-area-inset-bottom/, 'consumer dock must respect the iPhone safe area');
assert.match(navCss, /@media\(max-width:720px\)/, 'consumer dock must stay mobile-only when desktop top navigation is present');
assert.doesNotMatch(nav, /FINANCIAL_PREFIXES|financialRoute/, 'global app shell must not be restricted to finance-only routes');

assert.match(layout, /FinancialOSNav/, 'root layout must include the shared mobile dock');
assert.match(layout, /AppCommandCenter/, 'root layout must keep advanced tool discovery available off the simple routes');
assert.match(layout, /spatial-os-interactions\.css/, 'shared interaction accessibility must remain loaded');
assert.match(layout, /Turn a House Photo into a 3D Voxel Photo/, 'public metadata must describe the focused current VoxelPop product');
assert.match(layout, /3D voxel photo/, 'metadata must distinguish the reviewable voxel-photo stage');
assert.doesNotMatch(vaultLayout, /VaultPortalNav/, 'Vault must not restore a competing legacy navigation shell');

assert.match(interactions, /--vv-tap-min:\s*44px/, 'coarse-pointer controls should keep an iPhone-friendly minimum target');
assert.match(interactions, /@media \(pointer: coarse\)/, 'shared interactions should adapt to touch devices');
assert.match(interactions, /:focus-visible/, 'keyboard focus must stay visible across the app shell');
assert.match(interactions, /prefers-reduced-motion: reduce/, 'shared shell must respect reduced motion');
assert.match(interactions, /-webkit-text-size-adjust:\s*100%/, 'iPhone text resizing should remain stable');
assert.doesNotMatch(interactions, /background:\s*#(?:000|05060b)|color-scheme:/i, 'shared interaction helpers must not force a dark visual theme onto every subsystem');

assert.match(commandCenter, /APP_DOCK, APP_SECTIONS/, 'tool finder should index the canonical product map instead of maintaining another route list');
assert.match(commandCenter, /metaKey \|\| event\.ctrlKey/, 'tool finder should support desktop keyboard invocation');
assert.match(commandCenter, /event\.key === '\/'/, 'tool finder should support slash invocation outside text fields');
assert.match(commandCenter, /safe-area-inset-bottom/, 'tool finder trigger must respect iPhone safe area');
assert.match(commandCenter, /!isSimplePropertyRoute\(pathname\)/, 'advanced tool search must disappear from the simple core routes');
assert.match(commandCenter, /never automatically spends money, mints an NFT, or starts a paid 3D generation/, 'tool finder must disclose its non-execution boundary');
assert.doesNotMatch(commandCenter, /fetch\(|method:\s*['"]POST['"]|wallet\.send|eth_sendTransaction|checkout\.sessions\.create/, 'tool finder must remain pure navigation and never execute side effects');

assert.match(rootHome, /ONE HOUSE PHOTO · \$4\.99/, 'root Home must present one photo and one clear creation price');
assert.match(rootHome, /Create my VoxelPop · \$4\.99/, 'root Home must keep one clear paid creation CTA');
assert.match(rootHome, /Try the sample · no login/, 'root Home must let visitors inspect the product before sign-in or payment');
assert.match(rootHome, /Photo stays on your device/i, 'root Home must explain the device-local source-photo boundary');
assert.match(rootHome, /No wallet to create/i, 'wallet must remain optional for creation');
assert.match(rootHome, /3D voxel photo/i, 'root Home must expose the voxel-photo review stage');
assert.match(rootHome, /movable 3D voxel/i, 'root Home must expose the separate movable voxel stage');
assert.match(rootHome, /SAVE \/ OPTIONAL MINT/, 'root Home must keep minting downstream and optional');
assert.match(rootHome, /HomeProductPreview/, 'root Home must prove the flow with the production visual stages');
assert.match(rootHome, /does not create ownership or financial rights in a physical property/i, 'root Home must preserve the physical-property boundary');
assert.doesNotMatch(rootHome, /YOUR 3D MONEY \+ ASSET WORLD|PROPERTY · CASH · CRYPTO · NFT|TRY THE \$1\.99 SLICE/, 'bank-like and sandbox-heavy language must not dominate the front door');
assert.doesNotMatch(rootHome, /BUY PIECE|BUY WHOLE|BUY A PIECE|BUY THE WHOLE THING|guaranteed returns|guaranteed yield|risk[- ]free/i, 'unverified physical-property purchase or return claims must stay out of the consumer front door');
assert.doesNotMatch(rootHome, /RealEstatePlatformPage/, 'root Home must not alias the advanced real-estate subsystem');

assert.match(slice, /PROPERTY SLICE · SANDBOX/, 'slice page must identify itself as a sandbox before the demo interaction');
assert.match(slice, /DEMO BALANCE · NOT MONEY/, 'demo balance must never look like settled cash');
assert.match(slice, /Simulation only · no checkout · no wallet · no ownership/, 'slice CTA must disclose that it cannot execute a real transaction');
assert.match(slice, /no real funds, deed, equity, security, rent rights, or NFT moved/, 'demo completion must preserve the full legal/financial boundary');
assert.doesNotMatch(slice, /useWalletIdentity|Connect wallet|Crypto estimated value|NFT estimated value|Make the NFT useful|PROPERTY · USD · CRYPTO · NFT/, 'the property sandbox must not imitate live wallet, crypto, NFT, or banking execution');

assert.match(homeCapabilities, /\/api\/world-atlas\/capabilities/, 'capability strip must use the safe public readiness endpoint wherever surfaced');
for (const label of ['WORLD DATA', 'OPEN STREET', 'MESHY 7', 'MARKET FEEDS']) assert.match(homeCapabilities, new RegExp(label));
assert.match(homeCapabilities, /READY · MANUAL/, 'Meshy readiness must remain explicitly manual');
assert.match(homeCapabilities, /no auto-spend/, 'capabilities must explain that Meshy does not spend credits automatically');
assert.match(homeCapabilities, /No API keys or secret values are exposed here/, 'capability display must state the secret-value boundary');
assert.doesNotMatch(homeCapabilities, /process\.env|MESHY_API_KEY|BRIDGE_ACCESS_TOKEN|DOMAIN_CLIENT_SECRET/, 'client capability strip must never reference raw secret environment variables');
assert.match(capabilitiesApi, /automaticGeneration:\s*false/, 'server capability contract must keep Meshy automatic generation disabled');
assert.match(capabilitiesApi, /Boolean\(process\.env\.MESHY_API_KEY\?\.trim\(\)\)/, 'Meshy readiness may expose only a boolean');

assert.match(more, /Keep VoxelPop simple\./i, 'Extras page must state its simplified purpose');
assert.match(more, /The main product is Create → 3D voxel photo → movable voxel → Vault/i, 'Extras page must preserve the core product order');
assert.match(more, /Create VoxelPop · \$4\.99 →/, 'Extras page must route back to the main paid creator');
assert.match(more, /See free sample →/, 'Extras page must keep the no-login proof reachable');
assert.match(more, /OWNER \/ PROVIDER TOOLS/, 'provider and owner rails must remain visibly advanced');
assert.match(more, /not part of the \$4\.99 VoxelPop product/i, 'regulated/provider tools must remain separate from the creation purchase');
assert.match(more, /A VoxelPop model or NFT is a digital creation/, 'Extras page must preserve the digital-not-deed boundary');

assert.match(integrationsApi, /requireVoxelVaultAdmin/, 'integration status must be owner-authenticated');
for (const key of ['MESHY_API_KEY','STRIPE_SECRET_KEY','BRIDGE_DATASET_ID','DOMAIN_CLIENT_ID','DINARI_API_KEY_ID','ALGORAND_INDEXER_BASE_URL','CDP_API_KEY_ID']) assert.match(integrationsApi, new RegExp(key));
assert.match(integrationsApi, /secretsReturned:\s*false/, 'integration API must never claim to return secrets');
assert.match(integrationsApi, /valuesReturned:\s*false/, 'integration API must never claim to return raw values');
assert.doesNotMatch(integrationsApi, /return process\.env\[[^\]]+\]/, 'integration API must never return raw environment values');
assert.match(integrationsPage, /OWNER · INTEGRATIONS CENTER/, 'owner integration page must identify its restricted purpose');
assert.match(integrationsPage, /getSupabaseBrowserAsync/, 'owner integration page must use authenticated account state');
assert.match(integrationsPage, /\/api\/admin\/integrations\/status/, 'owner integration page must call the protected status endpoint');
assert.match(integrationsPage, /SIGN IN WITH GOOGLE/, 'owner integration page must expose its sign-in gate');

assert.match(realEstateHome, /Explore · sandbox · invest through providers · own through title/);
assert.match(realEstateHome, /Map ≠ collectible ≠ investment ≠ deed/);
assert.match(realEstateHome, /Live investing is locked until provider requirements are satisfied/);
assert.match(realEstateHome, /Demo data only · no real purchase/);
assert.match(realEstateHome, /Voxel Vault is not itself a bank, broker, exchange, custodian, escrow service, or deed registry/);
assert.doesNotMatch(realEstateHome, /guaranteed returns|risk[- ]free|guaranteed profit|guaranteed yield/i);
assert.doesNotMatch(realEstateHome, /token is (?:the )?deed|blockchain deed/i);

console.log('Voxel Vault coherence checks passed: focused photo -> $4.99 -> faithful 3D voxel photo -> approval -> movable voxel -> optional save/mint, with condensed mobile navigation, sandbox separation, and fail-closed advanced rails.');
