import assert from 'node:assert/strict';
import fs from 'node:fs';

const property = fs.readFileSync(new URL('../app/property/page.js', import.meta.url), 'utf8');
const photoHandoff = fs.readFileSync(new URL('../app/api/property-photo-upload/route.ts', import.meta.url), 'utf8');
const voxel3d = fs.readFileSync(new URL('../app/api/property-voxel-3d/route.ts', import.meta.url), 'utf8');
const voxelImage = fs.readFileSync(new URL('../app/api/property-voxel-image/route.ts', import.meta.url), 'utf8');
const taskRecovery = fs.readFileSync(new URL('../lib/property-generation-task.ts', import.meta.url), 'utf8');
const modelViewer = fs.readFileSync(new URL('../app/vault/earth/MeshyModelViewer.js', import.meta.url), 'utf8');

assert.match(property, /async function usePhotoAndBuild\(\)/, 'photo approval must own the automatic generation handoff');
assert.match(property, /form\.append\('draftId', draftId\)/, 'approved photo must be tied to an account-scoped creation before generation');
assert.match(property, /setSourceReference\(data\.reference\)/, 'direct generation reference must become the source for the automatic pipeline');
assert.match(property, /await runAutomaticBuild\(data\.reference, iteration\)/, 'approving the photo must immediately continue the automatic build pipeline');

