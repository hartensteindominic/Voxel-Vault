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

// One consumer navigation everywhere: Home -> Create -> World -> Vault -> More.
for (const label of ['Home', 'Create', 'World', 'Vault', 'More']) {
  assert.match(productMap, new RegExp(`label: '${label}'`), `canonical product dock should include ${label}`);
}
assert.match(productMap, /SIMPLE_PROPERTY_DOCK/, 'simple property routes should use the canonical consumer dock');
assert.doesNotMatch(productMap.split('export const APP_DOCK')[0], /label: '\$1\.99'|label: 'Rented'|label: 'Add'/, 'sandbox/rental shortcuts must not clutter the primary dock');
assert.match(productMap, /APP_SECTIONS/);
for (const route of ['/property', '/vault/earth', '/geo', '/studio', '/capture', '/receipt', '/avatar', '/room', '/trade', '/marketplace', '/ai', '/ai-licensing', '/hunt', '/real-estate/reits', '/vault/income', '/real-estate/acquire', '/vault/properties/claim', '/forge/mainnet', '/admin/integrations']) {
  assert.ok(productMap.includes(`'${route}'`), `canonical product map should organize ${route}`);
}
assert.match(productMap, /\$1\.99 Property Sandbox/, 'the tiny property comparison must remain explicitly sandboxed under More');
assert.match(productMap, /No real funds or property rights move/, 'sandbox description must preserve the no-rights boundary');
assert.match(productMap, /Authorized photo → \$4\.99 3D voxel photo → approval → movable voxel → optional World\/map\/mint\./, 'property directory entry must preserve voxel-photo-before-movable-voxel ordering');
assert.match(productMap, /badge: 'PROVIDER-GATED'/, 'regulated investment tools must be visibly provider-gated');
assert.match(productMap, /A token or VoxelPop item is never the deed/, 'direct ownership path must keep title separate from the token');
assert.match(productMap, /APP_USER_PREFIXES[\s\S]*'\/admin'/, 'owner routes should keep the global app shell');
assert.match(productMap, /isOrganizedUserRoute/);
assert.match(productMap, /isSimplePropertyRoute/);
assert.match(productMap, /dockItemForPath/);

assert.match(nav, /APP_DOCK/);
assert.match(nav, /SIMPLE_PROPERTY_DOCK/);
assert.match(nav, /Voxel Vault primary navigation/);
assert.match(nav, /isOrganizedUserRoute/);
assert.match(nav, /isSimplePropertyRoute/);
assert.match(nav, /FinancialOSNav\.module\.css/, 'consumer dock should use its responsive stylesheet');
assert.match(navCss, /safe-area-inset-bottom/, 'consumer dock must respect the iPhone safe area');
assert.match(navCss, /@media\(max-width:720px\)/, 'consumer dock must stay mobile-only when desktop top navigation is present');
assert.doesNotMatch(nav, /FINANCIAL_PREFIXES|financialRoute/, 'global app shell should not be restricted to finance-only routes');
assert.match(layout, /FinancialOSNav/);
assert.match(layout, /AppCommandCenter/);
assert.match(layout, /spatial-os-interactions\.css/);
assert.match(layout, /Turn a House Photo into a 3D Voxel Photo/, 'public metadata should describe the current VoxelPop product');
assert.doesNotMatch(layout, /real estate digital twin|NFT vault/i, 'root metadata must not revive legacy finance/property positioning');
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

// Consumer Home: one focused VoxelPop creation path, not a finance dashboard.
assert.match(rootHome, /ONE HOUSE PHOTO · \$4\.99/, 'root Home should present one photo and one creation price');
assert.match(rootHome, /Create my VoxelPop · \$4\.99/, 'root Home must disclose the one-time creation price');
assert.match(rootHome, /Try the sample · no login/, 'root Home should let visitors inspect the product before sign-in');
assert.match(rootHome, /href="\/demo"/, 'root Home should link to the public product sample');
assert.match(rootHome, /href="\/property"/, 'root Home should route creation into the account-gated maker');
assert.match(rootHome, /Review voxel photo first/, 'root Home must make the review gate explicit');
assert.match(rootHome, /Photo stays on your device/, 'root Home must explain the device-local source-photo boundary');
assert.match(rootHome, /No wallet to create/, 'wallet must remain optional for creation');
assert.match(rootHome, /One photo\. Four clear steps\./, 'root Home should explain the creation flow without extra product clutter');
assert.match(rootHome, /Upload photo/, 'root Home should show the source-photo stage');
assert.match(rootHome, /See voxel photo/, 'root Home should show the voxel-photo review stage');
assert.match(rootHome, /Create movable voxel/, 'root Home should expose the separate movable-voxel stage');
assert.match(rootHome, /SAVE \/ OPTIONAL MINT/, 'root Home should keep minting downstream and optional');
assert.match(rootHome, /WHAT YOU GET/, 'root Home should explain the actual deliverables');
assert.match(rootHome, /3D voxel photo/, 'root Home should name the intermediate result');
assert.match(rootHome, /Movable 3D voxel/, 'root Home should name the final interactive result');
assert.match(rootHome, /Your Vault/, 'root Home should explain where the finished creation is kept');
assert.match(rootHome, /does not create ownership or financial rights in a physical property/, 'root Home must distinguish the digital item from real rights');
assert.match(rootHome, /Privacy/);
assert.match(rootHome, /Terms/);
assert.match(rootHome, /About/);
assert.doesNotMatch(rootHome, /YOUR 3D MONEY \+ ASSET WORLD|PROPERTY · CASH · CRYPTO · NFT|TRY THE \$1\.99 SLICE/, 'bank-like and sandbox-heavy language must not dominate the front door');
assert.doesNotMatch(rootHome, /BUY PIECE|BUY WHOLE|BUY A PIECE|BUY THE WHOLE THING|guaranteed returns|guaranteed yield|risk[- ]free/i, 'unverified physical-property purchase or return claims must stay out of the consumer front door');
assert.doesNotMatch(rootHome, /RealEstatePlatformPage/, 'root home must not alias an older real-estate subsystem');

