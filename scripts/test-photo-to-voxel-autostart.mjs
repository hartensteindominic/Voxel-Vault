import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/page.js');
const css = read('app/property/property.module.css');
const geo = read('app/geo/GeoReferenceModel.js');
const worldAtlas = read('lib/world-atlas.js');
const legacyCheckout = read('app/api/property-generation/checkout/route.ts');
const collectible = read('lib/property-collectible-commerce.ts');
const complete = read('app/api/property-collectible/complete/route.ts');

assert.match(property, /async function makeLocalVoxelPreview\(file\)/, 'photo approval must have an on-device VoxelPop renderer');
assert.match(property, /imageSmoothingEnabled = false/, 'local preview must keep crisp pixel/voxel edges');
assert.match(property, /toDataURL\('image\/jpeg', 0\.8\)/, 'local preview should be bounded and reusable across checkout return');
assert.match(property, /window\.localStorage\.setItem\(previewStorageKey\(draftId\), preview\)/, 'small completed preview should stay available locally across optional collection checkout');
assert.match(property, /I took this photo or have permission to use it\./, 'photo use must still require rights confirmation');
assert.match(property, /no Meshy credits · no generation checkout/i, 'the maker must clearly explain the zero-credit creation path');
assert.doesNotMatch(property, /fetch\('\/api\/property-generation\/checkout'/, 'the maker must not open the retired pre-generation checkout');
assert.doesNotMatch(property, /fetch\('\/api\/property-photo-upload'/, 'the normal property maker must not upload the source photo to start generation');
assert.doesNotMatch(property, /fetch\('\/api\/property-voxel-3d'/, 'the normal property maker must not spend Meshy 3D credits');
assert.doesNotMatch(property, /fetch\('\/api\/property-voxel-image'/, 'the normal property maker must not spend Meshy image credits');
assert.doesNotMatch(property, /MeshyModelViewer/, 'the normal maker should use map geometry instead of a provider GLB viewer');

assert.match(property, /GeoReferenceModel/, 'the maker must use the source-backed interactive 3D renderer');
assert.match(property, /\/api\/world-atlas\/inspect/, 'address verification must build from the World Atlas');
assert.match(property, /viewMode=\{mapView\}/, '3D map must support switchable camera views');
assert.match(property, /\['orbit', 'street', 'top'\]/, '3D map must expose orbit, street, and top modes');
assert.match(property, /Place this preview in My World/, '3D neighborhood review must precede My World placement');
assert.match(property, /PlanetStreamGlobe/, 'final My World preview must retain the globe experience');
assert.match(property, /`map-voxel:\$\{draftId\}`/, 'collection must use an account-draft-bound map-backed asset identifier');
assert.match(css, /\.mapStage\{/, 'property UI needs a dedicated large 3D map stage');
assert.match(css, /\.mapControls\{/, 'property UI needs touch-friendly map camera controls');
assert.match(css, /\.mapFacts\{/, 'map source and selected-building context must be visible');

assert.match(geo, /addVoxelShell/, 'source-backed building footprints must render as lightweight voxel geometry');
assert.match(geo, /addPublicRealmContext/, '3D map should include source-backed street/path context when available');
assert.match(geo, /touchAction = 'none'/, '3D map must retain iPhone drag/pinch interaction');
assert.match(worldAtlas, /fetchOvertureBuildingNeighborhood/, 'World Atlas must use Overture building data first');
assert.match(worldAtlas, /fetchGlobalNeighborhoodReference/, 'World Atlas must retain OpenStreetMap fallback coverage');
assert.match(worldAtlas, /No replacement building was invented/, 'map failures must never invent a replacement building');

assert.match(legacyCheckout, /migrated: true/, 'old pre-generation clients must be directed to the zero-credit flow');
assert.match(legacyCheckout, /no longer needs a pre-generation checkout, private photo staging, or Meshy credits/, 'legacy checkout response must explain the migration');
assert.doesNotMatch(legacyCheckout, /stagePaidPropertyPhoto|readMeshyCreditBalance|stripe\.checkout|MESHY_API_KEY/, 'retired generation checkout must not touch Storage, Stripe, or Meshy');

assert.match(collectible, /const mapBackedTaskId = `map-voxel:\$\{draftId\}`/, 'collectible verification must recognize the exact map-backed draft identifier');
assert.match(collectible, /mapBacked: true/, 'map-backed collectible verification must be explicit');
assert.match(collectible, /atlasId\.startsWith\('location:'\)/, 'map-backed collection must still require a source-backed building identity');
assert.match(complete, /source-backed-map-geometry/, 'paid map-backed collectibles must be delivered without pretending a GLB exists');
assert.match(complete, /no Meshy generation credit or private GLB storage is required/, 'delivery disclosure must describe the zero-credit asset truthfully');

console.log('Zero-credit VoxelPop property regression passed: authorized photo -> on-device voxel preview -> source-backed Overture/OSM 3D neighborhood -> private My World preview -> optional collection, with no Meshy or pre-generation Storage dependency.');
