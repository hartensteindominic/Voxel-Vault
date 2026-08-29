import assert from 'node:assert/strict';
import fs from 'node:fs';

const access = fs.readFileSync(new URL('../lib/property-collectible-model-access.ts', import.meta.url), 'utf8');
const route = fs.readFileSync(new URL('../app/api/property-collectible/model/route.ts', import.meta.url), 'utf8');
const complete = fs.readFileSync(new URL('../app/api/property-collectible/complete/route.ts', import.meta.url), 'utf8');
const success = fs.readFileSync(new URL('../app/property/success/page.js', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../lib/catalog3dStore.js', import.meta.url), 'utf8');

assert.match(store, /public:\s*false/, 'persisted collectible GLBs must remain in the private system bucket');
assert.match(store, /persistModelBinary/, 'generated GLBs must be persisted into owned storage');
assert.match(store, /createModelSignedUrl/, 'private persisted GLBs must be opened through signed URLs');

assert.match(access, /createHmac/, 'durable collectible model links must use an unguessable server HMAC');
assert.match(access, /timingSafeEqual/, 'model access token comparison must be timing-safe');
assert.match(access, /STRIPE_SECRET_KEY/, 'paid-model access token must derive from an existing server-only commerce secret');
assert.match(access, /property-collectible-model-v1/, 'model access token must use a purpose-specific signing domain');
assert.match(access, /readPropertyCollectibleReservation/, 'model access must re-check the durable paid reservation');
assert.match(access, /\['paid', 'minted'\]\.includes\(reservation\.state\)/, 'unpaid or released reservations must never open collectible models');
assert.match(access, /reservation\.modelTaskId !== modelTaskId/, 'model access must bind to the exact purchased final model task');
assert.match(access, /readCatalog3DByTask/, 'model access must resolve the persisted catalog row rather than trusting a client URL');
assert.match(access, /createModelSignedUrl\(saved\.model_storage_path, 5 \* 60\)/, 'each model open should mint a fresh short-lived private storage URL');

assert.match(route, /resolvePaidPropertyCollectibleModel/, 'stable app model route must verify the opaque token and paid reservation before redirecting');
assert.match(route, /NextResponse\.redirect/, 'stable model URL should redirect the viewer to the freshly signed private GLB');
assert.match(route, /Cache-Control': 'private, no-store/, 'stable model redirect must not be publicly cached');
assert.match(complete, /propertyCollectibleModelAccessPath/, 'post-payment delivery must return the durable opaque app model URL');
assert.match(complete, /modelUrl: durableModelUrl/, 'success payload must not save a one-hour Supabase signed URL as permanent Vault state');
assert.match(success, /modelUrl: data\.model\.modelUrl/, 'Vault sync must preserve the durable paid model URL returned by completion');

console.log('Paid property collectible model access regression passed: private persisted GLB + durable opaque app link + paid-reservation verification + fresh short-lived storage URL on every open.');
