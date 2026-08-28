import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const overture = fs.readFileSync(new URL('../lib/overture-building-tiles.js', import.meta.url), 'utf8');
const atlas = fs.readFileSync(new URL('../lib/world-atlas.js', import.meta.url), 'utf8');
const streamLib = fs.readFileSync(new URL('../lib/world-atlas-tile-stream.js', import.meta.url), 'utf8');
const streamRoute = fs.readFileSync(new URL('../app/api/world-atlas/stream/route.ts', import.meta.url), 'utf8');
const openImagery = fs.readFileSync(new URL('../lib/open-street-imagery.js', import.meta.url), 'utf8');
const openRoute = fs.readFileSync(new URL('../app/api/world-atlas/open-imagery/route.ts', import.meta.url), 'utf8');
const anchor = fs.readFileSync(new URL('../lib/real-estate/buffalo-atlas-anchor.js', import.meta.url), 'utf8');
const anchorRoute = fs.readFileSync(new URL('../app/api/world-atlas/property-anchor/route.ts', import.meta.url), 'utf8');
const globeController = fs.readFileSync(new URL('../app/vault/earth/GlobalEarthGlobe.js', import.meta.url), 'utf8');
const planetGlobe = fs.readFileSync(new URL('../app/vault/earth/PlanetStreamGlobe.js', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../app/vault/earth/page.js', import.meta.url), 'utf8');
const openReality = fs.readFileSync(new URL('../app/vault/earth/OpenRealityPanel.js', import.meta.url), 'utf8');
const truthStack = fs.readFileSync(new URL('../app/vault/earth/PropertyTruthStack.js', import.meta.url), 'utf8');
const meshPanel = fs.readFileSync(new URL('../app/vault/earth/MeshyHeroPanel.js', import.meta.url), 'utf8');
const meshViewer = fs.readFileSync(new URL('../app/vault/earth/MeshyModelViewer.js', import.meta.url), 'utf8');
const meshRoute = fs.readFileSync(new URL('../app/api/world-atlas/mesh/route.ts', import.meta.url), 'utf8');
const uploadRoute = fs.readFileSync(new URL('../app/api/world-atlas/reference-upload/route.ts', import.meta.url), 'utf8');
const capabilitiesRoute = fs.readFileSync(new URL('../app/api/world-atlas/capabilities/route.ts', import.meta.url), 'utf8');
const docs = fs.readFileSync(new URL('../docs/WORLD_ATLAS_REALITY_STACK.md', import.meta.url), 'utf8');

for (const dependency of ['pmtiles', '@mapbox/vector-tile', 'pbf', 'world-atlas', 'topojson-client']) {
  assert.ok(packageJson.dependencies?.[dependency], `${dependency} must remain an application dependency for the world atlas`);
}

assert.match(overture, /new PMTiles\(url\)/, 'Overture must use bounded PMTiles range reads');
assert.match(overture, /archive\.getZxy/, 'Overture must read only needed tiles');
assert.match(overture, /new VectorTile/, 'Overture vector tiles must decode as MVT');
assert.match(overture, /slice\(0, 36\)/, 'detailed property responses must remain bounded for iPhone rendering');
assert.match(atlas, /World building data is temporarily unavailable\. No replacement building was invented\./, 'global dual-source failure must stay explicit and non-fabricating');
assert.match(atlas, /aiModel:\s*'meshy-7'/, 'Meshy 7 must stay pinned');
assert.match(atlas, /targetPolycount:\s*30_000/, 'hero meshes must retain balanced 30k target');
assert.match(atlas, /automaticGeneration:\s*false/, 'ordinary browsing must spend zero Meshy credits');

assert.match(streamLib, /archive\.getZxy/, 'planet streaming must use PMTiles range reads');
assert.match(streamLib, /MAX_FEATURES_PER_TILE = 120/, 'planet streaming must cap features per tile');
assert.match(streamLib, /MAX_FEATURES_PER_RESPONSE = 500/, 'planet streaming must cap each response');
assert.match(streamLib, /MAX_RING = 1/, 'planet streaming must cap neighboring tile fanout');
assert.match(streamLib, /TILE_CACHE_TTL_MS = 60 \* 60 \* 1000/, 'planet tile cache must expire');
assert.match(streamLib, /global-on-demand/, 'planet coverage must be explicitly on-demand rather than pretending the whole archive is local');
assert.match(streamLib, /createsOwnership:\s*false/, 'streamed map data must never create ownership');
assert.match(streamLib, /createsTitle:\s*false/, 'streamed map data must never create title');
assert.match(streamRoute, /streamWorldAtlasRegion/, 'Earth must expose the bounded streaming engine');
assert.match(streamRoute, /s-maxage=300/, 'streamed regions should use a short shared cache');
assert.match(globeController, /MAX_STREAMED_BUILDINGS = 420/, 'iPhone globe must cap accumulated streamed markers');
assert.match(globeController, /MAX_VISITED_REGIONS = 96/, 'client visited-region history must be bounded');
assert.match(globeController, /inflightRef/, 'duplicate visible-region requests must be suppressed');
assert.match(globeController, /onLocation\?\.\(\{ latitude:/, 'streamed marker selection must deepen through normal geographic lookup');
assert.match(planetGlobe, /world-atlas\/countries-110m\.json/, 'the globe must contain recognizable geography before lookup');
assert.match(planetGlobe, /activePointers\.size >= 2/, 'globe must keep two-finger pinch zoom');
assert.match(planetGlobe, /IntersectionObserver/, 'globe must pause offscreen');
assert.match(planetGlobe, /onViewport/, 'settled camera movement must be able to stream the visible region');
assert.match(planetGlobe, /compact \? 1\.15 : 1\.35/, 'streaming globe must retain strict mobile pixel ratio');
assert.match(planetGlobe, /time - lastRender < 33/, 'streaming globe must remain capped near 30fps on compact devices');

assert.match(openImagery, /api\.openstreetcam\.org\/2\.0\/photo/, 'KartaView public photo API must drive free street reality');
assert.match(openImagery, /KARTAVIEW_LICENSE = 'CC BY-SA 4\.0'/, 'open imagery license must be explicit');
assert.match(openImagery, /requiresPaidKey:\s*false/, 'open imagery must not require a paid map key');
assert.match(openImagery, /chooseDiverseViews/, 'open imagery should prefer multiple useful headings');
assert.match(openImagery, /selected\.length >= maxViews/, 'open imagery must remain bounded');
assert.match(openImagery, /rightsBasis:\s*'open-licensed'/, 'KartaView references must carry open derivative rights metadata');
assert.match(openImagery, /share-alike obligations/, 'Meshy-ready open references must preserve share-alike obligations');
assert.match(openImagery, /No replacement imagery was invented/, 'missing street imagery must never fabricate a facade');
assert.match(openRoute, /fetchOpenStreetImagery/, 'Earth must expose an open imagery API');
assert.match(openRoute, /s-maxage=300/, 'public open imagery metadata should be short-lived cacheable to protect rate limits');

assert.match(anchor, /fetchBuffaloPropertyReference/, '1047 anchor must read the City parcel record');
assert.match(anchor, /fetchErieCountySpatialIntake/, '1047 anchor must read Erie County parcel/building GIS');
assert.match(anchor, /inspectWorldAtlas/, 'global atlas must remain neighborhood context after local evidence');
assert.match(anchor, /countyLookup = pin \? \{ pin \} : \{ sbl \}/, 'full Erie PIN must outrank short SBL when available');
assert.match(anchor, /county_geometry_with_city_lat_lng_field_swap_detected/, 'coordinate-field reversal must be detected only through independent source reconciliation');
assert.match(anchor, /erie-building:/, 'exact county BUILDING geometry must receive a local atlas identity');
assert.match(anchor, /authoritativeLocal:\s*true/, 'atlas must disclose when local jurisdiction geometry outranks global map geometry');
assert.match(anchor, /No building was selected|no building was selected/i, 'conflicting local sources must never silently choose a house');
assert.match(anchorRoute, /resolveBuffaloAtlasAnchor/, 'Earth must expose a dedicated authoritative property-anchor API');
assert.match(anchorRoute, /Cache-Control.*private, no-store/s, 'property-anchor results must remain uncached private responses');

assert.match(page, /1047 Kensington Ave, Buffalo, NY 14215/, 'Earth must expose exact 1047 calibration address');
assert.match(page, /sbl:\s*'90\.32-8-4'/, '1047 must carry exact SBL');
assert.match(page, /pin:\s*'1402000903200008004000'/, '1047 must carry exact parcel PIN');
assert.doesNotMatch(page, /id: 'kensington'[^\n]*\blat:/, '1047 must never ship with a guessed latitude');
assert.doesNotMatch(page, /id: 'kensington'[^\n]*\blng:/, '1047 must never ship with a guessed longitude');
assert.match(page, /\/api\/world-atlas\/property-anchor/, '1047 must use authoritative City + County anchor API');
assert.match(page, /Falling back to exact-address geocoding; no coordinate is guessed/, 'fallback may geocode but must never guess coordinates');
assert.match(page, /RESOLVING EXACT LOCATION/, 'unresolved coordinates must be disclosed');
assert.match(page, /useState\('compare'\)/, 'free Compare mode must be the default without Google billing');
assert.match(page, />COMPARE</, 'Compare mode must exist');
assert.match(page, />STREET</, 'free street imagery mode must exist');
assert.match(page, />VOXEL</, 'Voxel mode must exist');
assert.match(page, />GLOBE</, 'Globe mode must exist');
assert.match(page, /OpenRealityPanel/, 'Earth must expose free open street reality');
assert.match(page, /openReferences=\{openImagery\?\.meshyReferences \|\| \[\]\}/, 'free open imagery must feed the controlled Meshy workflow');
assert.match(page, /NO PAID MAP KEY REQUIRED/, 'Earth must clearly avoid paid map dependency');
assert.match(page, /BuffaloCalibratedReferenceModel/, 'authoritative Buffalo geometry must use the local calibrated renderer');
assert.match(page, /PropertyTruthStack/, 'Earth must expose an evidence-confidence ladder');
assert.match(page, /PropertyEvidencePanel/, 'Earth must expose external/source visual evidence');
assert.match(page, /DOWNLOAD LOADED REGION · GEOJSON/, 'open/source-backed loaded geometry must remain exportable');
assert.match(page, /FAIL-SAFE PROPERTY TRUTH/, 'main property card must explain missing-layer behavior');

assert.match(openReality, /FREE OPEN STREET REALITY/, 'open street panel must be clearly labeled');
assert.match(openReality, /No paid Google key is required/i, 'open street loading state should explain zero paid-key requirement');
assert.match(openReality, /LICENSE \+ ATTRIBUTION/, 'open imagery must expose attribution/license access');
assert.match(openReality, /Proximity does not prove/, 'nearby imagery must not silently verify the selected parcel');

assert.match(truthStack, /EVIDENCE LADDER/, 'truth stack must be clearly labeled');
for (const layer of ['Location', 'Parcel identity', 'Building footprint', 'Height + massing', 'Exterior appearance', 'Meshy 7 model', 'Market listing', 'Ownership / title']) {
  assert.ok(truthStack.includes(`'${layer}'`), `truth stack must expose ${layer}`);
}
assert.match(truthStack, /No footprint is being invented/, 'missing building geometry must remain explicit');
assert.match(truthStack, /openDerivativeMedia/, 'open imagery rights must participate in Meshy readiness without becoming title evidence');

assert.match(meshPanel, /openReferences = \[\]/, 'Meshy panel must accept open references');
assert.match(meshPanel, /FREE OPEN KARTAVIEW VIEW/, 'Meshy panel must offer open KartaView views when available');
assert.match(meshPanel, /CC BY-SA 4\.0/, 'Meshy open-view path must explain the source license');
assert.match(meshPanel, /normalizePhotoForMeshy/, 'iPhone photo selections must normalize before Meshy upload');
assert.match(meshPanel, /maxSide = 2048/, 'Meshy reference resolution must stay bounded');
assert.match(meshPanel, /canvas\.toBlob\(resolve, 'image\/jpeg', 0\.92\)/, 'common iPhone selections must normalize to high-quality JPEG');
assert.match(meshPanel, /OWNER SIGN-IN FOR MESHY 7/, 'paid Meshy controls must remain owner gated');
assert.match(meshPanel, /readyReferences\.length < 2/, 'Meshy must require multiple ready views');
assert.match(meshPanel, /setTimeout\(poll, 4000\)/, 'Meshy polling must stay bounded');
assert.match(meshPanel, /MeshyModelViewer/, 'completed GLB must render in the product');

assert.match(uploadRoute, /requireVoxelVaultAdmin/, 'reference uploads must be admin authenticated');
assert.match(uploadRoute, /ALLOWED_TYPES = new Set\(\['image\/jpeg', 'image\/png'\]\)/, 'server must accept only Meshy-supported normalized reference types');
assert.match(uploadRoute, /rights\.json/, 'every private reference must retain a rights sidecar');
assert.match(uploadRoute, /createSignedUrl/, 'Meshy must receive temporary signed URLs');

assert.match(meshRoute, /requireVoxelVaultAdmin/, 'paid Meshy generation must remain owner/admin controlled');
assert.match(meshRoute, /MESHY_API_KEY/, 'Meshy key must stay server-side');
assert.match(meshRoute, /ai_model:\s*WORLD_ATLAS_MESH_POLICY\.aiModel/, 'Meshy route must use pinned policy model');
assert.match(meshRoute, /moderation:\s*true/, 'Meshy moderation must remain enabled');
assert.match(meshRoute, /BLOCKED_REFERENCE_HOSTS\.test\(host\)/, 'proprietary reference hosts must be enforced before generation');
for (const hostToken of ['google\\.com', 'zillow\\.com', 'redfin\\.com', 'apartments\\.com']) {
  assert.ok(meshRoute.includes(hostToken), `Meshy route must block direct ingestion from ${hostToken.replace('\\.', '.')}`);
}
assert.match(meshRoute, /persistModelBinary/, 'completed Meshy GLBs should be cached privately');
assert.match(meshRoute, /createModelSignedUrl/, 'cached private GLBs must use expiring playback URLs');

assert.match(capabilitiesRoute, /openStreetReality/, 'runtime capability API must expose free open street readiness');
assert.match(capabilitiesRoute, /requiresPaidKey:\s*false/, 'runtime capability API must say no paid key is required');
assert.match(capabilitiesRoute, /googleReality:[\s\S]*configured:\s*false[\s\S]*required:\s*false/, 'Google must remain optional, not a hidden required dependency');
assert.match(capabilitiesRoute, /Boolean\(process\.env\.MESHY_API_KEY/, 'runtime capability API must expose Meshy readiness only as boolean');

assert.match(meshViewer, /GLTFLoader/, 'Meshy viewer must load GLB');
assert.match(meshViewer, /compact \? 1\.15 : 1\.35/, 'Meshy viewer must retain strict compact pixel ratio');
assert.match(meshViewer, /time - lastRender < 33/, 'Meshy viewer must cap compact rendering near 30fps');
assert.match(meshViewer, /prefers-reduced-motion/, 'Meshy viewer must respect reduced motion');

assert.match(docs, /does \*\*not require a paid Google Maps key\*\*/i, 'docs must explicitly remove paid Google requirement');
assert.match(docs, /KartaView/, 'docs must document the free open street imagery layer');
assert.match(docs, /MESHY_API_KEY=/, 'docs must document server-only Meshy setting');
assert.match(docs, /CC BY-SA 4\.0/, 'docs must preserve open imagery license obligations');

console.log('World atlas reality-stack checks passed: authoritative 1047 City+County anchor, global on-demand Overture streaming, free KartaView street reality, evidence ladder, Meshy 7 rights gates, iPhone limits, private caching, and fail-safe missing layers.');
