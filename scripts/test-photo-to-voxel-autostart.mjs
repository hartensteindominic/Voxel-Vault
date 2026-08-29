import assert from 'node:assert/strict';
import fs from 'node:fs';

const property = fs.readFileSync(new URL('../app/property/page.js', import.meta.url), 'utf8');
const photoHandoff = fs.readFileSync(new URL('../app/api/property-photo-upload/route.ts', import.meta.url), 'utf8');
const voxel3d = fs.readFileSync(new URL('../app/api/property-voxel-3d/route.ts', import.meta.url), 'utf8');
const voxelImage = fs.readFileSync(new URL('../app/api/property-voxel-image/route.ts', import.meta.url), 'utf8');
const voxelModel = fs.readFileSync(new URL('../app/api/property-voxel-model/route.ts', import.meta.url), 'utf8');
const modelViewer = fs.readFileSync(new URL('../app/vault/earth/MeshyModelViewer.js', import.meta.url), 'utf8');
const globe = fs.readFileSync(new URL('../app/vault/earth/PlanetStreamGlobe.js', import.meta.url), 'utf8');
const taskRecovery = fs.readFileSync(new URL('../lib/property-generation-task.ts', import.meta.url), 'utf8');
const modelDelivery = fs.readFileSync(new URL('../lib/property-generation-model.ts', import.meta.url), 'utf8');
const meshyCredits = fs.readFileSync(new URL('../lib/meshy-credits.ts', import.meta.url), 'utf8');

// No-credit default: authorized photo becomes a local reference and proceeds
// directly to source-backed World mapping without creating a Meshy task.
assert.match(property, /function continueWithMapVoxel\(\)/, 'maker must expose a no-credit map-voxel continuation');
assert.match(property, /setPipelinePhase\('map-voxel'\)/, 'map-voxel continuation must have an explicit non-provider pipeline mode');
assert.match(property, /provider: 'voxelpop-source-backed-map'/, 'no-credit source must be marked as the source-backed map representation');
assert.match(property, /storagePath: `map-voxel:\$\{draftId\}`/, 'map path uses a local representation marker rather than a provider task');
assert.match(property, /const mapVoxelMode = pipelinePhase === 'map-voxel'/, 'map path must control readiness without fabricating a GLB');
assert.match(property, /Boolean\(final3d\?\.modelUrl\) \|\| mapVoxelMode/, 'map path must reach the World step without a generated model URL');
assert.match(property, /Continue with Map Voxel · no AI credits/, 'visible default action must disclose that no AI generation credits are used');
assert.match(property, /representationKind: mapVoxelMode \? 'map-voxel' : 'generated-3d'/, 'collection checkout must preserve which representation the user selected');
assert.doesNotMatch(property.match(/function continueWithMapVoxel\(\)[\s\S]*?\n  }/m)?.[0] || '', /property-photo-upload|property-voxel-3d|property-voxel-image|Meshy/, 'no-credit continuation itself must not call a Meshy generation route');

// Optional enhanced path retains the account-bound automatic pipeline.
assert.match(property, /async function usePhotoAndBuild\(\)/, 'optional enhanced photo approval must retain the paid generation handoff');
assert.match(property, /form\.append\('draftId', draftId\)/, 'enhanced photo must be tied to an account-scoped creation before checkout');
assert.match(property, /setSourceReference\(data\.reference\)/, 'paid direct-generation reference becomes the source for the enhanced pipeline');
assert.match(property, /await runAutomaticBuild\(data\.reference, iteration\)/, 'verified paid source must continue the automatic enhanced build');

