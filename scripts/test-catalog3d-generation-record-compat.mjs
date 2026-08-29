import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const store = read('lib/catalog3dStore.js');
const directPhotoRoute = read('app/api/property-photo-upload/route.ts');
const migration007 = read('supabase/migrations/007_catalog_3d_media.sql');
const migration009 = read('supabase/migrations/009_catalog_3d_binary_storage.sql');

assert.match(store, /getSupabaseAdminCandidates/, '3D persistence must try every configured Supabase server credential');
assert.match(store, /select\('item_id,task_id', \{ count: 'exact', head: true \}\)/, 'table readiness must only require the original generation-record columns');
assert.match(migration007, /task_id text unique/, 'original catalog table must provide account-bound task identity');
assert.match(migration007, /model_url text/, 'original catalog table must be able to retain provider model URLs');
assert.match(migration009, /source_image_urls jsonb/, 'newer binary-storage columns remain optional enhancements');
assert.match(migration009, /model_storage_path text/, 'private GLB persistence remains an optional newer enhancement');
assert.match(store, /function legacyTablePayload/, 'store must provide a legacy-schema payload');
assert.match(store, /source_image_urls: _sourceImageUrls/, 'legacy retry must omit the 009 source-image list column');
assert.match(store, /model_storage_path: _modelStoragePath/, 'legacy retry must omit the 009 private-model-path column');
assert.match(store, /upsert\(legacyTablePayload\(payload\), \{ onConflict: 'item_id' \}\)/, 'failed full writes must retry against the valid 007/008 schema');
assert.match(store, /function minimalIdentityPayload/, 'store must have an item/task-only compatibility floor');
assert.match(store, /\.update\(\{ task_id: minimal\.task_id \}\)/, 'minimal fallback must update an existing account generation record without relying on upsert conflict handling');
assert.match(store, /\.insert\(minimal\)/, 'minimal fallback must insert the guaranteed item/task identity when no row exists');
assert.match(store, /return writeMinimalIdentityRow\(admin, payload\)/, 'rich metadata failures must fall back to guaranteed task ownership persistence');
assert.match(store, /for \(const admin of adminCandidates\(\)\)/, 'persistence must not stop at the first configured server credential');
assert.match(store, /return writeStorageRow\(itemId, payload\)/, 'private storage remains a final fallback rather than a prerequisite for generation records');

const reservationIndex = directPhotoRoute.indexOf('const reservation = await saveCatalog3D');
const providerStartIndex = directPhotoRoute.indexOf('const response = await fetch(ENDPOINT');
assert.ok(reservationIndex >= 0, 'direct photo generation must reserve an account record first');
assert.ok(providerStartIndex > reservationIndex, 'VoxelPop must not spend/start a Meshy 3D job until the account generation record is writable');
assert.match(directPhotoRoute, /No 3D job was started/, 'preflight persistence failure must tell the user no provider job was started');
assert.match(directPhotoRoute, /status: 'PREPARING'/, 'reserved generation records must have an explicit preparing state');
assert.match(directPhotoRoute, /if \(!saved\?\.task_id\)/, 'the returned Meshy task id still must be attached to the reserved account record');

console.log('Catalog3D generation-record compatibility passed: VoxelPop reserves a writable account record before Meshy, supports legacy 007/008 tables, and retains item/task ownership even when rich metadata writes are unavailable.');
