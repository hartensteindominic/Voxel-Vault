import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const route = read('app/property/page.js');
const creator = read('app/property/HouseVoxelApp.js');
const voxelImage = read('app/property/PhotoReliefModelViewer.js');
const voxel3d = read('app/property/LocalVoxelModelViewer.js');
const localVoxelApi = read('app/api/property-local-voxel/route.ts');
const identityApi = read('app/api/property-identity/route.ts');
const checkoutApi = read('app/api/property-generation/checkout/route.ts');
const paidVerifyApi = read('app/api/property-photo-upload/route.ts');
const mintPrepareApi = read('app/api/property-voxel-nft/prepare/route.ts');
const mintConfirmApi = read('app/api/property-voxel-nft/confirm/route.ts');

assert.match(route, /HouseVoxelApp/, '/property must render the focused HouseVoxelApp');
assert.doesNotMatch(route, /<PropertyJourneySimple\b|<PropertyIdentityGate\b/, 'the active route must not render legacy property wrappers around the focused app');
assert.match(creator, /const steps = \['PHOTO', 'ADDRESS', 'VOXEL IMAGE', '3D VOXEL', 'MINT'\]/, 'creator must expose exactly the requested five-step journey');
assert.match(creator, /Choose house photo/, 'photo upload must be the first creation action');
assert.match(creator, /capture="environment"/, 'mobile users should be able to capture a house photo directly');
assert.match(creator, /normalizeIphonePhoto/, 'iPhone HEIC and HEIF photos must remain supported');
assert.match(creator, /indexedDB\.open\(PHOTO_DB/, 'source photo must survive checkout privately on-device');

assert.match(creator, /async function confirmAddress\(\)/, 'address confirmation must have an explicit gate');
assert.match(creator, /\/api\/property-identity/, 'address confirmation must use the canonical property identity API');
assert.match(identityApi, /inspectWorldAtlas/, 'address confirmation must be source-backed rather than a plain text label');
assert.match(identityApi, /\['paid', 'minted'\]/, 'an already collected property must be blocked at address confirmation');
assert.match(creator, /I took this photo or have permission to use it\./, 'the source-photo rights confirmation must remain visible');
assert.match(creator, /Create this house voxel · \$\{PRICE\}/, 'one compact paid create action must follow address confirmation');
assert.match(checkoutApi, /acquirePropertyCollectibleReservation/, 'checkout must reserve the canonical property before payment');
assert.match(checkoutApi, /one_property_one_purchase: 'true'/, 'checkout must preserve the one-property purchase lock');
assert.doesNotMatch(checkoutApi, /storage\.from|MESHY_PROPERTY_CREDITS|api\.meshy/i, 'normal checkout must not upload the source photo or spend Meshy credits');
assert.doesNotMatch(paidVerifyApi, /storage\.from|api\.meshy|image-to-3d/i, 'paid return must not upload the source photo or call a metered 3D provider');

assert.match(creator, /PhotoReliefModelViewer/, 'the uploaded house must become a voxel-image review before the final model');
assert.match(creator, /Looks right · build 3D voxel/, 'the voxel image needs one explicit approval action');
assert.match(voxelImage, /new THREE\.InstancedMesh/, 'voxel-image review must use real cube geometry');
assert.match(voxelImage, /getImageData\(0, 0, columns, rows\)/, 'voxel-image review must derive colors from the uploaded photo');

assert.match(creator, /LocalVoxelModelViewer/, 'approval must proceed to the interactive 3D voxel');
assert.match(voxel3d, /const GRID = 32/, 'final local voxel should retain the higher-detail grid');
assert.match(voxel3d, /InstancedMesh/, 'final 3D voxel must use actual voxel geometry');
assert.match(creator, /\/api\/property-local-voxel/, 'finished local voxel must be registered for durable inventory and minting');
assert.match(localVoxelApi, /saveLocalVoxelRecord/, 'server must persist the account-bound finished voxel');
assert.match(localVoxelApi, /buildGltf\(recipe\)/, 'persisted voxel recipe must remain reconstructable as glTF');

assert.match(creator, /savePropertyDraft\(finishedDraft\)/, 'finished voxel must save to local Vault inventory automatically');
assert.match(creator, /savePropertyDraftToAccount/, 'finished voxel must also save to the signed-in account when available');
assert.match(creator, /SAVED TO INVENTORY/, 'completion must make automatic inventory saving obvious');
assert.match(creator, /href="\/vault\/property-drafts"/, 'completion must offer the inventory as a direct destination');
assert.match(creator, /\/property\/mint\?draftId=/, 'completion must expose the exact finished voxel to the mint route');
assert.match(creator, />Mint voxel</, 'minting must be a simple final action');

assert.match(mintPrepareApi, /verifyOwnedFinalVoxelModel/, 'mint preparation must verify the exact account-owned finished voxel');
assert.match(mintPrepareApi, /reservation\.state === 'minted'/, 'mint preparation must block a second mint for the same property');
assert.match(mintPrepareApi, /propertyVoxelVoucherUsed/, 'mint voucher must be one-time onchain');
assert.match(mintConfirmApi, /state: 'minted'/, 'successful mint confirmation must permanently mark the property reservation minted');
assert.match(mintConfirmApi, /onePropertyOneMint: true/, 'mint confirmation must preserve the one-property-one-mint contract');

assert.doesNotMatch(creator, /PropertyWorldMap|Add to My World|\bfractional\b|\brent\b|\binvestment\b/i, 'advanced real-estate features must stay out of the focused creator');
assert.match(creator, /Digital collectible only/, 'creator must preserve the digital-only physical-property boundary');

console.log('House Voxel app regression passed: photo -> confirmed address -> voxel image -> interactive 3D voxel -> automatic Vault inventory -> optional one-of-one mint.');