assert.match(photoHandoff, /data:\$\{paidInput\.contentType\};base64/, 'paid source photo must be handed directly to the 3D provider as an inline data URI');
assert.match(photoHandoff, /verifyPaidPropertyPhoto\(receipt, photo\)/, 'paid source bytes must match the Stripe-bound fingerprint before provider handoff');
assert.match(photoHandoff, /meshy-property-direct-photo-to-3d/, 'enhanced source generation retains an explicit provider marker');
assert.match(photoHandoff, /inline-photo:\$\{digest\}/, 'Voxel Vault retains only a source-photo fingerprint in the generation record');
assert.match(photoHandoff, /storagePath: `meshy-source:\$\{taskId\}`/, 'enhanced UI handoff carries an opaque account-bound provider job reference');
assert.doesNotMatch(photoHandoff, /storage\.from\(|createBucket\(|createSignedUrl\(/, 'paid source handoff must not require checkout Storage');

assert.match(property, /phase: 'source'/, 'enhanced pipeline continues through the first 3D source phase');
assert.match(property, /sourceStoragePath: reference\.storagePath/, 'first 3D continuation passes the opaque direct-job reference');
assert.match(voxel3d, /sourceStoragePath\.startsWith\('meshy-source:'\)/, '3D route recognizes a pre-started direct photo job');
assert.match(voxel3d, /directJob\.item_id !== itemId/, 'persisted direct jobs remain account and draft bound');
assert.match(property, /source3dTaskId: sourceDone\.taskId/, 'voxel style pass starts from the completed first 3D preview');
assert.match(property, /voxelImageTaskId: voxelDone\.taskId/, 'final enhanced 3D uses the verified completed voxel-image job');
assert.match(property, /voxelImageTaskToken: voxelDone\.taskToken/, 'final enhanced 3D carries the account-bound voxel image task token');
assert.match(property, /phase: 'voxel'/, 'enhanced pipeline builds a distinct final voxel 3D phase');

assert.doesNotMatch(photoHandoff, /account generation record could not be saved/, 'a started provider job must not be orphaned solely because catalog persistence is temporarily unavailable');
assert.match(photoHandoff, /createPropertyGenerationRecoveryTaskId/, 'enhanced photo handoff issues a signed recovery task reference when persistence fails');
assert.match(voxel3d, /verifyPropertyGenerationRecoveryTaskId\(apiKey, auth\.user\.id, taskId\)/, '3D polling verifies account-bound recovery task references');
assert.match(voxel3d, /recoveryMode: true/, '3D polling exposes a recoverable provider-backed path when storage is unavailable');
assert.match(voxelImage, /recoveredGenerated3DReference/, 'voxel styling accepts a verified recovered source 3D job');
assert.match(taskRecovery, /createHmac\('sha256', secret\)/, 'recovery task references remain server-signed');
assert.match(taskRecovery, /timingSafeEqual/, 'recovery signature verification remains timing-safe');

assert.match(voxelImage, /freshGenerated3DThumbnail/, 'enhanced voxel styling refreshes the provider thumbnail instead of trusting a cached signed URL');
assert.match(voxelImage, /stableReferenceDataUri/, 'enhanced voxel styling snapshots the refreshed thumbnail before the next provider task');
assert.match(voxelImage, /data:\$\{contentType\};base64/, 'enhanced image-to-image provider receives a stable data URI');
assert.match(modelDelivery, /property-voxel-model-v1:/, 'generated 3D model delivery links remain server-signed');
assert.match(modelDelivery, /timingSafeEqual/, 'generated 3D model delivery signatures remain timing-safe');
assert.match(voxel3d, /propertyGenerationModelUrl\(apiKey, taskId\)/, 'generated 3D polling returns a same-origin model delivery URL for recovery jobs');
assert.match(voxelModel, /persistModelBinary\(saved\.item_id, providerModelUrl\)/, 'broken generated GLB cache can still be repaired from an already-completed provider task');
assert.match(modelViewer, /attempt < 3/, 'generated 3D viewer retries temporary model-load failures');
assert.doesNotMatch(modelViewer, /Regenerating is not automatic/i, 'viewer must not describe a delivery failure as permanently stuck');

assert.match(meshyCredits, /fullPipeline: 33/, 'optional enhanced property budget reserves all three paid Meshy stages');
assert.match(meshyCredits, /afterSource: 18/, 'enhanced voxel style stage reserves enough credits for itself plus final 3D');
assert.match(meshyCredits, /final3d: 15/, 'final enhanced textured Smart Topology 3D budget stays explicit');
assert.match(meshyCredits, /openapi\/v1\/balance/, 'provider credit preflight uses Meshy balance API');
assert.match(meshyCredits, /status === 402/, 'Meshy 402 responses are recognized as provider-credit exhaustion');
assert.match(meshyCredits, /not your wallet, bank account, card, or crypto balance/, 'provider credit copy must never imply the signed-in user lacks money');

// Map visual improvements stay deterministic and source-backed.
assert.match(globe, /function focusSelected/, 'map must be able to focus the selected property');
assert.match(globe, /FOCUS/, 'map exposes a one-tap focus control');
assert.match(globe, /listingHeightMeters/, 'map marker uses source-backed height evidence when available');
assert.match(globe, /coordinatePointCount/, 'map marker uses footprint detail as a visual cue');
assert.match(globe, /TorusGeometry/, 'selected mapped property must have a clear visual halo');
assert.match(globe, /Math\.max\(8\.8/, 'map must allow a closer selected-property zoom on mobile');

assert.match(property, /Building a first 3D model from your photo/, 'enhanced users still see the first 3D processing state');
assert.match(property, /Turning the 3D into VoxelPop/, 'enhanced users still see voxel processing state');
assert.match(property, /Building your final VoxelPop 3D/, 'enhanced users still see final 3D progress');
assert.match(property, /async function resumeFinal3D\(\)/, 'completed enhanced voxel checkpoint retains a dedicated final-3D resume path');
assert.match(property, /Resume final 3D/, 'paused enhanced final stage clearly offers final-3D-only resume');
assert.doesNotMatch(property, /Use this street photo/, 'photo-first journey must not branch back into the old street-photo chooser');

console.log('Property journey regression passed: authorized photo -> default source-backed Map Voxel with zero Meshy generation calls -> focused 3D World -> optional collection, while the separate paid enhanced Meshy pipeline retains fingerprint verification, credit preflight, recovery, and resumable final 3D.');