// The $1.99 comparison stays a pure sandbox, never faux banking or ownership.
assert.match(slice, /PROPERTY SLICE · SANDBOX/, 'slice page must identify itself as a sandbox before the demo interaction');
assert.match(slice, /DEMO BALANCE · NOT MONEY/, 'demo balance must never look like settled cash');
assert.match(slice, /Simulation only · no checkout · no wallet · no ownership/, 'slice CTA must disclose that it cannot execute a real transaction');
assert.match(slice, /no real funds, deed, equity, security, rent rights, or NFT moved/, 'demo completion must preserve the full legal/financial boundary');
assert.doesNotMatch(slice, /useWalletIdentity|Connect wallet|Crypto estimated value|NFT estimated value|Make the NFT useful|PROPERTY · USD · CRYPTO · NFT/, 'the property sandbox must not imitate live wallet, crypto, NFT or banking execution');

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

// More keeps optional tools available without crowding Create.
assert.match(more, /Keep VoxelPop simple\./i, 'More must explain its simplified purpose');
assert.match(more, /The main product is Create → 3D voxel photo → movable voxel → Vault\./, 'More must state the current core product sequence');
assert.match(more, /Making a house voxel\?/, 'More must lead with the reusable property workflow');
assert.match(more, /review the <b>3D voxel photo<\/b> before the separate movable model is built/, 'More must preserve voxel-photo-before-model ordering');
assert.match(more, /Create VoxelPop · \$4\.99 →/, 'More must route back to the paid creator clearly');
assert.match(more, /See free sample →/, 'More must preserve a free product-proof path');
assert.match(more, /PHOTO[\s\S]*VOXEL PHOTO[\s\S]*APPROVE[\s\S]*MOVABLE VOXEL/, 'More must visualize the correct creation order');
assert.match(more, /None of these are required to create a VoxelPop/, 'optional tools must stay explicitly optional');
assert.match(more, /Provider-gated finance, title\/claim verification, and owner infrastructure are not part of the \$4\.99 VoxelPop product/, 'regulated/provider systems must remain separate from the core product');
assert.match(more, /A VoxelPop model or NFT is a digital creation/, 'More must preserve the digital-not-deed boundary');

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

// Detailed real estate stays advanced, status-driven, and fail-closed.
assert.match(realEstateHome, /Explore · sandbox · invest through providers · own through title/);
assert.match(realEstateHome, /Real estate,[\s\S]*without pretending\./);
assert.match(realEstateHome, /Try \$1\.99 property math/);
assert.match(realEstateHome, /LIVE DIGITAL/);
assert.match(realEstateHome, /DEMO/);
assert.match(realEstateHome, /PARTNER REQUIRED/);
assert.match(realEstateHome, /TITLE REQUIRED/);
assert.match(realEstateHome, /Map ≠ collectible ≠ investment ≠ deed/);
assert.match(realEstateHome, /Live investing is locked until provider requirements are satisfied/);
assert.match(realEstateHome, /Demo data only · no real purchase/);
assert.match(realEstateHome, /recorded title/i);
assert.match(realEstateHome, /Voxel Vault is not itself a bank, broker, exchange, custodian, escrow service, or deed registry/);
assert.doesNotMatch(realEstateHome, /guaranteed returns|risk[- ]free|guaranteed profit|guaranteed yield/i);
assert.doesNotMatch(realEstateHome, /token is (?:the )?deed|blockchain deed/i);

console.log('Voxel Vault coherence checks passed: focused VoxelPop home, photo -> 3D voxel photo -> movable voxel, optional mint, safe $1.99 sandbox, and fail-closed advanced rails.');
