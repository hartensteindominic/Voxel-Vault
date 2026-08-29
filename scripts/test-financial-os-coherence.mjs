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
assert.match(productMap, /Authorized photo → \$4\.99 textured 3D preview → approval → movable voxel/, 'property creator directory entry must disclose the paid preview-before-voxel creation sequence');
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
assert.match(nav, /safe-area-inset-bottom/);
assert.doesNotMatch(nav, /FINANCIAL_PREFIXES|financialRoute/, 'global app shell should not be restricted to finance-only routes');
assert.match(layout, /FinancialOSNav/);
assert.match(layout, /AppCommandCenter/);
assert.match(layout, /spatial-os-interactions\.css/);
assert.match(layout, /Your 3D Asset Vault/, 'public metadata should describe the understandable product rather than internal architecture jargon');
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

// Consumer Home describes the actual demo-first, account-gated, paid preview-before-voxel flow.
assert.match(rootHome, /START → SIGN IN \+ UPLOAD PHOTO/, 'root Home should accurately disclose sign-in before the upload picker');
assert.match(rootHome, /href="\/demo"/, 'root Home should let visitors inspect real 3D interaction before sign-in');
assert.match(rootHome, /href="\/property"/, 'root Home should route creation into the account-gated maker');
assert.match(rootHome, /Upload a picture\./, 'root Home should keep one photo as the obvious creation source');
assert.match(rootHome, /After sign-in and the \$4\.99 creation checkout/, 'root Home should disclose the exact paid creation gate without implying hidden charging');
assert.match(rootHome, /One VoxelPop creation costs \$4\.99/i, 'root Home must disclose the generation price');
assert.match(rootHome, /source photo stays on your device/i, 'root Home must explain the device-local source-photo boundary');
assert.match(rootHome, /without Meshy credits/i, 'root Home must accurately describe the local generation engine');
assert.match(rootHome, /Optional Collect later is a separate digital-item purchase/i, 'root Home must distinguish generation from the later collectible checkout');
assert.match(rootHome, /HomeProductPreview/, 'root Home should prove the product with the production visual stages rather than a decorative CSS house');
assert.match(rootHome, /<b>PHOTO<\/b>/, 'root Home should show the photo stage');
assert.match(rootHome, /<b>\$4\.99<\/b>/, 'root Home should disclose the paid creation stage in the flow');
assert.match(rootHome, /<b>3D PREVIEW<\/b>/, 'root Home should expose the preview before voxelization');
assert.match(rootHome, /<b>APPROVE<\/b>/, 'root Home should require explicit preview approval');
assert.match(rootHome, /<b>VOXEL<\/b>/, 'root Home should expose the separate movable voxel stage');
assert.match(rootHome, /<b>OPTIONAL MINT<\/b>/, 'root Home should make minting explicitly optional');
assert.match(rootHome, /href="\/world"/, 'source-backed map context should remain reachable after creation');
assert.match(rootHome, /href="\/vault"/, 'finished creations should have a clear Vault destination');
assert.match(rootHome, /Collection and minting remain separate optional actions/, 'paid and blockchain actions must never appear automatic');
assert.match(rootHome, /no wallet is required to create/i, 'wallet must remain optional for creation');
assert.match(rootHome, /Voxel Vault is not a bank/i, 'root Home must not imply bank status');
assert.match(rootHome, /VoxelPop item is not a deed/i, 'root Home must distinguish a digital item from title');
assert.match(rootHome, /\$1\.99 property comparison is a sandbox/i, 'root Home must label the property slice as sandbox');
assert.match(rootHome, /financial products remain provider-gated/i, 'root Home must label regulated financial tools as provider-gated');
assert.match(rootHome, /href="\/more"/, 'optional and advanced tools must remain deliberately reachable');
assert.doesNotMatch(rootHome, /YOUR 3D MONEY \+ ASSET WORLD|PROPERTY · CASH · CRYPTO · NFT|TRY THE \$1\.99 SLICE/, 'bank-like and sandbox-heavy language must not dominate the front door');
assert.doesNotMatch(rootHome, /BUY PIECE|BUY WHOLE|BUY A PIECE|BUY THE WHOLE THING|guaranteed returns|guaranteed yield|risk[- ]free/i, 'unverified physical-property purchase or return claims must stay out of the consumer front door');
assert.doesNotMatch(rootHome, /RealEstatePlatformPage/, 'root home must not alias an older real-estate subsystem');

// The $1.99 comparison is intentionally a pure sandbox, not a faux bank/wallet surface.
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

// More keeps the core app short while surfacing useful property actions first and advanced rails second.
assert.match(more, /More tools\.[\s\S]*Less confusion\./i, 'More must explain its simplified purpose');
assert.match(more, /Bought or saved a property\?/i, 'More must lead with the reusable property workflow');
assert.match(more, /3D preview → approve → 3D voxel → optional mint/i, 'More must state the actual property creation order');
assert.match(more, /Create from My Properties →/, 'More must link directly to the reusable property picker');
assert.match(more, /\$1\.99 Property Sandbox/, 'More must keep the demo property tool clearly labeled');
assert.match(more, /ADVANCED \+ PROVIDER-GATED/, 'provider and legal rails must stay visibly advanced');
assert.match(more, /A demo, NFT, investment security, lease record, and property deed are different things/, 'More must preserve the legal and financial separation');
assert.match(more, /A VoxelPop model or NFT can represent a digital creation/, 'More must preserve the digital-not-deed boundary');

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

console.log('Voxel Vault demo-first photo -> $4.99 -> 3D preview -> approve -> movable voxel -> optional World/Vault/mint + unambiguous $1.99 sandbox + fail-closed advanced rails coherence checks passed');
