import assert from 'node:assert/strict';
import fs from 'node:fs';

const property = fs.readFileSync(new URL('../app/property/page.js', import.meta.url), 'utf8');
const photoHandoff = fs.readFileSync(new URL('../app/api/property-photo-upload/route.ts', import.meta.url), 'utf8');
const voxel3d = fs.readFileSync(new URL('../app/api/property-voxel-3d/route.ts', import.meta.url), 'utf8');
const voxelImage = fs.readFileSync(new URL('../app/api/property-voxel-image/route.ts', import.meta.url), 'utf8');
const taskHandle = fs.readFileSync(new URL('../lib/property-3d-task-handle.ts', import.meta.url), 'utf8');

assert.match(property, /async function usePhotoAndBuild\(\)/, 'photo approval must own the automatic generation handoff');
assert.match(property, /form\.append\('draftId', draftId\)/, 'approved photo must be tied to an account-scoped creation before generation');
assert.match(property, /setSourceReference\(data\.reference\)/, 'direct generation reference must become the source for the automatic pipeline');
assert.match(property, /await runAutomaticBuild\(data\.reference, iteration\)/, 'approving the photo must immediately continue the automatic build pipeline');

assert.match(photoHandoff, /data:\$\{photo\.type\};base64/, 'source photo must be handed directly to the 3D provider as an inline data URI');
assert.match(photoHandoff, /meshy-property-direct-photo-to-3d/, 'direct source generation must have an explicit provider marker');
assert.match(photoHandoff, /inline-photo:\$\{digest\}/, 'Voxel Vault should retain only a source-photo fingerprint in the generation record');
assert.match(photoHandoff, /storagePath: `meshy-source:\$\{taskId\}`/, 'the UI handoff should carry an opaque account-bound provider job reference');
assert.match(photoHandoff, /createProperty3DTaskHandle\(apiKey, auth\.user\.id, itemId, providerTaskId\)/, 'started Meshy jobs must receive a signed account-bound recovery handle before persistence is attempted');
assert.match(photoHandoff, /persistence: saved \? 'saved' : 'recoverable'/, 'photo handoff must continue safely when the first durable record write is temporarily unavailable');
assert.doesNotMatch(photoHandoff, /account generation record could not be saved/i, 'a successful provider start must not be discarded just because the first account-record write failed');
assert.doesNotMatch(photoHandoff, /storage\.from\(|createBucket\(|createSignedUrl\(/, 'normal VoxelPop photo creation must not require source-photo Supabase Storage');

assert.match(taskHandle, /createHmac/, 'recovery handles must be signed, not naked provider ids');
assert.match(taskHandle, /timingSafeEqual/, 'signed handle verification must use timing-safe signature comparison');
assert.match(taskHandle, /voxel-vault-property-3d-v1:/, 'recovery signature must be domain separated');
assert.match(taskHandle, /property-voxel:task:v1:/, 'new recoverable handles must remain opaque task-shaped ids for client compatibility');

assert.match(property, /phase: 'source'/, 'automatic pipeline must continue through the first 3D source phase');
assert.match(property, /sourceStoragePath: reference\.storagePath/, 'first 3D continuation must pass the opaque direct-job reference');
assert.match(voxel3d, /sourceStoragePath\.startsWith\('meshy-source:'\)/, '3D route must recognize a pre-started direct photo job');
assert.match(voxel3d, /recoverableTaskRecord\(apiKey, auth\.user\.id, taskId, itemId\)/, 'pre-started direct jobs must use account-bound recovery when their initial row is absent');
assert.match(voxel3d, /verifyProperty3DTaskHandle\(apiKey, userId, taskId\)/, '3D status must verify signed ownership before repairing a missing account record');
assert.match(voxel3d, /propertyGenerationItemBelongsToUser\(userId, verified\.itemId\)/, 'recovered item ids must remain scoped to the signed-in user');
assert.match(voxel3d, /property3DProviderTaskId\(taskId\)/, 'provider polling must unwrap both signed and legacy task handles safely');
assert.match(voxel3d, /createProperty3DTaskHandle\(apiKey, auth\.user\.id, itemId, providerTaskId\)/, 'final voxel 3D jobs must receive the same recovery protection as source jobs');

assert.match(property, /source3dTaskId: sourceDone\.taskId/, 'voxel style pass must start from the completed first 3D preview');
assert.match(voxelImage, /generated3DReference\(apiKey, auth\.user\.id, draftId, body\?\.source3dTaskId\)/, 'voxel styling must receive the API secret context needed to verify source recovery handles');
assert.match(voxelImage, /verifyProperty3DTaskHandle\(apiKey, userId, sourceTaskId\)/, 'voxel styling must verify a missing source row from the signed handle rather than trusting a raw task id');
assert.match(voxelImage, /SOURCE_3D_ENDPOINT/, 'voxel styling must be able to verify the completed provider task when persistence is still recovering');
assert.match(property, /voxelImageTaskId: voxelDone\.taskId/, 'final 3D must use the verified completed voxel-image job');
assert.match(property, /voxelImageTaskToken: voxelDone\.taskToken/, 'final 3D must carry the account-bound voxel image task token');
assert.match(property, /phase: 'voxel'/, 'automatic pipeline must build a distinct final voxel 3D phase');

assert.match(property, /Building a first 3D model from your photo/, 'user must see the first automatic 3D processing state');
assert.match(property, /Turning the 3D into VoxelPop/, 'user must see the voxel processing state');
assert.match(property, /Building your final VoxelPop 3D/, 'user must see final voxel 3D progress');
assert.match(property, /setPipelinePhase\('paused'\)/, 'provider failure must move the automatic chain to a recoverable paused state');
assert.match(property, /async function retryBuild\(\)/, 'paused automatic chain must preserve a retry path');
assert.match(property, /Try build again/, 'paused voxel stage must expose a clear retry action');
assert.match(property, /No extra button\. First 3D → VoxelPop look → final 3D voxel\./, 'visible copy must make the automatic handoff obvious');

assert.doesNotMatch(property, /Use this street photo/, 'photo-first journey must not branch back into the old street-photo chooser');
assert.doesNotMatch(property, /autoCreateAfterPhoto/, 'old photo-to-image auto-start state should be removed in favor of the full automatic pipeline');

console.log('Property automatic journey regression passed: authorized photo -> recoverable account-bound source 3D -> generated-3D voxel style -> recoverable final voxel 3D, without requiring source-photo bucket storage.');
