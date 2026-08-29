import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const route = read('app/property/page.js');
const property = read('app/property/PropertyJourneySimple.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const localVoxel = read('app/api/property-local-voxel/route.ts');
const localStore = read('lib/local-voxel-store.js');
const payment = read('lib/property-generation-payment.ts');
const viewer = read('app/property/LocalVoxelModelViewer.js');
const mintPage = read('app/property/mint/page.js');
const mintPrepare = read('app/api/property-nft/prepare/route.ts');
const mintConfirm = read('app/api/property-nft/confirm/route.ts');
const mintMetadata = read('app/api/property-nft/metadata/route.ts');
const mintMedia = read('app/api/property-nft/media/route.ts');

assert.match(route, /PropertyJourneySimple/, 'the /property route uses the simple paid journey');
assert.match(payment, /PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499/, 'server-authoritative VoxelPop creation price stays $4.99');
assert.match(payment, /PROPERTY_VOXEL_GENERATION_KIND = 'property_voxel_generation_v1'/, 'paid creation keeps its dedicated Stripe rail');
assert.match(payment, /PROPERTY_VOXEL_GENERATION_ENGINE = 'browser-local-v1'/, 'paid creation identifies the local no-credit engine');
assert.match(payment, /session\.payment_status !== 'paid'/, 'generation unlock requires a paid Stripe session');
assert.match(payment, /session\.client_reference_id !== auth\.user\.id/, 'paid generation remains bound to the signed-in buyer');
assert.match(payment, /Number\(session\.amount_total \|\| 0\) !== PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the exact paid amount is verified server-side');
assert.match(payment, /metadata\.source_storage !== 'device-local'/, 'the paid receipt is for the device-local photo path');

assert.match(checkout, /requireVoxelVaultUser/, 'checkout requires a signed-in account');
assert.match(checkout, /stripe\.checkout\.sessions\.create/, 'the $4.99 paywall uses server-created Stripe Checkout');
assert.match(checkout, /unit_amount: PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the browser cannot choose the generation price');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout records that the photo stays on device');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|stagePaidPropertyPhoto|createBucket|storage\.from/i, 'checkout never calls Meshy capacity checks or private photo Storage');
assert.match(paidVerify, /paidPropertyGenerationReceipt\(auth, stripe, generationSessionId\)/, 'Stripe receipt is verified before creation unlocks');

assert.match(property, /CREATION_PRICE_LABEL = '\$4\.99'/, 'maker shows the $4.99 creation price');
assert.match(property, /const labels = \['PHOTO', 'PAY', 'PICTURE', 'VOXEL', 'WORLD', 'MINT'\]/, 'maker exposes the six literal steps');
assert.match(property, /async function startPictureBuild\(photo\)/, 'paid creation builds the picture as its own stage');
assert.match(property, /Does this look like your house\?/, 'picture has an explicit review screen');
assert.match(property, /Looks like my house → Create 3D voxel/, 'user approval gates voxel generation');
assert.match(property, /function approvePictureAndBuildVoxel\(\)/, 'voxel creation begins only after picture approval');
assert.match(property, /setPictureApproved\(true\)/, 'approval state is explicit');
assert.match(property, /The full photo proportions are preserved instead of forcing the house into a square crop/, 'UI documents the fidelity fix');
assert.match(property, /No extra charge for choosing another photo/, 'a poor picture can be retried after verified payment');
assert.match(property, /LocalVoxelModelViewer imageUrl=\{voxelPoster \|\| pendingPreview\} sourceImageUrl=\{pendingPreview \|\| voxelPoster\}/, 'voxel uses the original photo as its fidelity source');
assert.match(property, /pictureReviewedBeforeVoxel: true/, 'saved draft records that review preceded voxel creation');
assert.match(property, /visual:\s*\{[\s\S]*modelUrl: final3d\?\.modelUrl/, 'saved draft keeps the actual model URL for Vault/World continuity');
assert.match(property, /paymentSessionId: paidSessionId/, 'saved draft keeps the account-bound receipt reference needed for later mint verification');
assert.match(property, /Mint digital voxel →/, 'finished journey offers the digital NFT mint step');
assert.match(property, /\/property\/mint\?/, 'mint action goes to the dedicated digital voxel mint page');
assert.doesNotMatch(property, /\/vault\/properties\/claim[^'"}]*Mint digital voxel/, 'normal digital mint must not masquerade as real-property claim verification');
assert.doesNotMatch(property, /\/api\/property-collectible\/checkout|collectAndSave|Collect voxel ·/, 'guided creation never demands a second collectible checkout');
assert.doesNotMatch(property, /insufficient funds|needs credits|add Meshy credits/i, 'guided UI contains no provider-credit dead end');

assert.match(viewer, /const MAX_GRID = 32/, 'voxel sampler has higher local detail');
assert.match(viewer, /function gridFor\(image\)/, 'voxel grid follows source aspect ratio');
assert.match(viewer, /Never force a landscape home into a square crop/, 'viewer protects house proportions');
assert.match(viewer, /if \(!mask\[index\]\) return 0/, 'background cells become empty space');
assert.match(viewer, /if \(recipe\.depths\[index\] <= 0\) continue/, 'interactive viewer omits background voxels');
assert.match(viewer, /sourceImageUrl/, 'voxel sampling can use the original property photo');
assert.match(viewer, /InstancedMesh/, 'local 3D is real WebGL voxel geometry');
assert.doesNotMatch(viewer, /backingGeometry/, 'the old square picture-wall slab stays removed');
assert.match(localVoxel, /const MAX_SIDE = 32/, 'server accepts the higher-detail rectangular recipe');
assert.match(localVoxel, /if \(recipe\.depths\[index\] <= 0\) continue/, 'saved glTF preserves empty background');
assert.match(localVoxel, /model\/gltf\+json/, 'saved local recipe reopens as glTF');
assert.match(localStore, /Deliberately table-only/, 'local record persistence avoids Storage');

assert.match(mintPage, /connectVoxelFlipWallet/, 'property mint requires an explicit wallet connection');
assert.match(mintPage, /mintVoxelFlip/, 'property mint uses the existing VoxelFlip Base contract flow');
assert.match(mintPage, /Resume mint verification/, 'mint UI protects users from duplicate minting after refresh');
assert.match(mintPrepare, /paidPropertyGenerationReceipt/, 'mint preparation re-verifies the $4.99 Stripe purchase');
assert.match(mintPrepare, /propertyDraftItemId\(auth\.user\.id, draftId, 'voxel'\)/, 'mint preparation binds task to signed-in account and creation');
assert.match(mintPrepare, /usedVouchers/, 'mint preparation checks one-time voucher state before sending another mint');
assert.doesNotMatch(mintPrepare, /MESHY_API_KEY|api\.meshy/i, 'property mint preparation is not Meshy-dependent');
assert.match(mintConfirm, /ownerOf\(uint256 tokenId\)/, 'mint confirmation checks on-chain token ownership');
assert.match(mintConfirm, /tokenURI\(uint256 tokenId\)/, 'mint confirmation checks on-chain metadata');
assert.match(mintMetadata, /Real property rights', value: 'None'/, 'NFT metadata states that no real-property rights are included');
assert.match(mintMedia, /local-voxel-recipe-v1:/, 'NFT media is generated from the local voxel recipe');
assert.doesNotMatch(mintMedia, /MESHY_API_KEY|api\.meshy/i, 'NFT media has no Meshy dependency');

console.log('Paid property flow passed: sign in -> photo -> one $4.99 payment -> review 3D picture -> approve -> movable voxel -> map/save -> optional VoxelFlip mint, without Meshy credits or a second creation paywall.');
