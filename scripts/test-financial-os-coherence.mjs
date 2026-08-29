import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const nav = read('app/components/FinancialOSNav.js');
const navCss = read('app/components/FinancialOSNav.module.css');
const commandCenter = read('app/components/AppCommandCenter.js');
const homeCapabilities = read('app/components/HomeCapabilityStrip.js');
const capabilitiesApi = read('app/api/world-atlas/capabilities/route.ts');
const productMap = read('lib/product-map.js');
const interactions = read('app/spatial-os-interactions.css');
const rootHome = read('app/page.js');
const homePreview = read('app/components/HomeProductPreview.js');
const propertyRoute = read('app/property/page.js');
const property = read('app/property/HouseVoxelJourney.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const photoStart = read('app/api/property-photo-upload/route.ts');
const mintPrepare = read('app/api/property-voxel-nft/prepare/route.ts');
const more = read('app/more/page.js');
const slice = read('app/geo/slice/page.js');
const integrationsPage = read('app/admin/integrations/page.js');
const integrationsApi = read('app/api/admin/integrations/status/route.ts');
const layout = read('app/layout.js');
const vaultLayout = read('app/vault/layout.js');
const advancedRealEstate = read('app/real-estate/page.js');

// Keep the larger application organized while the shipping VoxelPop surface
// stays deliberately small and non-financial.
for (const label of ['Home', 'Create', 'World', 'Vault', 'More']) {
  assert.match(productMap, new RegExp(`label: '${label}'`), `canonical product directory should include ${label}`);
}
assert.match(productMap, /APP_SECTIONS/, 'canonical product directory remains structured');
for (const route of ['/property', '/vault/earth', '/geo', '/studio', '/capture', '/receipt', '/avatar', '/room', '/trade', '/marketplace', '/ai', '/ai-licensing', '/hunt', '/real-estate/reits', '/vault/income', '/real-estate/acquire', '/vault/properties/claim', '/forge/mainnet', '/admin/integrations']) {
  assert.ok(productMap.includes(`'${route}'`), `canonical product map should organize ${route}`);
}
assert.match(productMap, /No real funds or property rights move/, 'property sandbox must keep its no-rights boundary');
assert.match(productMap, /A token or VoxelPop item is never the deed/, 'canonical product map must separate digital items from title');
assert.match(productMap, /isOrganizedUserRoute/);
assert.match(productMap, /isSimplePropertyRoute/);

assert.match(nav, /const DOCK = \[[\s\S]*id: 'home'[\s\S]*id: 'create'[\s\S]*id: 'vault'/, 'mobile primary navigation must be Home, VoxelPop, and Vault only');
assert.doesNotMatch(nav, /id: 'world'|id: 'more'/, 'World and More must not compete in the primary mobile dock');
assert.match(nav, /isOrganizedUserRoute/);
assert.match(nav, /pathname === '\/' \|\| pathname === '\/property'/, 'Home and creator must not stack the bottom dock under their focused header');
assert.match(navCss, /safe-area-inset-bottom/, 'consumer dock must respect the iPhone safe area');
assert.match(navCss, /@media\(max-width:720px\)/, 'consumer dock must stay mobile-only when desktop top navigation is present');
assert.match(layout, /FinancialOSNav/);
assert.match(layout, /AppCommandCenter/);
assert.match(layout, /spatial-os-interactions\.css/);
assert.doesNotMatch(vaultLayout, /VaultPortalNav/, 'Vault must not revive a competing legacy portal nav');

assert.match(interactions, /--vv-tap-min:\s*44px/, 'coarse-pointer controls should keep an iPhone-friendly minimum target');
assert.match(interactions, /@media \(pointer: coarse\)/, 'shared interactions should adapt to touch devices');
assert.match(interactions, /:focus-visible/, 'keyboard focus must stay visible across the app shell');
assert.match(interactions, /prefers-reduced-motion: reduce/, 'shared shell must respect reduced motion');
assert.match(interactions, /-webkit-text-size-adjust:\s*100%/, 'iPhone text resizing should remain stable');
assert.doesNotMatch(interactions, /background:\s*#(?:000|05060b)|color-scheme:/i, 'shared interaction polish must not force one visual theme onto every subsystem');

assert.match(commandCenter, /APP_DOCK, APP_SECTIONS/, 'tool finder should index the canonical product map');
assert.match(commandCenter, /metaKey \|\| event\.ctrlKey/, 'tool finder should support desktop keyboard invocation');
assert.match(commandCenter, /event\.key === '\/'/, 'tool finder should support fast slash invocation outside text fields');
assert.match(commandCenter, /safe-area-inset-bottom/, 'tool finder trigger must respect iPhone safe area');
assert.match(commandCenter, /!isSimplePropertyRoute\(pathname\)/, 'advanced tool search must disappear from the simple core routes');
assert.match(commandCenter, /never automatically spends money, mints an NFT, or starts a paid 3D generation/, 'tool finder must disclose its non-execution boundary');
assert.doesNotMatch(commandCenter, /wallet\.send|eth_sendTransaction|checkout\.sessions\.create/, 'tool finder must remain navigation rather than a transaction executor');

// The consumer home is intentionally just the house collectible product.
assert.match(rootHome, /HOUSE PHOTO → VOXEL → 3D · \$4\.99/, 'root Home must state the focused product and price');
assert.match(rootHome, /Create house voxel · \$4\.99/, 'root Home must have one clear paid creation CTA');
assert.match(rootHome, /href="\/property"/, 'root Home must route creation into the maker');
assert.match(rootHome, /Confirm the address/, 'root Home must explain property identity confirmation');
assert.match(rootHome, /voxel image, then a mintable 3D voxel/, 'root Home must explain voxel-image then final-3D generation');
assert.match(rootHome, /Saved to your Voxel Vault · mint when you want/, 'root Home must make automatic saving and optional minting explicit');
assert.match(rootHome, /Digital collectible only\. No deed, title, or physical-property rights\./, 'root Home must keep the digital-only physical-property boundary visible');
assert.match(rootHome, /HomeProductPreview/, 'root Home should prove the product with an interactive viewer');
assert.match(homePreview, /LocalVoxelModelViewer/, 'homepage proof must stay interactive');
assert.doesNotMatch(rootHome, /BUY PIECE|BUY WHOLE|BUY A PIECE|BUY THE WHOLE THING|guaranteed returns|guaranteed yield|risk[- ]free|equity in the house/i, 'unverified financial or physical-property purchase claims must stay off the consumer front door');
assert.doesNotMatch(rootHome, /RealEstatePlatformPage/, 'root home must not alias an older real-estate subsystem');

assert.match(propertyRoute, /\.\/HouseVoxelJourney/, 'the active /property route must use the house creator');
assert.match(property, /const labels = \['PHOTO', 'ADDRESS', 'VOXEL', '3D', 'DONE'\]/, 'creator must mirror the requested five-step sequence');
assert.match(property, /Choose one house photo\./, 'creator must begin with one obvious photo action');
assert.match(property, /\/api\/property-identity/, 'creator must confirm the canonical property identity');
assert.match(property, /\/api\/property-voxel-image\?/, 'creator must generate the voxel image');
assert.match(property, /\/api\/property-voxel-3d/, 'creator must generate the final 3D voxel');
assert.match(property, /Open inventory/, 'finished creation must prioritize the saved result');
assert.match(property, /Mint this voxel/, 'mint remains downstream and optional');
assert.doesNotMatch(property, /PropertyWorldMap|Add to My World/, 'World/map controls must stay outside the core creator');
assert.doesNotMatch(property, /investment|yield|rent rights|equity/i, 'creator must not market the collectible as a financial interest');

// Payment is a creation fee, not a property transaction.
assert.match(checkout, /PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'checkout price remains server-authoritative');
assert.match(checkout, /one_property_one_purchase: 'true'/, 'checkout records one collectible purchase per mapped property');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout keeps the source-photo storage boundary explicit');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|storage\.from/i, 'checkout must not spend generation credits or upload the photo');
assert.match(photoStart, /paidPropertyGenerationReceipt/, 'provider generation starts only after the paid creation receipt is verified');
assert.match(photoStart, /digital voxel interpretation/, 'generation prompt must describe the output as a digital interpretation');

// Minting is only the generated digital model and remains one-property-one-mint.
assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'minting must verify the account-owned final voxel');
assert.match(mintPrepare, /listPaidPropertyCollectiblesForBuyer/, 'minting must verify the paid property reservation');
assert.match(mintPrepare, /onePropertyOneMint: true/, 'minting must preserve one-property-one-mint');
assert.doesNotMatch(mintPrepare, /deed|title transfer|equity|rent rights/i, 'mint preparation must not imply physical-property rights');

// The $1.99 comparison remains a pure sandbox, not a faux bank/wallet surface.
assert.match(slice, /PROPERTY SLICE · SANDBOX/, 'slice page must identify itself as a sandbox');
assert.match(slice, /DEMO BALANCE · NOT MONEY/, 'demo balance must never look like settled cash');
assert.match(slice, /Simulation only · no checkout · no wallet · no ownership/, 'slice CTA must disclose that it cannot execute a real transaction');
assert.match(slice, /no real funds, deed, equity, security, rent rights, or NFT moved/, 'demo completion must preserve the full legal/financial boundary');
assert.doesNotMatch(slice, /Connect wallet|Make the NFT useful|PROPERTY · USD · CRYPTO · NFT/, 'the property sandbox must not imitate a live wallet or banking product');

// Readiness surfaces must not expose provider secrets.
assert.match(homeCapabilities, /\/api\/world-atlas\/capabilities/, 'capability strip must use the safe readiness endpoint');
assert.match(homeCapabilities, /No API keys or secret values are exposed here/, 'capability display must state the secret-value boundary');
assert.doesNotMatch(homeCapabilities, /process\.env|MESHY_API_KEY|BRIDGE_ACCESS_TOKEN|DOMAIN_CLIENT_SECRET/, 'client capability strip must never reference raw secret environment variables');
assert.match(capabilitiesApi, /Boolean\(process\.env\.MESHY_API_KEY\?\.trim\(\)\)/, 'Meshy readiness may expose only a boolean');

// Extras and provider/admin surfaces remain secondary to the simple product.
assert.match(more, /Keep VoxelPop simple\./i, 'Extras must explain its deliberately secondary role');
assert.match(more, /OTHER DIGITAL TOOLS/, 'secondary products must stay organized outside the core funnel');
assert.match(more, /OWNER \/ PROVIDER TOOLS/, 'provider and owner rails must stay visibly advanced');
assert.match(more, /A VoxelPop model or NFT is a digital creation/, 'Extras must preserve the digital-not-deed boundary');
assert.match(integrationsApi, /requireVoxelVaultAdmin/, 'integration status must be owner-authenticated');
for (const key of ['MESHY_API_KEY', 'STRIPE_SECRET_KEY', 'BRIDGE_DATASET_ID', 'DOMAIN_CLIENT_ID', 'DINARI_API_KEY_ID', 'ALGORAND_INDEXER_BASE_URL', 'CDP_API_KEY_ID']) assert.match(integrationsApi, new RegExp(key));
assert.match(integrationsApi, /secretsReturned:\s*false/);
assert.match(integrationsApi, /valuesReturned:\s*false/);
assert.doesNotMatch(integrationsApi, /return process\.env\[[^\]]+\]/, 'integration API must never return raw env values');
assert.match(integrationsPage, /OWNER · INTEGRATIONS CENTER/);
assert.match(integrationsPage, /getSupabaseBrowserAsync/);
assert.match(integrationsPage, /\/api\/admin\/integrations\/status/);
assert.match(integrationsPage, /SIGN IN WITH GOOGLE/);

// Detailed real-estate tooling remains separate and status-driven.
assert.doesNotMatch(advancedRealEstate, /guaranteed returns|guaranteed yield|risk[- ]free/i, 'advanced real-estate surface must not promise returns');

console.log('Financial OS coherence passed: VoxelPop is a focused digital house-voxel product, financial/property-right claims stay excluded from the core funnel, transactional tooling remains gated, and provider secrets remain server-only.');
