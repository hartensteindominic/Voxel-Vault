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

assert.match(property, /Building a first 3D model from your photo/, 'user must see the first automatic 3D processing state');
assert.match(property, /Turning the 3D into VoxelPop/, 'user must see the voxel processing state');
assert.match(property, /Building your final VoxelPop 3D/, 'user must see final voxel 3D progress');
assert.match(property, /setPipelinePhase\('paused'\)/, 'provider failure must move the automatic chain to a recoverable paused state');
assert.match(property, /async function retryBuild\(\)/, 'paused automatic chain must preserve a retry path');
assert.match(property, /Try build again/, 'paused voxel stage must expose a clear retry action');
assert.match(property, /Image first → first 3D → VoxelPop image → final movable 3D\./, 'visible copy must explain the image-first handoff into final 3D');

assert.match(property, /Keep the local photo File \+ object URL alive for the rest of this creation/, 'the source image must stay available while 3D is loading');
assert.match(property, /fallbackImageUrl=\{displaySource\}/, 'the first 3D viewer must keep the selected photo visible as its fallback');
assert.match(property, /fallbackImageUrl=\{voxelImage \|\| displaySource\}/, 'the final 3D viewer must keep the VoxelPop image visible until the GLB renders');
assert.doesNotMatch(property, /setSourceReference\(data\.reference\);\s*setPendingPhoto\(null\);\s*setPendingPreview/, 'starting a provider job must not immediately discard the visible local source photo');

assert.match(modelViewer, /fallbackImageUrl = ''/, 'Meshy viewer must support an image-first fallback');
assert.match(modelViewer, /setError\('Refreshing the saved 3D model…'\)/, 'Meshy viewer must retry an initial GLB load failure automatically');
assert.match(modelViewer, /Reload 3D/, 'Meshy viewer must expose a manual retry after an automatic retry fails');
assert.match(modelViewer, /viewerFallbackHidden/, 'fallback image must transition away only after the 3D model actually loads');
assert.doesNotMatch(modelViewer, /Regenerating is not automatic/, 'the old dead-end cached-GLB error must not return');

assert.match(voxel3d, /async function refreshPersistedModel/, 'cached 3D reuse must refresh the provider model reference before showing it');
assert.match(voxel3d, /persistModelBinary\(saved\.item_id, providerModelUrl\)/, 'fresh provider GLBs should be copied into Voxel Vault storage when possible');
assert.match(voxel3d, /cachedBinaryFallback: true/, 'a local cached GLB must remain usable if the provider status endpoint later fails');
assert.match(voxel3d, /await refreshPersistedModel\(apiKey, directJob, taskId\)/, 'direct photo jobs must refresh their GLB before reuse');
assert.match(voxel3d, /await refreshPersistedModel\(apiKey, existing, existing\?\.task_id \|\| null\)/, 'same-source generated jobs must refresh their GLB before reuse');

assert.doesNotMatch(property, /Use this street photo/, 'photo-first journey must not branch back into the old street-photo chooser');
assert.doesNotMatch(property, /autoCreateAfterPhoto/, 'old photo-to-image auto-start state should be removed in favor of the full automatic pipeline');

console.log('Property automatic journey regression passed: image stays visible -> direct provider source 3D -> generated VoxelPop image -> final movable 3D, with signed job recovery, fresh GLB refresh, cached-binary fallback, and viewer retry controls.');
