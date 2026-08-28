import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const overture = fs.readFileSync(new URL('../lib/overture-building-tiles.js', import.meta.url), 'utf8');
const atlas = fs.readFileSync(new URL('../lib/world-atlas.js', import.meta.url), 'utf8');
const globe = fs.readFileSync(new URL('../app/vault/earth/GlobalEarthGlobe.js', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../app/vault/earth/page.js', import.meta.url), 'utf8');
const meshPanel = fs.readFileSync(new URL('../app/vault/earth/MeshyHeroPanel.js', import.meta.url), 'utf8');
const meshViewer = fs.readFileSync(new URL('../app/vault/earth/MeshyModelViewer.js', import.meta.url), 'utf8');
const meshRoute = fs.readFileSync(new URL('../app/api/world-atlas/mesh/route.ts', import.meta.url), 'utf8');
const uploadRoute = fs.readFileSync(new URL('../app/api/world-atlas/reference-upload/route.ts', import.meta.url), 'utf8');

for (const dependency of ['pmtiles', '@mapbox/vector-tile', 'pbf', 'world-atlas', 'topojson-client']) {
  assert.ok(packageJson.dependencies?.[dependency], `${dependency} must be pinned as an application dependency for the rebuilt atlas`);
}

assert.match(overture, /new PMTiles\(url\)/, 'Overture lookup must use PMTiles range reads rather than downloading the archive');
assert.match(overture, /archive\.getZxy/, 'Overture lookup must read only the needed z/x/y tiles');
assert.match(overture, /new VectorTile/, 'Overture MVT tiles must be decoded as vector tiles');
assert.match(overture, /\['building', 'building_part'\]/, 'Overture building and building_part layers must be understood');
assert.match(overture, /sourceUrl: 'https:\/\/explore\.overturemaps\.org\/'/, 'Overture geometry must keep a navigable source reference');
assert.match(overture, /license: 'ODbL'/, 'Overture Buildings license must stay visible in normalized source metadata');
assert.match(overture, /distanceMeters <= radiusMeters \* 1\.65/, 'world tile reads must stay geographically bounded');
assert.match(overture, /slice\(0, 36\)/, 'each inspection response must remain bounded for iPhone rendering');

const overtureCall = atlas.indexOf('fetchOvertureBuildingNeighborhood({');
const fallbackCall = atlas.indexOf('fetchGlobalNeighborhoodReference({');
assert.ok(overtureCall >= 0 && fallbackCall > overtureCall, 'Overture must be attempted before the public Overpass fallback');
assert.match(atlas, /fallbackUsed:\s*false/, 'successful Overture lookups must explicitly avoid fallback');
assert.match(atlas, /fallbackUsed:\s*true/, 'fallback state must be explicit when Overture cannot satisfy a region');
assert.match(atlas, /World building data is temporarily unavailable/, 'both-source failure must produce a clear runtime error rather than a fake building');

assert.match(globe, /world-atlas\/countries-110m\.json/, 'the globe must contain recognizable country geography even before a lookup');
assert.match(globe, /topoFeature/, 'country topology must be rendered into the Earth texture');
assert.match(globe, /engineRef/, 'selection updates must use a persistent globe engine rather than recreate the scene');
assert.match(globe, /updateMarkers/, 'marker updates must be isolated from globe initialization');
assert.match(globe, /activePointers\.size >= 2/, 'globe must support two-finger pinch zoom');
assert.match(globe, /addEventListener\('wheel'/, 'desktop globe must support wheel zoom');
assert.match(globe, /IntersectionObserver/, 'globe must pause expensive rendering when offscreen');
assert.match(globe, /document\.hidden/, 'globe must stop rendering while the page is hidden');
assert.match(globe, /3D globe is unavailable[^\n]*Address search and quick locations still work/, 'WebGL failure must leave a usable non-3D exploration path');

assert.match(page, /QUICK_LOCATIONS/, 'Earth must expose no-geocoder quick-location recovery paths');
assert.match(page, /parseCoordinateQuery/, 'Earth search must accept direct latitude and longitude input');
assert.match(page, /loadAtlas\(\{ lat: starter\.lat, lng: starter\.lng \}\)/, 'Earth must preload a source-backed starter region instead of opening blank');
assert.match(page, /DOWNLOAD LOADED REGION · GEOJSON/, 'users must be able to export the currently loaded source-backed region');
assert.match(page, /type: 'FeatureCollection'/, 'region download must be real GeoJSON');
assert.match(page, /OVERTURE PRIMARY/, 'Earth UI must expose the primary source state');
assert.match(page, /OSM FALLBACK/, 'Earth UI must expose fallback state honestly');
assert.match(page, /POLICY MODEL · BILLING DISABLED/, 'anti-monopoly economics must not appear live before the authoritative claim ledger exists');
assert.doesNotMatch(page, /Existing global claims<input/, 'users must not be asked to type fake authoritative claim counts in the main Earth flow');

assert.match(meshPanel, /OWNER SIGN-IN FOR MESHY/, 'Meshy spend controls must be owner-gated in the UI');
assert.match(meshPanel, /reference-upload/, 'owner must be able to upload rights-cleared references from an iPhone');
assert.match(meshPanel, /onClick=\{generate\}/, 'Meshy generation must require an explicit owner action');
assert.match(meshPanel, /readyReferences\.length < 2/, 'Meshy UI must require at least two ready references before generation');
assert.match(meshPanel, /setTimeout\(poll, 4000\)/, 'active Meshy jobs should poll at a bounded cadence rather than spin requests');
assert.match(meshPanel, /MeshyModelViewer/, 'completed cached GLB must render inside the Earth experience');

assert.match(uploadRoute, /requireVoxelVaultAdmin/, 'reference uploads must be owner/admin authenticated');
assert.match(uploadRoute, /MAX_BYTES = 12 \* 1024 \* 1024/, 'reference uploads must have a hard size limit');
assert.match(uploadRoute, /world-references\//, 'reference uploads must stay in a dedicated private storage namespace');
assert.match(uploadRoute, /rights\.json/, 'every uploaded image must have a stored rights sidecar');
assert.match(uploadRoute, /createSignedUrl/, 'Meshy should receive temporary signed reference URLs rather than a public bucket');

assert.match(meshRoute, /displayUrlFor/, 'Meshy route must turn private cached models into display URLs safely');
assert.match(meshRoute, /createModelSignedUrl/, 'private cached GLBs must use expiring signed URLs');
assert.match(meshRoute, /atlasIdRaw && !taskId/, 'the owner UI must be able to check cache state without starting a Meshy job');
assert.match(meshViewer, /GLTFLoader/, 'Meshy GLB viewer must load real GLB assets');
assert.match(meshViewer, /compact \? 1\.15 : 1\.35/, 'Meshy model viewer must keep a strict compact pixel-ratio cap');
assert.match(meshViewer, /time - lastRender < 33/, 'Meshy model viewer must cap compact rendering near 30fps');
assert.match(meshViewer, /prefers-reduced-motion/, 'Meshy model viewer must respect reduced motion');

console.log('World atlas rebuild checks passed: Overture PMTiles is primary, Overpass is fallback, the globe is stable and recognizable, region export works, Meshy is owner-controlled and viewable, and mobile/runtime fallbacks remain usable.');
