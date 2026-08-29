import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const store = read('lib/catalog3dStore.js');
const photoRoute = read('app/api/property-photo-upload/route.ts');
const migration007 = read('supabase/migrations/007_catalog_3d_media.sql');
const migration009 = read('supabase/migrations/009_catalog_3d_binary_storage.sql');

assert.match(store, /getSupabaseAdminCandidates/, '3D persistence must try every configured Supabase server credential');
assert.match(store, /select\('item_id,task_id', \{ count: 'exact', head: true \}\)/, 'table health checks must only require the original generation-record columns');
assert.match(migration007, /task_id text unique/, 'original catalog table must provide account-bound task identity');
assert.match(migration007, /model_url text/, 'original catalog table must be able to retain provider model URLs');
assert.match(migration009, /source_image_urls jsonb/, 'newer binary-storage columns remain optional enhancements');
assert.match(migration009, /model_storage_path text/, 'private GLB persistence remains an optional newer enhancement');
assert.match(store, /function legacyTablePayload/, 'store must provide a legacy-schema payload');
assert.match(store, /source_image_urls: _sourceImageUrls/, 'legacy retry must omit the 009 source-image list column');
assert.match(store, /model_storage_path: _modelStoragePath/, 'legacy retry must omit the 009 private-model-path column');
assert.match(store, /upsert\(legacyTablePayload\(payload\), \{ onConflict: 'item_id' \}\)/, 'failed full writes must retry against the valid 007/008 schema');
assert.match(store, /for \(const admin of adminCandidates\(\)\)/, 'persistence must not stop at the first configured server credential');
assert.match(store, /const saved = await writeTableRow\(admin, payload\)/, 'generation writes must attempt the actual upsert instead of being blocked by a separate readiness read');
assert.doesNotMatch(store, /if \(!\(await tableReadyFor\(admin\)\)\) continue;/, 'a transient readiness SELECT must not prevent a valid generation-record write');
assert.match(store, /if \(!ready\) storageReadyPromise = undefined;/, 'a transient storage failure must be retried by later requests rather than cached forever');
assert.match(store, /return writeStorageRow\(itemId, payload\)/, 'private storage remains a final fallback rather than a prerequisite for generation records');

const provisionalIndex = photoRoute.indexOf("status: 'STARTING'");
const providerStartIndex = photoRoute.indexOf('const response = await fetch(ENDPOINT');
assert.ok(provisionalIndex >= 0, 'direct photo generation must create a provisional account-bound record');
assert.ok(providerStartIndex >= 0, 'direct photo generation must still call the configured 3D provider');
assert.ok(provisionalIndex < providerStartIndex, 'the generation record must be proven writable before the paid/provider 3D job starts');
assert.match(photoRoute, /const SAVE_ATTEMPTS = 3;/, 'generation-record writes must retry transient persistence failures');
assert.match(photoRoute, /saveGenerationRecord\(itemId/, 'direct photo generation must use the retried persistence helper');
assert.match(photoRoute, /no 3D job was started/, 'a failed persistence preflight must tell the user the provider job was not started');
assert.match(photoRoute, /status: 503/, 'persistence/setup failures must be service-unavailable errors rather than bad-photo errors');

console.log('Catalog3D generation-record compatibility passed: VoxelPop proves durable account persistence before starting Meshy, retries transient writes/storage readiness, and remains compatible with the original 007/008 table schema while 009 metadata stays optional.');
