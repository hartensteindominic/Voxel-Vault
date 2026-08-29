import assert from 'node:assert/strict';
import fs from 'node:fs';

const property = fs.readFileSync(new URL('../app/property/page.js', import.meta.url), 'utf8');
const photoHandoff = fs.readFileSync(new URL('../app/api/property-photo-upload/route.ts', import.meta.url), 'utf8');
const voxel3d = fs.readFileSync(new URL('../app/api/property-voxel-3d/route.ts', import.meta.url), 'utf8');
const voxelImage = fs.readFileSync(new URL('../app/api/property-voxel-image/route.ts', import.meta.url), 'utf8');
const voxelModel = fs.readFileSync(new URL('../app/api/property-voxel-model/route.ts', import.meta.url), 'utf8');
const localPreview = fs.readFileSync(new URL('../app/api/property-local-preview/route.ts', import.meta.url), 'utf8');
const generationIds = fs.readFileSync(new URL('../lib/property-generation-ids.ts', import.meta.url), 'utf8');
const modelViewer = fs.readFileSync(new URL('../app/vault/earth/MeshyModelViewer.js', import.meta.url), 'utf8');
const taskRecovery = fs.readFileSync(new URL('../lib/property-generation-task.ts', import.meta.url), 'utf8');
const modelDelivery = fs.readFileSync(new URL('../lib/property-generation-model.ts', import.meta.url), 'utf8');
const meshyCredits = fs.readFileSync(new URL('../lib/meshy-credits.ts', import.meta.url), 'utf8');

// Default path: source-backed map voxel, entirely independent of Meshy credits.
assert.match(property, /function startLocalPreview\(\)/, 'photo approval must expose the local map path');
assert.match(property, /provider: 'world-atlas-local-preview'/, 'the local path must have an explicit non-Meshy provider marker');
assert.match(property, /Preview with map · 0 Meshy credits/, 'the no-credit path must be obvious in the maker');
assert.match(property, /GeoReferenceModel/, 'the local property must use the existing source-backed 3D map renderer');
assert.match(property, /\/api\/world-atlas\/inspect/, 'local preview must resolve source-backed map evidence');
assert.match(property, /\/api\/property-local-preview/, 'local voxel confirmation must use an authenticated account-bound endpoint');
assert.match(localPreview, /requireVoxelVaultUser/, 'local voxel identity must require the signed-in account');
assert.match(localPreview, /propertyLocalPreviewTaskId\(auth\.user\.id, draftId\)/, 'local voxel task identity must bind user and draft');
assert.match(localPreview, /usesMeshyCredits: false/, 'local endpoint must explicitly identify its zero-Meshy behavior');
assert.doesNotMatch(localPreview, /MESHY_API_KEY|api\.meshy\.ai|readMeshyCreditBalance/, 'the local endpoint must not touch Meshy at all');
assert.match(generationIds, /atlas-map:\$\{propertyGenerationUserScope\(userId\)\}/, 'local task IDs must be account-scoped');
assert.match(generationIds, /propertyLocalPreviewTaskBelongsToUser/, 'local collectible verification must have an exact account/draft ownership check');

// Optional enhanced path: paid photo -> source 3D -> voxel style -> final 3D.
assert.match(property, /async function usePhotoAndBuild\(\)/, 'the optional enhanced path must retain the automatic Meshy generation handoff');
assert.match(property, /form\.append\('draftId', draftId\)/, 'approved paid photo must be tied to an account-scoped creation before generation');
assert.match(property, /setSourceReference\(data\.reference\)/, 'paid direct generation reference must become the source for the automatic pipeline');
assert.match(property, /await runAutomaticBuild\(data\.reference, iteration\)/, 'a verified paid return must immediately continue the automatic build pipeline');

