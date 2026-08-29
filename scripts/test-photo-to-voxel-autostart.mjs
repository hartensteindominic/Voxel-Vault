import assert from 'node:assert/strict';
import fs from 'node:fs';

const property = fs.readFileSync(new URL('../app/property/page.js', import.meta.url), 'utf8');
const photoHandoff = fs.readFileSync(new URL('../app/api/property-photo-upload/route.ts', import.meta.url), 'utf8');
const voxel3d = fs.readFileSync(new URL('../app/api/property-voxel-3d/route.ts', import.meta.url), 'utf8');
const voxelImage = fs.readFileSync(new URL('../app/api/property-voxel-image/route.ts', import.meta.url), 'utf8');
const taskRecovery = fs.readFileSync(new URL('../lib/property-generation-task.ts', import.meta.url), 'utf8');

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
assert.match(property, /No extra button\. First 3D → VoxelPop look → final 3D voxel\./, 'visible copy must make the automatic handoff obvious');

assert.doesNotMatch(property, /Use this street photo/, 'photo-first journey must not branch back into the old street-photo chooser');
assert.doesNotMatch(property, /autoCreateAfterPhoto/, 'old photo-to-image auto-start state should be removed in favor of the full automatic pipeline');

console.log('Property automatic journey regression passed: authorized photo -> direct provider source 3D -> generated-3D voxel style -> final voxel 3D, including signed account-bound recovery when generation-record persistence is temporarily unavailable.');
