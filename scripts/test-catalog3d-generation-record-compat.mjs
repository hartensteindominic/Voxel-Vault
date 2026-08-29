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
assert.match(store, /\.insert\(minimal\)/, 'minimal fallback must insert guaranteed item/task identity when no row exists');
assert.match(store, /return writeMinimalIdentityRow\(admin, payload\)/, 'rich metadata failures must fall back to guaranteed task ownership persistence');
assert.match(store, /const saved = await writeTableRow\(admin, payload\)/, 'generation writes must attempt the actual database write for each credential');
assert.doesNotMatch(store, /if \(!\(await tableReadyFor\(admin\)\)\) continue;/, 'a stale readiness read must not block a valid generation-record write');
assert.match(store, /async function storageReadyFor/, 'storage fallback must probe each configured backend independently');
assert.match(store, /Bucket listing can be temporarily unavailable/, 'storage fallback must recover when bucket listing fails transiently');
assert.match(store, /createBucket\(SYSTEM_BUCKET, \{ public: false, fileSizeLimit: '75MB' \}\)/, 'storage fallback must use idempotent bucket creation as a recovery probe');
assert.match(store, /if \(!ready\) storageReadyPromise = null/, 'transient storage readiness failures must not stay cached for a warm server lifetime');
assert.match(store, /for \(const supabase of adminCandidates\(\)\)/, 'storage writes must try every configured server credential');
assert.match(store, /storageReadyPromise = Promise\.resolve\(supabase\)/, 'a credential is cached only after a successful storage write');
assert.match(store, /return writeStorageRow\(itemId, payload\)/, 'private storage remains a final fallback rather than a prerequisite for generation records');

const reservationIndex = directPhotoRoute.indexOf('const reservation = await saveGenerationRecord');
const providerStartIndex = directPhotoRoute.indexOf('const response = await fetch(ENDPOINT');
assert.ok(reservationIndex >= 0, 'direct photo generation must reserve an account record first');
assert.ok(providerStartIndex > reservationIndex, 'VoxelPop must not start a Meshy 3D job until the account generation record is writable');
assert.match(directPhotoRoute, /const SAVE_ATTEMPTS = 3;/, 'generation-record persistence must retry transient failures');
assert.match(directPhotoRoute, /status: 'PREPARING'/, 'reserved generation records must have an explicit preparing state');
assert.match(directPhotoRoute, /no 3D job was started/, 'preflight persistence failure must tell the user no provider job was started');
assert.match(directPhotoRoute, /if \(!saved\?\.task_id\)/, 'the returned Meshy task id still must be attached to the reserved account record');
assert.match(directPhotoRoute, /after retrying/, 'task-id attachment must retry before surfacing a persistence error');

console.log('Catalog3D generation-record compatibility passed: VoxelPop reserves durable account persistence before Meshy, retries transient database/Storage failures, supports legacy 007/008 tables, and retains item/task ownership even when rich metadata writes are unavailable.');
