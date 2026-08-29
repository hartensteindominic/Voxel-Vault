import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const property = read('app/property/page.js');
const css = read('app/property/property.module.css');
const geo = read('app/geo/GeoReferenceModel.js');
const worldAtlas = read('lib/world-atlas.js');
const generationCheckout = read('app/api/property-generation/checkout/route.ts');
const payment = read('lib/property-generation-payment.ts');
const browserStore = read('lib/property-generation-browser-store.js');
const collectible = read('lib/property-collectible-commerce.ts');
const complete = read('app/api/property-collectible/complete/route.ts');

assert.match(property, /async function makeLocalVoxelPreview\(file\)/, 'paid creation must still use the zero-credit on-device VoxelPop renderer');
assert.match(property, /imageSmoothingEnabled = false/, 'local preview must keep crisp pixel\/voxel edges');
assert.match(property, /toDataURL\('image\/jpeg', 0\.8\)/, 'local preview should remain bounded and reusable');
assert.match(property, /window\.localStorage\.setItem\(previewStorageKey\(paidDraftId\), preview\)/, 'completed paid preview should stay available locally across optional collection checkout');
assert.match(property, /I took this photo or have permission to use it\./, 'photo use must still require rights confirmation');
assert.match(property, /const CREATION_PRICE_LABEL = '\$4\.99'/, 'maker must expose the $4.99 creation price');
assert.match(property, /Pay \$\{CREATION_PRICE_LABEL\} → create VoxelPop/, 'primary creation action must require payment');
assert.match(property, /savePaidPropertyPhoto\(draftId, pendingPhoto\)/, 'source photo must be retained only on-device through Stripe');
assert.match(property, /\/api\/property-generation\/checkout/, 'maker must use the server-authoritative creation checkout');
assert.match(property, /loadPaidPropertyPhoto\(data\.draftId\)/, 'paid return must restore the device-local source');
assert.match(property, /0 Meshy credits|zero Meshy credits/i, 'maker must clearly explain the zero-credit creation path');
assert.doesNotMatch(property, /fetch\('\/api\/property-photo-upload'/, 'normal paid creation must not upload the source photo for provider generation');
assert.doesNotMatch(property, /fetch\('\/api\/property-voxel-3d'/, 'normal creation must not spend Meshy 3D credits');
assert.doesNotMatch(property, /fetch\('\/api\/property-voxel-image'/, 'normal creation must not spend Meshy image credits');
assert.doesNotMatch(property, /MeshyModelViewer/, 'normal maker should use map geometry instead of a provider GLB viewer');

assert.match(payment, /PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499/, 'server-authoritative creation price must be exactly $4.99');
assert.match(payment, /session\.payment_status !== 'paid'/, 'paid return must verify Stripe payment status');
assert.match(payment, /session\.client_reference_id !== auth\.user\.id/, 'creation payment must stay account-bound');
assert.doesNotMatch(payment, /storage\.|createBucket|voxel-system|MESHY/i, 'payment verification must not depend on checkout storage or Meshy');

assert.match(browserStore, /indexedDB/, 'source photo must survive Stripe redirect in browser-only storage');
assert.match(browserStore, /MAX_AGE_MS = 24 \* 60 \* 60 \* 1000/, 'temporary on-device checkout source must expire');

assert.match(generationCheckout, /stripe\.checkout\.sessions\.create/, 'creation gate must use real server-created Stripe Checkout');
assert.match(generationCheckout, /unit_amount: PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'client cannot choose the $4.99 price');
assert.match(generationCheckout, /meshy_credits: '0'/, 'Stripe metadata must record the zero-Meshy creation engine');
assert.match(generationCheckout, /source_photo_storage: 'device_only_not_uploaded_for_creation'/, 'Stripe metadata must record device-only photo handling');
assert.match(generationCheckout, /paidPropertyGenerationReceipt/, 'return endpoint must re-verify the paid session');
assert.doesNotMatch(generationCheckout, /readMeshyCreditBalance|MESHY_PROPERTY_CREDITS|MESHY_API_KEY|storage\.|createBucket|stagePaidPropertyPhoto/, 'creation checkout must not touch Meshy or private source storage');

assert.match(property, /GeoReferenceModel/, 'maker must use the source-backed interactive 3D renderer');
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
assert.match(geo, /addPublicRealmContext/, '3D map should include source-backed street\/path context when available');
assert.match(geo, /touchAction = 'none'/, '3D map must retain iPhone drag\/pinch interaction');
assert.match(worldAtlas, /fetchOvertureBuildingNeighborhood/, 'World Atlas must use Overture building data first');
assert.match(worldAtlas, /fetchGlobalNeighborhoodReference/, 'World Atlas must retain OpenStreetMap fallback coverage');
assert.match(worldAtlas, /No replacement building was invented/, 'map failures must never invent a replacement building');

assert.match(collectible, /const mapBackedTaskId = `map-voxel:\$\{draftId\}`/, 'collectible verification must recognize the exact map-backed draft identifier');
assert.match(collectible, /mapBacked: true/, 'map-backed collectible verification must be explicit');
assert.match(collectible, /atlasId\.startsWith\('location:'\)/, 'map-backed collection must still require a source-backed building identity');
assert.match(complete, /source-backed-map-geometry/, 'paid map-backed collectibles must be delivered without pretending a GLB exists');
assert.match(complete, /no Meshy generation credit or private GLB storage is required/, 'delivery disclosure must describe the zero-credit asset truthfully');

console.log('Paid zero-credit VoxelPop property regression passed: authorized device-local photo -> server-authoritative $4.99 Stripe payment -> on-device voxel preview -> source-backed Overture\/OSM 3D neighborhood -> private My World preview -> optional collection, with zero Meshy credits and no pre-generation source upload.');
