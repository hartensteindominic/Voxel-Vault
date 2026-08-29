import assert from 'node:assert/strict';
import fs from 'node:fs';

const property = fs.readFileSync(new URL('../app/property/page.js', import.meta.url), 'utf8');

assert.match(property, /async function usePhotoAndBuild\(\)/, 'photo approval must own the automatic generation handoff');
assert.match(property, /form\.append\('draftId', draftId\)/, 'approved photo must be tied to an account-scoped creation before generation');
assert.match(property, /setSourceReference\(data\.reference\)/, 'private uploaded reference must become the source for the automatic pipeline');
assert.match(property, /await runAutomaticBuild\(data\.reference, iteration\)/, 'approving the photo must immediately start the automatic build pipeline');

assert.match(property, /phase: 'source'/, 'automatic pipeline must build a first 3D from the authorized photo');
assert.match(property, /sourceStoragePath: reference\.storagePath/, 'first 3D must use the private source-photo storage path rather than an arbitrary browser URL');
assert.match(property, /source3dTaskId: sourceDone\.taskId/, 'voxel style pass must start from the completed first 3D preview');
assert.match(property, /voxelImageTaskId: voxelDone\.taskId/, 'final 3D must use the verified completed voxel-image job');
assert.match(property, /voxelImageTaskToken: voxelDone\.taskToken/, 'final 3D must carry the account-bound voxel image task token');
assert.match(property, /phase: 'voxel'/, 'automatic pipeline must build a distinct final voxel 3D phase');

assert.match(property, /Building the first 3D version from your photo/, 'user must see the first automatic 3D processing state');
assert.match(property, /Turning the 3D into VoxelPop/, 'user must see the voxel processing state');
assert.match(property, /Building your final VoxelPop 3D/, 'user must see final voxel 3D progress');
assert.match(property, /setPipelinePhase\('paused'\)/, 'provider failure must move the automatic chain to a recoverable paused state');
assert.match(property, /async function retryBuild\(\)/, 'paused automatic chain must preserve a retry path');
assert.match(property, /Try build again/, 'paused voxel stage must expose a clear retry action');

assert.doesNotMatch(property, /Use this street photo/, 'photo-first journey must not branch back into the old street-photo chooser');
assert.doesNotMatch(property, /autoCreateAfterPhoto/, 'old photo-to-image auto-start state should be removed in favor of the full automatic pipeline');

console.log('Property automatic journey regression passed: approved private photo -> source 3D -> generated-3D voxel style -> final voxel 3D, with visible progress and a safe retry path.');
