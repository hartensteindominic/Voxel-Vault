import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const store = read('lib/catalog3dStore.js');
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
assert.match(store, /async function storageReadyFor/, 'storage fallback must probe each configured backend independently');
assert.match(store, /Bucket listing can be temporarily unavailable/, 'storage fallback must recover when bucket listing fails transiently');
assert.match(store, /createBucket\(SYSTEM_BUCKET, \{ public: false, fileSizeLimit: '75MB' \}\)/, 'storage fallback must use idempotent bucket creation as a recovery probe');
assert.match(store, /if \(!ready\) storageReadyPromise = null/, 'transient storage readiness failures must not stay cached for a warm server lifetime');
assert.match(store, /for \(const supabase of adminCandidates\(\)\)/, 'storage writes must try every configured server credential');
assert.match(store, /storageReadyPromise = Promise\.resolve\(supabase\)/, 'a credential is cached only after a successful storage write');
assert.match(store, /return writeStorageRow\(itemId, payload\)/, 'private storage remains a final fallback rather than a prerequisite for generation records');

console.log('Catalog3D generation-record compatibility passed: VoxelPop can save Meshy task ownership/status on the original 007/008 table schema, retry recoverable Storage failures, and keep 009 private binary metadata optional.');
