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
const galacticGate = fs.readFileSync(new URL('../app/bank/GalacticBankGate.js', import.meta.url), 'utf8');
const galacticBank = fs.readFileSync(new URL('../app/bank/BankClient.js', import.meta.url), 'utf8');
const galacticEnhancements = fs.readFileSync(new URL('../app/bank/GalacticDashboardEnhancements.js', import.meta.url), 'utf8');
const galacticEnhancementCss = fs.readFileSync(new URL('../app/bank/enhancements.css', import.meta.url), 'utf8');
const propertyRoute = fs.readFileSync(new URL('../app/property/page.js', import.meta.url), 'utf8');
const property = fs.readFileSync(new URL('../app/property/PropertyStudioFlow.js', import.meta.url), 'utf8');
const propertyCss = fs.readFileSync(new URL('../app/property/PropertyStudio.module.css', import.meta.url), 'utf8');
const more = fs.readFileSync(new URL('../app/more/page.js', import.meta.url), 'utf8');
const slice = fs.readFileSync(new URL('../app/geo/slice/page.js', import.meta.url), 'utf8');
const integrationsPage = fs.readFileSync(new URL('../app/admin/integrations/page.js', import.meta.url), 'utf8');
const integrationsApi = fs.readFileSync(new URL('../app/api/admin/integrations/status/route.ts', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
const vaultLayout = fs.readFileSync(new URL('../app/vault/layout.js', import.meta.url), 'utf8');
const home = fs.readFileSync(new URL('../app/real-estate/page.js', import.meta.url), 'utf8');
const galacticHome = /GalacticBankGate/.test(rootHome);

// The wider app keeps its canonical directory for advanced surfaces, while the
// shipping front door may be Galactic Trust and the property studio remains a
// separately reachable, safety-bounded product surface.
for (const label of ['Home', 'Create', 'World', 'Vault', 'More']) {
  assert.match(productMap, new RegExp(`label: '${label}'`), `canonical product directory should include ${label}`);
}
assert.match(productMap, /SIMPLE_PROPERTY_DOCK/, 'the wider product directory can still classify simple property routes');
assert.doesNotMatch(productMap.split('export const APP_DOCK')[0], /label: '\$1\.99'|label: 'Rented'|label: 'Add'/, 'sandbox/rental shortcuts must not clutter the canonical dock');
assert.match(productMap, /APP_SECTIONS/);
for (const route of ['/property', '/vault/earth', '/geo', '/studio', '/capture', '/receipt', '/avatar', '/room', '/trade', '/marketplace', '/ai', '/ai-licensing', '/hunt', '/real-estate/reits', '/vault/income', '/real-estate/acquire', '/vault/properties/claim', '/forge/mainnet', '/admin/integrations']) {
  assert.ok(productMap.includes(`'${route}'`), `canonical product map should organize ${route}`);
}
assert.match(productMap, /\$1\.99 Property Sandbox/, 'the tiny property comparison must remain explicitly sandboxed under More');
assert.match(productMap, /No real funds or property rights move/, 'sandbox description must preserve the no-rights boundary');
assert.match(productMap, /Authorized house photo → \$4\.99 → 3D voxel photo → approval → movable 3D voxel → save or optional mint/, 'legacy product directory copy remains available for compatibility while the live creator is redesigned');
assert.match(productMap, /badge: 'PROVIDER-GATED'/, 'regulated investment tools must be visibly provider-gated');
assert.match(productMap, /A token or VoxelPop item is never the deed/, 'direct ownership path must keep title separate from the token');
assert.match(productMap, /APP_USER_PREFIXES[\s\S]*'\/admin'/, 'owner routes should keep the global app shell');
assert.match(productMap, /isOrganizedUserRoute/);
assert.match(productMap, /isSimplePropertyRoute/);
assert.match(productMap, /dockItemForPath/);

assert.match(nav, /const DOCK = \[[\s\S]*id: 'home'[\s\S]*id: 'create'[\s\S]*id: 'vault'/, 'mobile primary navigation must be Home, Create, and Vault only');
assert.doesNotMatch(nav, /id: 'world'|id: 'more'/, 'World and More must not compete in the primary mobile dock');
assert.match(nav, /VoxelPop primary navigation/);
assert.match(nav, /isOrganizedUserRoute/);
assert.match(nav, /usesPropertyStudioNavigation/, 'the legacy dock must not stack under the redesigned property studio, mint, or Inventory pages');
assert.match(nav, /pathname\.startsWith\('\/property\/'\)/, 'all property studio subpages must use their own consistent navigation');
assert.match(nav, /pathname\.startsWith\('\/vault\/property-drafts\/'\)/, 'Inventory detail pages must use the property studio navigation system');
assert.match(nav, /FinancialOSNav\.module\.css/, 'consumer dock should use its responsive stylesheet');
assert.match(navCss, /safe-area-inset-bottom/, 'consumer dock must respect the iPhone safe area');
assert.match(navCss, /@media\(max-width:720px\)/, 'consumer dock must stay mobile-only when desktop top navigation is present');
assert.doesNotMatch(nav, /FINANCIAL_PREFIXES|financialRoute/, 'global app shell should not be restricted to finance-only routes');

if (galacticHome) {
  assert.match(layout, /WalletIdentityProvider/, 'Galactic Trust layout must keep wallet identity context available to legacy/internal routes');
  assert.match(layout, /Galactic Trust \| Financial App/, 'public metadata must identify Galactic Trust as a financial app rather than a bank');
  assert.match(layout, /Galactic Trust is not a bank/, 'public metadata must preserve the nonbank boundary');
  assert.match(layout, /approved sponsor-bank program/, 'public metadata must preserve the provider-backed launch boundary');
  assert.match(layout, /themeColor: '#07103d'/, 'Galactic Trust layout must keep the approved cosmic theme color');
} else {
  assert.match(layout, /FinancialOSNav/);
  assert.match(layout, /AppCommandCenter/);
  assert.match(layout, /spatial-os-interactions\.css/);
  assert.match(layout, /Turn Property Photos into 3D Voxel Collectibles/, 'public metadata must describe the redesigned focused product');
  assert.match(layout, /save it to your Voxel Vault Inventory, and mint it when you want/i, 'public metadata must describe Inventory persistence and optional downstream minting');
  assert.doesNotMatch(layout, /Real Property, Made Spatial|Your 3D Asset Vault|digital-twin pilot/i, 'public metadata must not revive older broad property/vault positioning');
}
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

if (galacticHome) {
  assert.match(rootHome, /GalacticBankGate/, 'root Home must render Galactic Trust');
  assert.match(rootHome, /enhancements\.css/, 'root Home must load Galactic Trust interaction polish');
  assert.match(galacticGate, /Continue with Google/, 'Galactic Trust must keep Google sign-in available');
  assert.match(galacticGate, /signInWithOtp/, 'Galactic Trust must keep passwordless email sign-in available');
  assert.match(galacticGate, /Explore the Stars demo/, 'Galactic Trust must keep low-friction demo onboarding');
  assert.match(galacticGate, /financial technology product, not a bank/i, 'Galactic Trust onboarding must disclose the nonbank boundary');
  assert.match(galacticGate, /approved sponsor-bank program/i, 'Galactic Trust onboarding must keep live banking provider-gated');
  assert.match(galacticBank, /DEMO BANKING/, 'Galactic Trust dashboard must label demo banking clearly');
  assert.match(galacticBank, /No real deposits are held and no real money moves in this build\./, 'Galactic Trust dashboard must preserve the no-real-money boundary');
  assert.match(galacticEnhancements, /Deposit/, 'Galactic Trust must prioritize Deposit');
  assert.match(galacticEnhancements, /Send/, 'Galactic Trust must prioritize Send');
  assert.match(galacticEnhancements, /Swap/, 'Galactic Trust must prioritize Swap');
  assert.match(galacticEnhancements, /1W[\s\S]*1M[\s\S]*3M/, 'Galactic Trust balance must expose interactive trend ranges');
  assert.match(galacticEnhancements, /metaKey \|\| event\.ctrlKey/, 'Galactic Trust must support Cmd/Ctrl+K quick navigation');
  assert.match(galacticEnhancements, /visualViewport/, 'Galactic Trust must handle soft-keyboard viewport changes');
  assert.match(galacticEnhancements, /\/bank\/readiness/, 'Galactic Trust must surface the regulated launch status');
  assert.match(galacticEnhancementCss, /safe-area-inset-bottom/, 'Galactic Trust must respect mobile safe areas');
  assert.match(galacticEnhancementCss, /pointer:coarse/, 'Galactic Trust must adapt to coarse-pointer mobile and VR surfaces');
  assert.doesNotMatch(rootHome, /BUY PIECE|BUY WHOLE|guaranteed returns|guaranteed yield|risk[- ]free/i, 'unverified physical-property purchase or return claims must stay out of the Galactic Trust front door');
  assert.doesNotMatch(rootHome, /RealEstatePlatformPage/, 'root home must not alias an older real-estate subsystem');
} else {
  // Legacy focused-property front door checks remain valid if that product is restored later.
  assert.match(rootHome, /PROPERTY → COLLECTIBLE/, 'root Home must state the focused product');
  assert.match(rootHome, /Create a property voxel/, 'root Home must have a clear creation CTA');
  assert.match(rootHome, /href="\/property"/, 'root Home must route creation into the studio');
  assert.match(rootHome, /confirm the address/i, 'root Home must name address confirmation');
  assert.match(rootHome, /voxel image/i, 'root Home must name the voxel-preview stage');
  assert.match(rootHome, /saved to Inventory first/i, 'root Home must make automatic Inventory saving explicit');
  assert.match(rootHome, /Mint if you want|Minting optional/i, 'minting must remain explicitly downstream and optional');
  assert.match(rootHome, /This collectible is digital only\./, 'root Home must identify the product as digital');
  assert.match(rootHome, /does not create or transfer deed, title/i, 'root Home must keep the physical-property boundary visible');
  assert.doesNotMatch(rootHome, /Create mine · \$4\.99|Create · \$4\.99|Try voxel sample · no login|VOXELPOP OUTPUT|START → SIGN IN \+ UPLOAD PHOTO|TRY THE \$1\.99 SLICE|YOUR 3D MONEY \+ ASSET WORLD|PROPERTY · CASH · CRYPTO · NFT/i, 'checkout CTAs, stale funnel, banking, and sandbox-heavy language must stay off the legacy property front door');
  assert.doesNotMatch(rootHome, /BUY PIECE|BUY WHOLE|BUY A PIECE|BUY THE WHOLE THING|guaranteed returns|guaranteed yield|risk[- ]free/i, 'unverified physical-property purchase or return claims must stay out of the consumer front door');
  assert.doesNotMatch(rootHome, /RealEstatePlatformPage/, 'root home must not alias an older real-estate subsystem');
}

assert.match(propertyRoute, /PropertyStudioFlow/, 'the active /property route must use the new guided studio');
assert.match(property, /const PROGRESS = \[[\s\S]*PHOTO[\s\S]*ADDRESS[\s\S]*VOXEL[\s\S]*BUILD[\s\S]*VAULT/, 'creator must expose the five-stage property journey');
assert.match(property, /Start with one great photo\./, 'creator must begin with one obvious photo action');
assert.match(property, /Confirm the address\./, 'creator must confirm the real property before generation');
assert.match(property, /PhotoReliefModelViewer/, 'creator must build the voxel preview with real voxel geometry');
assert.match(property, /Build the 3D voxel/, 'the page-by-page experience must stop on preview until the user continues');
assert.match(property, /setStage\('build'\)/, 'the preview continue action must enter the dedicated 3D build page');
assert.doesNotMatch(property, /\/api\/property-generation\/checkout|Pay \$|Stripe/i, 'live creator must not add a per-property checkout detour');
assert.match(property, /savePropertyDraft\(finishedDraft\)/, 'finished creation must save to Inventory automatically');
assert.match(property, /Keep in Inventory/, 'finished creation must expose the saved result');
assert.match(property, /Mint this voxel/, 'minting must remain optional after the saved result');
assert.match(property, /modelUrl=\$\{encodeURIComponent\(final3d\.modelUrl\)\}/, 'the actual saved model must be handed into Mint');
assert.doesNotMatch(property, /PropertyWorldMap|Add to My World/, 'World/map controls must stay outside the core creator');
assert.match(propertyCss, /#6f42f5/i, 'the property journey must use the new purple design system');
assert.match(propertyCss, /#c9ff55/i, 'the property journey must use the new playful lime accent');
assert.match(propertyCss, /safe-area-inset-bottom/, 'the shared studio UI must respect iPhone safe areas');

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

// Extras keeps advanced and optional tools available without making them part of the live studio.
assert.match(more, /Keep VoxelPop simple\.[\s\S]*Open extras only when needed\./i, 'Extras must explain its deliberately secondary role');
assert.match(more, /main product is Create → 3D voxel photo → movable voxel → Vault/i, 'Extras must retain its compatibility description');
assert.match(more, /Making a house voxel\?/, 'Extras must lead users back to the core creation task');
assert.match(more, /Create VoxelPop · \$4\.99 →/, 'legacy Extras paid path remains available separately from live /property');
assert.match(more, /See free sample →/, 'Extras must keep the public sample reachable');
assert.match(more, /Open Vault →/, 'Extras must keep saved creations reachable');
assert.match(more, /World, minting, and the tools below are optional/, 'Extras must keep World and minting outside the core funnel');
assert.match(more, /OWNER \/ PROVIDER TOOLS/, 'provider and owner rails must stay visibly advanced');
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

console.log(`Voxel Vault checks passed: ${galacticHome ? 'Galactic Trust nonbank financial-app front door, provider-gated banking, interactive quick actions, command navigation, mobile/VR behavior, and visible trust boundaries' : 'focused Home'} plus the guided five-stage property studio, sandbox boundaries, and fail-closed advanced rails stay distinct.`);