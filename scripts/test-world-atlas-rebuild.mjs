import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const overture = fs.readFileSync(new URL('../lib/overture-building-tiles.js', import.meta.url), 'utf8');
const atlas = fs.readFileSync(new URL('../lib/world-atlas.js', import.meta.url), 'utf8');
const anchor = fs.readFileSync(new URL('../lib/real-estate/buffalo-atlas-anchor.js', import.meta.url), 'utf8');
const anchorRoute = fs.readFileSync(new URL('../app/api/world-atlas/property-anchor/route.ts', import.meta.url), 'utf8');
const globe = fs.readFileSync(new URL('../app/vault/earth/GlobalEarthGlobe.js', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../app/vault/earth/page.js', import.meta.url), 'utf8');
const googleReality = fs.readFileSync(new URL('../app/vault/earth/GoogleRealityMap.js', import.meta.url), 'utf8');
const evidence = fs.readFileSync(new URL('../app/vault/earth/PropertyEvidencePanel.js', import.meta.url), 'utf8');
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
assert.match(overture, /slice\(0, 36\)/, 'world responses must remain bounded for iPhone rendering');
assert.match(atlas, /World building data is temporarily unavailable\. No replacement building was invented\./, 'global dual-source failure must stay explicit and non-fabricating');
assert.match(atlas, /aiModel:\s*'meshy-7'/, 'Meshy 7 must stay pinned');
assert.match(atlas, /targetPolycount:\s*30_000/, 'hero meshes must retain balanced 30k target');
assert.match(atlas, /automaticGeneration:\s*false/, 'ordinary browsing must spend zero Meshy credits');

// The flagship property uses jurisdiction evidence before global context.
assert.match(anchor, /fetchBuffaloPropertyReference/, '1047 anchor must read the City parcel record');
assert.match(anchor, /fetchErieCountySpatialIntake/, '1047 anchor must read Erie County parcel/building GIS');
assert.match(anchor, /inspectWorldAtlas/, 'global atlas must remain neighborhood context after local evidence');
assert.match(anchor, /sourceSeparationMeters > 250/, 'City/county coordinate conflicts must fail closed');
assert.match(anchor, /erie-building:/, 'exact county BUILDING geometry must receive a local atlas identity');
assert.match(anchor, /authoritativeLocal:\s*true/, 'atlas must disclose when local jurisdiction geometry outranks global map geometry');
assert.match(anchor, /No building was selected|no building was selected/i, 'conflicting local sources must never silently choose a house');
assert.match(anchorRoute, /resolveBuffaloAtlasAnchor/, 'Earth must expose a dedicated authoritative property-anchor API');
assert.match(anchorRoute, /Cache-Control.*private, no-store/s, 'property-anchor results must remain uncached private responses');

assert.match(globe, /world-atlas\/countries-110m\.json/, 'the globe must contain recognizable geography before lookup');
assert.match(globe, /activePointers\.size >= 2/, 'globe must keep two-finger pinch zoom');
assert.match(globe, /IntersectionObserver/, 'globe must pause offscreen');

assert.match(page, /1047 Kensington Ave, Buffalo, NY 14215/, 'Earth must expose exact 1047 calibration address');
assert.match(page, /sbl:\s*'90\.32-8-4'/, '1047 must carry exact SBL');
assert.match(page, /pin:\s*'1402000903200008004000'/, '1047 must carry exact parcel PIN');
assert.doesNotMatch(page, /id: 'kensington'[^\n]*\blat:/, '1047 must never ship with a guessed latitude');
assert.doesNotMatch(page, /id: 'kensington'[^\n]*\blng:/, '1047 must never ship with a guessed longitude');
assert.match(page, /\/api\/world-atlas\/property-anchor/, '1047 must use authoritative City + County anchor API');
assert.match(page, /exploreAuthoritative\(starter\)/, 'initial flagship load must use authoritative path');
assert.match(page, /Falling back to exact-address geocoding; no coordinate is guessed/, 'fallback may geocode but must never guess coordinates');
assert.match(page, /RESOLVING EXACT LOCATION/, 'unresolved coordinates must be disclosed');

assert.match(page, />COMPARE</, 'Compare mode must exist');
assert.match(page, />REALITY</, 'Reality mode must exist');
assert.match(page, />VOXEL</, 'Voxel mode must exist');
assert.match(page, />GLOBE</, 'Globe mode must exist');
assert.match(page, /GOOGLE_3D_ENABLED \? 'compare' : 'voxel'/, 'Google-ready deployments should open the strongest synchronized comparison while non-Google deployments stay usable');
assert.match(page, /BuffaloCalibratedReferenceModel/, 'authoritative Buffalo geometry must use the local calibrated renderer');
assert.match(page, /PropertyTruthStack/, 'Earth must expose an evidence-confidence ladder');
assert.match(page, /PropertyEvidencePanel/, 'Earth must expose external/source visual evidence');
assert.match(page, /DOWNLOAD LOADED REGION · GEOJSON/, 'open/source-backed loaded geometry must remain exportable');
assert.match(page, /FAIL-SAFE PROPERTY TRUTH/, 'main property card must explain missing-layer behavior');

assert.match(truthStack, /EVIDENCE LADDER/, 'truth stack must be clearly labeled');
for (const layer of ['Location', 'Parcel identity', 'Building footprint', 'Height + massing', 'Exterior appearance', 'Meshy 7 model', 'Market listing', 'Ownership / title']) {
  assert.ok(truthStack.includes(`'${layer}'`), `truth stack must expose ${layer}`);
}
assert.match(truthStack, /No footprint is being invented/, 'missing building geometry must remain explicit');
assert.match(truthStack, /do not establish deed\/title ownership/, 'visual/map layers must not create title');

assert.match(googleReality, /NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY/, 'Google 3D must use an explicitly configured browser key');
assert.match(googleReality, /importLibrary\('maps3d'\)/, 'Google reality must use maps3d');
assert.match(googleReality, /new Map3DElement/, 'Google reality must instantiate native 3D map element');
assert.match(googleReality, /mode:\s*'HYBRID'/, 'Google 3D must use HYBRID mode');
assert.match(googleReality, /OPEN IN GOOGLE MAPS/, 'Google fallback must remain navigable');
assert.doesNotMatch(googleReality, /getZxy|arrayBuffer\(|drawImage\(/, 'Google reality component must not extract/cache map pixels or meshes');

assert.match(evidence, /zillow\.com\/homes/, 'evidence panel should provide Zillow lookup path');
assert.match(evidence, /google\.com\/maps/, 'evidence panel should provide Google/Street View path');
assert.match(evidence, /not automatically licensed training\/reconstruction inputs/i, 'external imagery must remain reference-only without derivative rights');
assert.match(evidence, /displayed as listing evidence/, 'authorized provider photos may be displayed as evidence');

assert.match(meshPanel, /normalizePhotoForMeshy/, 'iPhone photo selections must normalize before Meshy upload');
assert.match(meshPanel, /createImageBitmap/, 'modern browser image decode should be used when available');
assert.match(meshPanel, /maxSide = 2048/, 'Meshy reference resolution must stay bounded');
assert.match(meshPanel, /canvas\.toBlob\(resolve, 'image\/jpeg', 0\.92\)/, 'common iPhone/WebP selections must normalize to high-quality JPEG');
assert.match(meshPanel, /VIEW 1 · FRONT \/ PRIMARY/, 'first Meshy view must be designated front/primary');
assert.match(meshPanel, /OWNER SIGN-IN FOR MESHY 7/, 'paid Meshy controls must remain owner gated');
assert.match(meshPanel, /readyReferences\.length < 2/, 'Meshy must require multiple ready views');
assert.match(meshPanel, /setTimeout\(poll, 4000\)/, 'Meshy polling must stay bounded');
assert.match(meshPanel, /MeshyModelViewer/, 'completed GLB must render in the product');

assert.match(uploadRoute, /requireVoxelVaultAdmin/, 'reference uploads must be admin authenticated');
assert.match(uploadRoute, /ALLOWED_TYPES = new Set\(\['image\/jpeg', 'image\/png'\]\)/, 'server must accept only Meshy-supported normalized reference types');
assert.doesNotMatch(uploadRoute, /image\/heic|image\/heif|image\/webp/, 'server must not pretend unsupported provider formats are ready');
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

assert.match(capabilitiesRoute, /Boolean\(process\.env\.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY/, 'runtime capability API must expose Google readiness only as boolean');
assert.match(capabilitiesRoute, /Boolean\(process\.env\.MESHY_API_KEY/, 'runtime capability API must expose Meshy readiness only as boolean');
assert.match(capabilitiesRoute, /no extraction, scraping, ML reconstruction, or offline cache/i, 'Google usage boundary must be visible');

assert.match(meshViewer, /GLTFLoader/, 'Meshy viewer must load GLB');
assert.match(meshViewer, /compact \? 1\.15 : 1\.35/, 'Meshy viewer must retain strict compact pixel ratio');
assert.match(meshViewer, /time - lastRender < 33/, 'Meshy viewer must cap compact rendering near 30fps');
assert.match(meshViewer, /prefers-reduced-motion/, 'Meshy viewer must respect reduced motion');

assert.match(docs, /NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=/, 'deployment docs must document Google browser key');
assert.match(docs, /MESHY_API_KEY=/, 'deployment docs must document server-only Meshy setting');
assert.match(docs, /does \*\*not\*\* download, scrape, extract building meshes from, train on, reconstruct from, or permanently cache Google/i, 'docs must forbid Google extraction');

console.log('World atlas reality-stack checks passed: authoritative 1047 City+County anchor, Google/Voxel compare mode, source-backed globe, evidence ladder, reference-only Zillow/Google links, Meshy 7 rights gates, iPhone normalization, private caching, and fail-safe missing layers.');
