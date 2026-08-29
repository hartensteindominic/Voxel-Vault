import assert from 'node:assert/strict';
import fs from 'node:fs';

const access = fs.readFileSync(new URL('../lib/property-collectible-model-access.ts', import.meta.url), 'utf8');
const route = fs.readFileSync(new URL('../app/api/property-collectible/model/route.ts', import.meta.url), 'utf8');
const complete = fs.readFileSync(new URL('../app/api/property-collectible/complete/route.ts', import.meta.url), 'utf8');
const success = fs.readFileSync(new URL('../app/property/success/page.js', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../lib/catalog3dStore.js', import.meta.url), 'utf8');

// Enhanced generated collectibles retain private persisted-GLB access controls.
assert.match(store, /public:\s*false/, 'persisted generated collectible GLBs must remain in the private system bucket');
assert.match(store, /persistModelBinary/, 'generated GLBs must be persisted into owned storage');
assert.match(store, /createModelSignedUrl/, 'private persisted GLBs must be opened through signed URLs');
assert.match(access, /createHmac/, 'durable generated model links must use an unguessable server HMAC');
assert.match(access, /timingSafeEqual/, 'model access token comparison must be timing-safe');
assert.match(access, /STRIPE_SECRET_KEY/, 'paid-model access token derives from an existing server-only commerce secret');
assert.match(access, /property-collectible-model-v1/, 'model access token uses a purpose-specific signing domain');
assert.match(access, /readPropertyCollectibleReservation/, 'model access re-checks the durable paid reservation');
assert.match(access, /\['paid', 'minted'\]\.includes\(reservation\.state\)/, 'unpaid reservations never open generated collectible models');
assert.match(access, /reservation\.modelTaskId !== modelTaskId/, 'generated model access binds to the exact purchased model task');
assert.match(access, /readCatalog3DByTask/, 'generated model access resolves the persisted catalog row');
assert.match(access, /createModelSignedUrl\(saved\.model_storage_path, 5 \* 60\)/, 'each generated-model open issues a fresh short-lived private storage URL');
assert.match(route, /resolvePaidPropertyCollectibleModel/, 'stable generated model route verifies the opaque token and paid reservation');
assert.match(route, /NextResponse\.redirect/, 'stable generated model URL redirects to a freshly signed private GLB');
assert.match(complete, /purchase\.representationKind === 'map-voxel'/, 'post-payment delivery must explicitly distinguish storage-free map voxels');
assert.match(complete, /kind: 'map-voxel'/, 'map voxel completion must return a representation marker instead of fabricating a GLB');
assert.match(complete, /storage: 'source-backed-map-representation'/, 'map voxel completion must not depend on private model storage');
assert.match(complete, /verifyOwnedFinalVoxelModel/, 'generated completion must still verify the paid account-owned model');
assert.match(complete, /propertyCollectibleModelAccessPath/, 'generated completion retains the durable opaque app model URL');
assert.match(success, /mapVoxel \? 'source-backed-map-voxel-collectible' : 'photo-to-3d-to-voxel-collectible'/, 'Vault sync must persist the chosen representation honestly');
assert.match(success, /modelUrl: data\.model\.modelUrl/, 'generated Vault sync preserves the durable paid model URL');
assert.match(success, /modelUrl: null/, 'map voxel Vault sync stores the mapped representation without a fake generated model URL');

console.log('Collectible representation access regression passed: enhanced generated items keep private persisted GLB + paid HMAC access, while source-backed Map Voxels require no Meshy GLB or checkout model storage.');