assert.match(photoHandoff, /data:\$\{photo\.type\};base64/, 'source photo must be handed directly to the 3D provider as an inline data URI');
assert.match(photoHandoff, /meshy-property-direct-photo-to-3d/, 'direct source generation must have an explicit provider marker');
assert.match(photoHandoff, /inline-photo:\$\{digest\}/, 'Voxel Vault should retain only a source-photo fingerprint in the generation record');
assert.match(photoHandoff, /storagePath: `meshy-source:\$\{taskId\}`/, 'the UI handoff should carry an opaque account-bound provider job reference');
assert.doesNotMatch(photoHandoff, /storage\.from\(|createBucket\(|createSignedUrl\(/, 'normal VoxelPop photo creation must not require Supabase Storage');

assert.match(property, /phase: 'source'/, 'automatic pipeline must continue through the first 3D source phase');
assert.match(property, /sourceStoragePath: reference\.storagePath/, 'first 3D continuation must pass the opaque direct-job reference');
assert.match(voxel3d, /sourceStoragePath\.startsWith\('meshy-source:'\)/, '3D route must recognize a pre-started direct photo job');
assert.match(voxel3d, /directJob\.item_id !== itemId/, 'persisted pre-started direct jobs must remain account and draft bound');
assert.match(property, /source3dTaskId: sourceDone\.taskId/, 'voxel style pass must start from the completed first 3D preview');
assert.match(property, /voxelImageTaskId: voxelDone\.taskId/, 'final 3D must use the verified completed voxel-image job');
assert.match(property, /voxelImageTaskToken: voxelDone\.taskToken/, 'final 3D must carry the account-bound voxel image task token');
assert.match(property, /phase: 'voxel'/, 'automatic pipeline must build a distinct final voxel 3D phase');

assert.doesNotMatch(photoHandoff, /account generation record could not be saved/, 'a started provider job must not be orphaned solely because catalog persistence is temporarily unavailable');
assert.match(photoHandoff, /createPropertyGenerationRecoveryTaskId/, 'photo handoff must issue a signed recovery task reference when persistence fails');
assert.match(voxel3d, /verifyPropertyGenerationRecoveryTaskId\(apiKey, auth\.user\.id, taskId\)/, '3D polling must verify account-bound recovery task references');
assert.match(voxel3d, /recoveryMode: true/, '3D polling must expose a recoverable provider-backed path when storage is unavailable');
assert.match(voxelImage, /recoveredGenerated3DReference/, 'voxel styling must accept a verified recovered source 3D job');
assert.match(voxelImage, /verifyPropertyGenerationRecoveryTaskId\(apiKey, userId, sourceTaskId\)/, 'voxel styling must verify recovery ownership before using the generated preview');
assert.match(taskRecovery, /createHmac\('sha256', secret\)/, 'recovery task references must be signed server-side');
assert.match(taskRecovery, /property-voxel-recovery-v1:\$\{userId\}:\$\{providerTaskId\}/, 'recovery signatures must bind the provider task to the signed-in account');
assert.match(taskRecovery, /timingSafeEqual/, 'recovery signature verification must use constant-time comparison');

assert.match(voxel3d, /async function refreshPersistedModel/, 'saved 3D jobs must refresh their Meshy provider state before reuse');
assert.match(voxel3d, /await refreshPersistedModel\(apiKey, directJob, taskId\)/, 'direct-photo jobs must refresh an old provider GLB before reuse');
assert.match(voxel3d, /await refreshPersistedModel\(apiKey, existing, existing\?\.task_id \|\| null\)/, 'same-source generated jobs must refresh an old provider GLB before reuse');
assert.match(voxel3d, /cachedBinaryFallback: true/, 'durable private GLB storage must remain a fallback if Meshy can no longer refresh a job');
assert.match(voxel3d, /needsRebuild: true/, 'an expired provider URL without a durable GLB must fail closed into a rebuild path rather than returning a dead URL');
assert.match(voxel3d, /persistModelBinary\(saved\.item_id, providerModelUrl\)/, 'fresh provider GLBs should be persisted when durable storage is available');

assert.match(modelViewer, /fallbackImageUrl = ''/, '3D viewer must support an image-first fallback');
assert.match(modelViewer, /Refreshing the saved 3D model/, 'viewer must retry a failed GLB load automatically');
assert.match(modelViewer, /vv_reload/, 'viewer retry must bypass a stale browser or edge cache');
assert.match(modelViewer, /Reload 3D/, 'viewer must offer an explicit reload control after its automatic retry');
assert.match(modelViewer, /viewerFallbackHidden/, 'the fallback image must disappear only after the GLB actually renders');
assert.match(modelViewer, /IMAGE FIRST · LOADING 3D/, 'viewer must clearly communicate image-first loading');
assert.doesNotMatch(modelViewer, /Regenerating is not automatic/, 'the old dead-end cached GLB message must not return');

assert.match(property, /Keep the local photo File \+ object URL alive for this creation/, 'the selected source image must stay available during the complete creation flow');
assert.match(property, /fallbackImageUrl=\{displaySource\}/, 'the first 3D must keep the selected photo visible until rendering succeeds');
assert.match(property, /fallbackImageUrl=\{voxelImage \|\| displaySource\}/, 'the final 3D must keep the VoxelPop image visible until rendering succeeds');
assert.doesNotMatch(property, /setSourceReference\(data\.reference\);\s*setPendingPhoto\(null\);\s*setPendingPreview/, 'starting generation must not immediately throw away the visible source image');
assert.match(property, /if \(pendingPhoto && rightsConfirmed\)/, 'a paused build must be able to start a fresh provider job from the retained photo');
assert.match(property, /await usePhotoAndBuild\(\)/, 'the paused build retry must re-upload the retained photo when needed');

assert.match(property, /Building a first 3D model from your photo/, 'user must see the first automatic 3D processing state');
assert.match(property, /Turning the 3D into VoxelPop/, 'user must see the voxel processing state');
assert.match(property, /Building your final VoxelPop 3D/, 'user must see final voxel 3D progress');
assert.match(property, /setPipelinePhase\('paused'\)/, 'provider failure must move the automatic chain to a recoverable paused state');
assert.match(property, /Rebuild from photo/, 'paused generation must expose the fresh-photo rebuild action');
assert.match(property, /Image first → first 3D → VoxelPop image → final movable 3D\./, 'visible copy must explain the image-first handoff into final 3D');

assert.doesNotMatch(property, /Use this street photo/, 'photo-first journey must not branch back into the old street-photo chooser');
assert.doesNotMatch(property, /autoCreateAfterPhoto/, 'old photo-to-image auto-start state should be removed in favor of the full automatic pipeline');

console.log('Property automatic journey regression passed: source image stays visible -> fresh Meshy source 3D -> VoxelPop image -> final movable 3D, with provider-link refresh, durable GLB fallback, and rebuild recovery.');