assert.match(photoHandoff, /data:\$\{photo\.type\};base64/, 'paid source photo must be handed directly to the 3D provider as an inline data URI');
assert.match(photoHandoff, /meshy-property-direct-photo-to-3d/, 'direct source generation must have an explicit provider marker');
assert.match(photoHandoff, /inline-photo:\$\{digest\}/, 'Voxel Vault should retain only a source-photo fingerprint in the generation record');
assert.match(photoHandoff, /storagePath: `meshy-source:\$\{taskId\}`/, 'the UI handoff should carry an opaque account-bound provider job reference');
assert.doesNotMatch(photoHandoff, /storage\.from\(|createBucket\(|createSignedUrl\(/, 'normal provider handoff after paid checkout must not add a second source-photo storage dependency');

assert.match(property, /phase: 'source'/, 'optional automatic pipeline must continue through the first 3D source phase');
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
assert.match(voxelModel, /model_storage_path/, 'the model delivery endpoint should prefer a durable cached GLB when one exists');
assert.match(voxelModel, /model_urls\?\.glb/, 'the model delivery endpoint must refresh the current Meshy GLB when the cache is unavailable');
assert.match(voxelModel, /persistModelBinary\(saved\.item_id, providerModelUrl\)/, 'a broken private GLB cache must be overwritten from the completed provider task');
assert.match(voxelModel, /without starting or charging for another generation/, 'cache repair must remain distinct from paid regeneration');

assert.match(modelViewer, /url\.pathname === '\/api\/property-voxel-model'/, 'the viewer must recognize signed property-model delivery URLs');
assert.match(modelViewer, /preview\.searchParams\.set\('preview', '1'\)/, 'the viewer must derive the rendered 3D image automatically');
assert.match(modelViewer, /3D IMAGE · LOADING INTERACTIVE 3D/, 'the rendered 3D image must be visibly staged before interactive 3D');
assert.match(modelViewer, /3D IMAGE → INTERACTIVE 3D/, 'the viewer must describe the image-to-interactive transition');
assert.match(modelViewer, /attempt < 3/, 'the 3D viewer must retry temporary model-load failures before showing an error');
assert.match(modelViewer, /previewRetry/, '3D viewer retries must bypass stale browser or edge caching');
assert.match(modelViewer, /readyRef\.current/, 'interactive controls must unlock only after the GLB has actually loaded');
assert.doesNotMatch(modelViewer, /cached Meshy GLB could not be loaded/i, 'the old non-recovering cached-GLB error must be removed');
assert.doesNotMatch(modelViewer, /Regenerating is not automatic/i, 'the viewer must not tell users a temporary GLB failure is permanently stuck');

assert.match(meshyCredits, /fullPipeline: 33/, 'the optional automatic property budget must reserve all three paid Meshy stages before starting');
assert.match(meshyCredits, /afterSource: 18/, 'the optional voxel style stage must reserve enough credits for itself plus the final 3D');
assert.match(meshyCredits, /final3d: 15/, 'the optional final textured Smart Topology 3D budget must match current Meshy pricing');
assert.match(meshyCredits, /openapi\/v1\/balance/, 'provider credit preflight must use Meshy’s balance API');
assert.match(meshyCredits, /status === 402/, 'Meshy 402 responses must be recognized as provider-credit exhaustion');
assert.match(meshyCredits, /not your wallet, bank account, card, or crypto balance/, 'credit exhaustion copy must not imply the signed-in user lacks funds');
assert.match(meshyCredits, /return status === 402 \? 503 : status/, 'provider 402 must surface as service availability rather than a user payment request');
assert.match(photoHandoff, /MESHY_PROPERTY_CREDITS\.fullPipeline/, 'paid photo upload must preflight the complete 33-credit automatic pipeline');
assert.match(voxelImage, /MESHY_PROPERTY_CREDITS\.afterSource/, 'paid voxel image creation must preflight the remaining 18-credit automatic pipeline');
assert.match(voxel3d, /MESHY_PROPERTY_CREDITS\.final3d/, 'every new textured property 3D task must preflight its 15-credit cost');
assert.match(photoHandoff, /meshyProviderFailure/, 'source 3D must translate provider credit errors to VoxelPop service errors');
assert.match(voxelImage, /meshyProviderFailure/, 'voxel styling must translate provider credit errors to VoxelPop service errors');
assert.match(voxel3d, /meshyProviderFailure/, 'final 3D must translate provider credit errors to VoxelPop service errors');

assert.match(property, /Building a first 3D model from your photo/, 'enhanced user must see the first automatic 3D processing state');
assert.match(property, /Turning the 3D into VoxelPop/, 'enhanced user must see the voxel processing state');
assert.match(property, /Building your final VoxelPop 3D/, 'enhanced user must see final voxel 3D progress');
assert.match(property, /'paused-final' : 'paused'/, 'provider failures must distinguish a preserved final-stage checkpoint from earlier recoverable pauses');
assert.match(property, /async function retryBuild\(\)/, 'paused enhanced chain must preserve a retry path');
assert.match(property, /Try build again/, 'paused early stages must expose a clear retry action');
assert.match(property, /First 3D → VoxelPop look → final 3D voxel/, 'visible enhanced copy must make the automatic handoff obvious');

assert.match(property, /function providerNeedsFunds\(value\)/, 'the UI must recognize provider credit exhaustion separately from generation failure');
assert.match(property, /finalCheckpoint = voxelDone/, 'the completed voxel image job must become a resumable final-3D checkpoint');
assert.match(property, /setPipelinePhase\(finalCheckpoint\?\.taskId \? 'paused-final' : 'paused'\)/, 'a final-stage failure must preserve the completed voxel checkpoint');
assert.match(property, /async function resumeFinal3D\(\)/, 'the completed voxel checkpoint must have a dedicated final-3D resume path');
assert.match(property, /voxelImageTaskId: voxelJob\.taskId/, 'final-3D resume must reuse the completed voxel-image job instead of creating another image');
assert.match(property, /voxelImageTaskToken: voxelJob\.taskToken/, 'final-3D resume must reuse the account-bound voxel image token');
assert.match(property, /pipelinePhase === 'paused-final' && voxelImage && voxelJob\?\.taskId && voxelJob\?\.taskToken/, 'generic retry must route final-stage pauses to the checkpoint resume path');
assert.match(property, /Resume enhanced final 3D/, 'the paused optional final stage must clearly offer a final-3D-only resume action');
assert.match(property, /Your finished VoxelPop image is preserved/, 'credit exhaustion must explain that the completed image is preserved instead of implying the entire build failed');

assert.doesNotMatch(property, /Use this street photo/, 'photo-first journey must not branch back into the old street-photo chooser');
assert.doesNotMatch(property, /autoCreateAfterPhoto/, 'old photo-to-image auto-start state should be removed in favor of the full automatic pipeline');

console.log('Property journey regression passed: authorized photo -> zero-credit source-backed local 3D map by default; optional paid Meshy pipeline still preflights credits, repairs model delivery, and resumes completed stages without re-spending them.');
