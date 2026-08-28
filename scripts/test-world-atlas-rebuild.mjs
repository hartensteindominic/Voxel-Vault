import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const overture = fs.readFileSync(new URL('../lib/overture-building-tiles.js', import.meta.url), 'utf8');
const atlas = fs.readFileSync(new URL('../lib/world-atlas.js', import.meta.url), 'utf8');
const globe = fs.readFileSync(new URL('../app/vault/earth/GlobalEarthGlobe.js', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../app/vault/earth/page.js', import.meta.url), 'utf8');
const googleReality = fs.readFileSync(new URL('../app/vault/earth/GoogleRealityMap.js', import.meta.url), 'utf8');
const evidence = fs.readFileSync(new URL('../app/vault/earth/PropertyEvidencePanel.js', import.meta.url), 'utf8');
const meshPanel = fs.readFileSync(new URL('../app/vault/earth/MeshyHeroPanel.js', import.meta.url), 'utf8');
const meshViewer = fs.readFileSync(new URL('../app/vault/earth/MeshyModelViewer.js', import.meta.url), 'utf8');
const meshRoute = fs.readFileSync(new URL('../app/api/world-atlas/mesh/route.ts', import.meta.url), 'utf8');
const uploadRoute = fs.readFileSync(new URL('../app/api/world-atlas/reference-upload/route.ts', import.meta.url), 'utf8');
const capabilitiesRoute = fs.readFileSync(new URL('../app/api/world-atlas/capabilities/route.ts', import.meta.url), 'utf8');
const docs = fs.readFileSync(new URL('../docs/WORLD_ATLAS_REALITY_STACK.md', import.meta.url), 'utf8');

for (const dependency of ['pmtiles', '@mapbox/vector-tile', 'pbf', 'world-atlas', 'topojson-client']) {
  assert.ok(packageJson.dependencies?.[dependency], `${dependency} must remain an application dependency for the world atlas`);
}

assert.match(overture, /new PMTiles\(url\)/, 'Overture lookup must use PMTiles range reads rather than downloading the archive');
assert.match(overture, /archive\.getZxy/, 'Overture lookup must read only needed z/x/y tiles');
assert.match(overture, /new VectorTile/, 'Overture MVT tiles must be decoded as vector tiles');
assert.match(overture, /\['building', 'building_part'\]/, 'Overture building and building_part layers must be understood');
assert.match(overture, /license: 'ODbL'/, 'Overture Buildings license must stay visible');
assert.match(overture, /distanceMeters <= radiusMeters \* 1\.65/, 'world tile reads must stay geographically bounded');
assert.match(overture, /slice\(0, 36\)/, 'each inspection response must remain bounded for iPhone rendering');

assert.ok(atlas.includes('fetchOvertureBuildingNeighborhood('), 'Overture must remain wired as primary geometry source');
assert.ok(atlas.includes('fetchGlobalNeighborhoodReference('), 'OSM/Overpass must remain wired as fallback');
assert.match(atlas, /fallbackUsed:\s*false/, 'successful primary lookups must expose primary state');
assert.match(atlas, /fallbackUsed:\s*true/, 'fallback state must be explicit');
assert.match(atlas, /World building data is temporarily unavailable\. No replacement building was invented\./, 'dual-source failure must be explicit and non-fabricating');
assert.match(atlas, /aiModel:\s*'meshy-7'/, 'property reconstruction must pin Meshy 7 rather than silently drift with latest');
assert.match(atlas, /targetPolycount:\s*30_000/, 'hero meshes must retain the balanced 30k target');
assert.match(atlas, /textureResolution:\s*'2k'/, 'hero meshes must retain 2K textures for mobile');
assert.match(atlas, /automaticGeneration:\s*false/, 'ordinary world browsing must spend zero Meshy credits');

assert.match(globe, /world-atlas\/countries-110m\.json/, 'the globe must contain recognizable country geography before a lookup');
assert.match(globe, /topoFeature/, 'country topology must be rendered into the Earth texture');
assert.match(globe, /engineRef/, 'selection updates must use a persistent globe engine');
assert.match(globe, /updateMarkers/, 'marker updates must be isolated from initialization');
assert.match(globe, /activePointers\.size >= 2/, 'globe must support two-finger pinch zoom');
assert.match(globe, /IntersectionObserver/, 'globe must pause expensive rendering when offscreen');
assert.match(globe, /document\.hidden/, 'globe must stop rendering while the page is hidden');
assert.match(globe, /3D globe is unavailable[^\n]*Address search and quick locations still work/, 'WebGL failure must leave a usable non-3D path');

// 1047 is resolved through its existing Buffalo parcel identity, never a guessed coordinate.
assert.match(page, /1047 Kensington Ave, Buffalo, NY 14215/, 'Earth must expose the exact 1047 calibration address');
assert.match(page, /sbl:\s*'90\.32-8-4'/, '1047 quick entry must carry the verified Buffalo/Erie parcel key');
assert.match(page, /pin:\s*'1402000903200008004000'/, '1047 quick entry must carry the exact parcel PIN');
assert.doesNotMatch(page, /id: 'kensington'[^\n]*\blat:/, '1047 must never ship with a guessed latitude');
assert.doesNotMatch(page, /id: 'kensington'[^\n]*\blng:/, '1047 must never ship with a guessed longitude');
assert.match(page, /\/api\/geo\/buffalo-reference/, '1047 must resolve through the existing Buffalo authoritative reference route first');
assert.match(page, /exploreAuthoritative\(starter\)/, 'the initial flagship load must use the authoritative 1047 path');
assert.match(page, /Falling back to exact-address geocoding; no coordinate is being guessed/, 'authoritative-source failure may geocode but must never guess');
assert.match(page, /RESOLVING EXACT LOCATION/, 'UI must disclose unresolved coordinates rather than imply a match');

assert.match(page, /GoogleRealityMap/, 'Earth must expose Google reality view');
assert.match(page, />REALITY</, 'Reality tab must exist');
assert.match(page, />VOXEL</, 'Voxel tab must exist');
assert.match(page, />GLOBE</, 'Globe tab must exist');
assert.match(page, /GOOGLE_3D_ENABLED \? 'reality' : 'voxel'/, 'a deployment without Google 3D must start in the working Voxel path');
assert.match(page, /PropertyEvidencePanel/, 'selected property must expose a source/reference evidence panel');
assert.match(page, /capabilityLabel/, 'provider readiness must be visible instead of silently assumed');
assert.match(page, /DOWNLOAD LOADED REGION · GEOJSON/, 'loaded open geometry must remain exportable');

assert.match(googleReality, /NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY/, 'Google 3D must use an explicitly configured browser key');
assert.match(googleReality, /importLibrary\('maps3d'\)/, 'Google reality must use the current maps3d library');
assert.match(googleReality, /new Map3DElement/, 'Google reality must instantiate the native 3D map element');
assert.match(googleReality, /mode:\s*'HYBRID'/, 'Google 3D must explicitly use HYBRID mode so current API behavior does not render blank');
assert.match(googleReality, /Google Photorealistic 3D is not configured|Google Photorealistic 3D is ready in the app/, 'missing Google configuration must have a useful fallback');
assert.match(googleReality, /OPEN IN GOOGLE MAPS/, 'Google fallback must remain navigable');
assert.doesNotMatch(googleReality, /getZxy|arrayBuffer\(|drawImage\(/, 'Google reality component must not extract/cache map tiles into Voxel Vault');

assert.match(evidence, /zillow\.com\/homes/, 'evidence panel should provide a Zillow reference path');
assert.match(evidence, /google\.com\/maps/, 'evidence panel should provide Google Maps/Street View paths');
assert.match(evidence, /not automatically licensed training\/reconstruction inputs/i, 'reference panel must explain derivative-rights separation');
assert.match(evidence, /displayed as listing evidence/, 'authorized provider photos may be shown as listing evidence');

assert.match(meshPanel, /normalizePhotoForMeshy/, 'iPhone photo selections must be normalized before Meshy upload');
assert.match(meshPanel, /createImageBitmap/, 'browser should use modern image decode when available');
assert.match(meshPanel, /maxSide = 2048/, 'Meshy references must be downscaled to a bounded useful size');
assert.match(meshPanel, /canvas\.toBlob\(resolve, 'image\/jpeg', 0\.92\)/, 'Meshy references must normalize to high-quality JPEG');
assert.match(meshPanel, /VIEW 1 · FRONT \/ PRIMARY/, 'the first Meshy 7 view must be clearly designated as front/primary');
assert.match(meshPanel, /OWNER SIGN-IN FOR MESHY 7/, 'paid generation controls must remain owner gated');
assert.match(meshPanel, /readyReferences\.length < 2/, 'Meshy UI must require multiple ready views');
assert.match(meshPanel, /setTimeout\(poll, 4000\)/, 'Meshy status polling must remain bounded');
assert.match(meshPanel, /MeshyModelViewer/, 'completed GLB must render in the Earth product');
assert.match(meshPanel, /listing\.imageUrl/, 'listing media may be shown as display evidence');
assert.match(meshPanel, /will not send it to Meshy unless the provider separately grants derivative-generation rights/, 'display rights must not silently become AI rights');

assert.match(uploadRoute, /requireVoxelVaultAdmin/, 'reference uploads must be owner/admin authenticated');
assert.match(uploadRoute, /ALLOWED_TYPES = new Set\(\['image\/jpeg', 'image\/png'\]\)/, 'server must accept only Meshy-supported JPEG/PNG references');
assert.doesNotMatch(uploadRoute, /image\/heic|image\/heif|image\/webp/, 'server must not pretend unsupported Meshy formats are ready');
assert.match(uploadRoute, /MAX_BYTES = 12 \* 1024 \* 1024/, 'normalized reference uploads must have a hard size limit');
assert.match(uploadRoute, /rights\.json/, 'every private reference must retain a rights sidecar');
assert.match(uploadRoute, /createSignedUrl/, 'Meshy must receive temporary signed URLs rather than public storage');

assert.match(meshRoute, /requireVoxelVaultAdmin/, 'paid Meshy generation must remain owner/admin controlled');
assert.match(meshRoute, /MESHY_API_KEY/, 'Meshy key must stay server-side');
assert.match(meshRoute, /ai_model:\s*WORLD_ATLAS_MESH_POLICY\.aiModel/, 'Meshy route must use the pinned policy model');
assert.match(meshRoute, /moderation:\s*true/, 'Meshy moderation must remain enabled');
assert.match(meshRoute, /image_enhancement:\s*false/, 'property reconstruction must avoid appearance-changing enhancement');
assert.match(meshRoute, /remove_lighting:\s*true/, 'property reconstruction should remove source lighting where supported');
assert.match(meshRoute, /BLOCKED_REFERENCE_HOSTS\.test\(host\)/, 'blocked proprietary image hosts must be enforced before generation');
for (const hostToken of ['google\\.com', 'zillow\\.com', 'redfin\\.com', 'apartments\\.com']) {
  assert.ok(meshRoute.includes(hostToken), `Meshy route must block ${hostToken.replace('\\.', '.')}`);
}
assert.match(meshRoute, /persistModelBinary/, 'completed Meshy GLBs should be cached privately');
assert.match(meshRoute, /createModelSignedUrl/, 'cached private GLBs must use expiring signed playback URLs');

assert.match(capabilitiesRoute, /Boolean\(process\.env\.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY/, 'capability API must expose Google readiness only as a boolean');
assert.match(capabilitiesRoute, /Boolean\(process\.env\.MESHY_API_KEY/, 'capability API must expose Meshy readiness only as a boolean');
assert.match(capabilitiesRoute, /no extraction, scraping, ML reconstruction, or offline cache/i, 'Google usage boundary must be visible in runtime capability metadata');
assert.doesNotMatch(capabilitiesRoute, /googleReality:[\s\S]{0,200}key:/i, 'capability API must not serialize a Google key');
assert.doesNotMatch(capabilitiesRoute, /meshy:[\s\S]{0,200}apiKey:/i, 'capability API must not serialize a Meshy key');

assert.match(meshViewer, /GLTFLoader/, 'Meshy viewer must load real GLB assets');
assert.match(meshViewer, /compact \? 1\.15 : 1\.35/, 'Meshy viewer must retain strict compact pixel-ratio cap');
assert.match(meshViewer, /time - lastRender < 33/, 'Meshy viewer must cap compact rendering near 30fps');
assert.match(meshViewer, /prefers-reduced-motion/, 'Meshy viewer must respect reduced motion');

assert.match(docs, /NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=/, 'deployment docs must show the Google browser-key setting');
assert.match(docs, /MESHY_API_KEY=/, 'deployment docs must show the server-only Meshy setting');
assert.match(docs, /does \*\*not\*\* download, scrape, extract building meshes from, train on, reconstruct from, or permanently cache Google/i, 'docs must forbid extracting Google visual data');

console.log('World atlas reality-stack checks passed: authoritative 1047 anchor, Google live reality fallback, source-backed Voxel/Globe, reference-only Zillow/Google evidence, Meshy 7 rights gates, iPhone JPEG normalization, private caching, and no silent provider assumptions.');
