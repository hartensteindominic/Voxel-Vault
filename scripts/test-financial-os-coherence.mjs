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
const home = fs.readFileSync(new URL('../app/real-estate/page.js', import.meta.url), 'utf8');

// One canonical consumer map remains available across the wider app, while the
// VoxelPop front door and creator deliberately use a smaller focused header.
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
assert.match(productMap, /Authorized house photo → \$4\.99 → 3D voxel photo → approval → movable 3D voxel → save or optional mint/, 'property creator directory entry must match the current paid voxel-photo-before-model sequence');
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
assert.match(nav, /pathname === '\/' \|\| pathname === '\/property'/, 'Home and the paid creator must not stack the bottom dock under their focused header');
assert.match(nav, /FinancialOSNav\.module\.css/, 'consumer dock should use its responsive stylesheet');
assert.match(navCss, /safe-area-inset-bottom/, 'consumer dock must respect the iPhone safe area');
assert.match(navCss, /@media\(max-width:720px\)/, 'consumer dock must stay mobile-only when desktop top navigation is present');
assert.doesNotMatch(nav, /FINANCIAL_PREFIXES|financialRoute/, 'global app shell should not be restricted to finance-only routes');
assert.match(layout, /FinancialOSNav/);
assert.match(layout, /AppCommandCenter/);
assert.match(layout, /spatial-os-interactions\.css/);
assert.match(layout, /Turn a House Photo into a 3D Voxel Photo/, 'public metadata must describe the focused shipping VoxelPop product');
assert.match(layout, /Source photo stays on your device; minting is optional/, 'public metadata must preserve the device-local and optional-mint boundaries');
assert.doesNotMatch(layout, /Real Property, Made Spatial|Your 3D Asset Vault|digital-twin pilot/i, 'public metadata must not revive older broad property/vault positioning');
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

// The consumer Home is intentionally concise: product proof, one paid CTA,
// one no-login sample, the actual photo -> 3D -> voxel -> optional NFT order,
// and a visible digital-only rights boundary. Advanced property/financial tooling stays off it.
assert.match(rootHome, /VOXELPOP · PHOTO → 3D → VOXEL → NFT/, 'root Home must state the centered product sequence');
assert.match(rootHome, /Start VoxelPop · \$4\.99/, 'root Home must keep one clear paid creation CTA and price');
assert.match(rootHome, /Try 3D sample · no login/, 'root Home must expose a no-login product sample');
assert.match(rootHome, /href="\/demo"/, 'root Home must link to the public sample');
assert.match(rootHome, /href="\/property"/, 'root Home must route creation into the maker');
assert.match(rootHome, /3D preview[\s\S]*movable 3D voxel/i, 'root Home must keep the 3D review before the separate movable model');
assert.match(rootHome, /NFT optional/, 'minting must remain explicitly downstream and optional');
assert.match(rootHome, /No wallet until mint/, 'wallet must remain outside the creation flow until optional minting');
assert.match(rootHome, /VOXELPOP OUTPUT/, 'root Home must explain the useful outputs without restoring dense product clutter');
assert.match(rootHome, /3D preview/, 'root Home must name the intermediate 3D review output');
assert.match(rootHome, /Movable 3D voxel/, 'root Home must name the separate final interactive model');
assert.match(rootHome, /Optional NFT/, 'root Home must name minting as an optional output');
assert.match(rootHome, /VoxelPop is a digital creation product\./, 'root Home must identify the product as digital');
assert.match(rootHome, /does not create ownership, deed\/title, rent, occupancy, investment, appreciation, or other rights in a physical property/i, 'root Home must keep the digital-only physical-property boundary visible');
assert.match(rootHome, /HomeProductPreview/, 'root Home should prove the product with the production visual stages rather than a decorative CSS house');
assert.doesNotMatch(rootHome, /START → SIGN IN \+ UPLOAD PHOTO|TRY THE \$1\.99 SLICE|YOUR 3D MONEY \+ ASSET WORLD|PROPERTY · CASH · CRYPTO · NFT/i, 'stale funnel, banking, and sandbox-heavy language must stay off the front door');
assert.doesNotMatch(rootHome, /BUY PIECE|BUY WHOLE|BUY A PIECE|BUY THE WHOLE THING|guaranteed returns|guaranteed yield|risk[- ]free/i, 'unverified physical-property purchase or return claims must stay out of the consumer front door');
assert.doesNotMatch(rootHome, /RealEstatePlatformPage/, 'root home must not alias an older real-estate subsystem');

// The $1.99 comparison remains a pure sandbox, not a faux bank/wallet surface.
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

// Extras keeps advanced and optional tools available without making them part of
// the normal $4.99 creation funnel.
assert.match(more, /Keep VoxelPop simple\.[\s\S]*Open extras only when needed\./i, 'Extras must explain its deliberately secondary role');
assert.match(more, /main product is Create → 3D voxel photo → movable voxel → Vault/i, 'Extras must state the focused core product journey');
assert.match(more, /Making a house voxel\?/, 'Extras must lead users back to the core creation task');
assert.match(more, /3D voxel photo[\s\S]*separate movable model/i, 'Extras must preserve voxel-photo approval before the movable model');
assert.match(more, /Create VoxelPop · \$4\.99 →/, 'Extras must link directly back to the paid creator');
assert.match(more, /See free sample →/, 'Extras must keep the public sample reachable');
assert.match(more, /Open Vault →/, 'Extras must keep saved creations reachable');
assert.match(more, /World, minting, and the tools below are optional/, 'Extras must keep World and minting outside the core funnel');
assert.match(more, /OTHER DIGITAL TOOLS/, 'secondary digital products must remain collapsed away from the core flow');
assert.match(more, /OWNER \/ PROVIDER TOOLS/, 'provider and owner rails must stay visibly advanced');
assert.match(more, /not part of the \$4\.99 VoxelPop product/i, 'advanced provider tooling must stay explicitly separate from the paid VoxelPop product');
assert.match(more, /A VoxelPop model or NFT is a digital creation/, 'Extras must preserve the digital-not-deed boundary');

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

// Detailed real-estate stays advanced, status-driven, and fail-closed without finance-dashboard theater.
assert.match(home, /Explore · sandbox · invest through providers · own through title/);
assert.match(home, /Real estate,[\s\S]*without pretending\./);
assert.match(home, /Try \$1\.99 property math/);
assert.match(home, /LIVE DIGITAL/);
assert.match(home, /DEMO/);
assert.match(home, /PARTNER REQUIRED/);
assert.match(home, /TITLE REQUIRED/);
assert.match(home, /Map ≠ collectible ≠ investment ≠ deed/);
assert.match(home, /Live investing is locked until provider requirements are satisfied/);
assert.match(home, /Demo data only · no real purchase/);
assert.match(home, /recorded title/i);
assert.match(home, /Voxel Vault is not itself a bank, broker, exchange, custodian, escrow service, or deed registry/);
assert.doesNotMatch(home, /guaranteed returns|risk[- ]free|guaranteed profit|guaranteed yield/i);
assert.doesNotMatch(home, /token is (?:the )?deed|blockchain deed/i);

console.log('Voxel Vault checks passed: focused photo -> $4.99 -> 3D review -> movable voxel -> Vault/optional mint, with optional extras, sandbox boundaries, and fail-closed advanced rails kept distinct.');
