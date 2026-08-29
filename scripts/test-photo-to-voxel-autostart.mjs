import assert from 'node:assert/strict';
import fs from 'node:fs';

const property = fs.readFileSync(new URL('../app/property/page.js', import.meta.url), 'utf8');
const photoHandoff = fs.readFileSync(new URL('../app/api/property-photo-upload/route.ts', import.meta.url), 'utf8');
const voxel3d = fs.readFileSync(new URL('../app/api/property-voxel-3d/route.ts', import.meta.url), 'utf8');
const voxelImage = fs.readFileSync(new URL('../app/api/property-voxel-image/route.ts', import.meta.url), 'utf8');
const voxelModel = fs.readFileSync(new URL('../app/api/property-voxel-model/route.ts', import.meta.url), 'utf8');
const modelViewer = fs.readFileSync(new URL('../app/vault/earth/MeshyModelViewer.js', import.meta.url), 'utf8');
const taskRecovery = fs.readFileSync(new URL('../lib/property-generation-task.ts', import.meta.url), 'utf8');
const modelDelivery = fs.readFileSync(new URL('../lib/property-generation-model.ts', import.meta.url), 'utf8');

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

assert.match(voxelImage, /freshGenerated3DThumbnail/, 'voxel styling must refresh the provider thumbnail instead of trusting a cached signed URL');
assert.match(voxelImage, /stableReferenceDataUri/, 'voxel styling must snapshot the refreshed thumbnail before creating the next provider task');
assert.match(voxelImage, /data:\$\{contentType\};base64/, 'the voxel style provider must receive a stable data URI rather than a temporary Meshy thumbnail URL');
assert.match(modelDelivery, /property-voxel-model-v1:/, '3D model delivery links must be server-signed');
assert.match(modelDelivery, /timingSafeEqual/, '3D model delivery signatures must use constant-time comparison');
assert.match(voxel3d, /propertyGenerationModelUrl\(apiKey, taskId\)/, '3D polling must return a same-origin model delivery URL for recovery jobs');
assert.match(voxel3d, /displayUrlFor\(finalRow, apiKey\)/, 'persisted 3D polling must return the same-origin model delivery URL');
assert.match(voxelModel, /verifyPropertyGenerationModelToken/, 'the model delivery endpoint must reject unsigned model requests');
assert.match(voxelModel, /wantsPreview = url\.searchParams\.get\('preview'\) === '1'/, 'the signed model endpoint must expose a rendered 3D image mode');
assert.match(voxelModel, /alpha_thumbnail_url \|\| refreshed\.task\?\.thumbnail_url/, 'thumbnail mode must use the Meshy rendered preview');
assert.match(voxelModel, /forceProviderRepair = url\.searchParams\.has\('previewRetry'\)/, 'a viewer retry must explicitly enter provider-backed repair mode');
assert.match(voxelModel, /!forceProviderRepair && saved\?\.model_storage_path/, 'a viewer retry must bypass a corrupt-but-present private GLB instead of serving the same bytes again');
assert.match(voxelModel, /model_urls\?\.glb/, 'the model delivery endpoint must refresh the current Meshy GLB when cache repair is required');
assert.match(voxelModel, /persistModelBinary\(saved\.item_id, providerModelUrl\)/, 'a broken private GLB cache must be overwritten from the completed provider task');
assert.match(voxelModel, /X-Voxel-Vault-Model-Repaired/, 'repaired model responses must be explicitly marked and sent without reusable caching');
assert.match(voxelModel, /never starts or charges for another/, 'cache repair must remain distinct from paid regeneration');

assert.match(modelViewer, /url\.pathname === '\/api\/property-voxel-model'/, 'the viewer must recognize signed property-model delivery URLs');
assert.match(modelViewer, /preview\.searchParams\.set\('preview', '1'\)/, 'the viewer must derive the rendered 3D image automatically');
assert.match(modelViewer, /3D IMAGE · LOADING INTERACTIVE 3D/, 'the rendered 3D image must be visibly staged before interactive 3D');
assert.match(modelViewer, /3D IMAGE → INTERACTIVE 3D/, 'the viewer must describe the image-to-interactive transition');
assert.match(modelViewer, /attempt < 3/, 'the 3D viewer must retry temporary model-load failures before showing an error');
assert.match(modelViewer, /previewRetry/, '3D viewer retries must request provider-backed repair and bypass stale browser or edge caching');
assert.match(modelViewer, /readyRef\.current/, 'interactive controls must unlock only after the GLB has actually loaded');
assert.doesNotMatch(modelViewer, /cached Meshy GLB could not be loaded/i, 'the old non-recovering cached-GLB error must be removed');
assert.doesNotMatch(modelViewer, /Regenerating is not automatic/i, 'the viewer must not tell users a temporary GLB failure is permanently stuck');

assert.match(property, /Building a first 3D model from your photo/, 'user must see the first automatic 3D processing state');
assert.match(property, /Turning the 3D into VoxelPop/, 'user must see the voxel processing state');
assert.match(property, /Building your final VoxelPop 3D/, 'user must see final voxel 3D progress');
assert.match(property, /setPipelinePhase\('paused'\)/, 'provider failure must move the automatic chain to a recoverable paused state');
assert.match(property, /async function retryBuild\(\)/, 'paused automatic chain must preserve a retry path');
assert.match(property, /Try build again/, 'paused voxel stage must expose a clear retry action');
assert.match(property, /No extra button\. First 3D → VoxelPop look → final 3D voxel\./, 'visible copy must make the automatic handoff obvious');

assert.doesNotMatch(property, /Use this street photo/, 'photo-first journey must not branch back into the old street-photo chooser');
assert.doesNotMatch(property, /autoCreateAfterPhoto/, 'old photo-to-image auto-start state should be removed in favor of the full automatic pipeline');

console.log('Property automatic journey regression passed: Meshy render shows before interactive 3D, and a corrupt cached GLB self-repairs from the completed provider job without starting another generation.');
