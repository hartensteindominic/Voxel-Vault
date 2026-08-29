import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const route = read('app/property/page.js');
const property = read('app/property/HouseVoxelJourney.js');
const checkout = read('app/api/property-generation/checkout/route.ts');
const paidVerify = read('app/api/property-photo-upload/route.ts');
const voxelPhoto = read('app/api/property-voxel-photo/route.ts');
const voxel3d = read('app/api/property-voxel-3d/route.ts');
const payment = read('lib/property-generation-payment.ts');
const commerce = read('lib/property-collectible-commerce.ts');
const mintPrepare = read('app/api/property-voxel-nft/prepare/route.ts');
const mintConfirm = read('app/api/property-voxel-nft/confirm/route.ts');
const mintMetadata = read('app/api/property-voxel-nft/metadata/route.ts');
const mintPage = read('app/property/mint/page.js');
const vault = read('app/vault/property-drafts/page.js');

assert.match(route, /\.\/HouseVoxelJourney/, 'the /property route must use the focused house creator');
assert.match(property, /const PRICE = '\$4\.99'/, 'maker shows the $4.99 creation price');
assert.match(property, /const labels = \['PHOTO', 'ADDRESS', 'VOXEL', '3D', 'DONE'\]/, 'creator exposes the exact five-step house flow');
assert.match(property, /Sign in once\./, 'creator keeps one account gate');
assert.match(property, /Continue with Google/, 'creator has one clear sign-in action');
assert.match(property, /Choose one house photo\./, 'creator starts with one obvious photo action');
assert.match(property, /I took this photo or have permission to use it\./, 'photo rights confirmation remains required');
assert.match(property, /\/api\/property-identity/, 'creator confirms the canonical property identity before checkout');
assert.match(property, /Confirm address/, 'address confirmation is explicit to the user');
assert.match(property, /form\.append\('address', propertyAddress\)/, 'creator passes the confirmed property address into checkout');
assert.match(property, /indexedDB\.open\(DEVICE_DB/, 'source photo persists privately on-device across checkout');
assert.match(property, /await saveDevicePhoto\(draftId, pendingPhoto\)/, 'photo is retained on-device before checkout');
assert.match(property, /\/api\/property-generation\/checkout/, 'confirmed property opens the paid generation checkout');
assert.match(property, /not be charged twice|no second charge/i, 'paid recovery never asks for a second creation charge');

assert.match(payment, /PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499/, 'server-authoritative VoxelPop creation price stays $4.99');
assert.match(payment, /session\.payment_status !== 'paid'/, 'generation unlock requires a paid Stripe session');
assert.match(payment, /session\.client_reference_id !== auth\.user\.id/, 'generation remains bound to the signed-in buyer');
assert.match(payment, /Number\(session\.amount_total \|\| 0\) !== PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the exact paid amount is verified server-side');
assert.match(payment, /one-property identity lock/, 'paid receipt requires the canonical property identity lock');
assert.match(checkout, /requireVoxelVaultUser/, 'checkout requires a signed-in account');
assert.match(checkout, /form\.get\('address'\)/, 'checkout accepts the explicit property address');
assert.match(checkout, /inspectWorldAtlas\(\{ address, radiusMeters: 180 \}\)/, 'checkout re-verifies the mapped property identity server-side');
assert.match(checkout, /propertyCollectibleIdentity\(atlasId\)/, 'checkout derives a canonical identity from the mapped building');
assert.match(checkout, /acquirePropertyCollectibleReservation/, 'checkout reserves the property before creating a payment');
assert.match(checkout, /This property has already been purchased/, 'checkout blocks an already-purchased property');
assert.match(checkout, /stripe\.checkout\.sessions\.create/, 'checkout remains server-created');
assert.match(checkout, /unit_amount: PROPERTY_VOXEL_GENERATION_PRICE_CENTS/, 'the browser cannot choose the price');
assert.match(checkout, /one_property_one_purchase: 'true'/, 'checkout records the one-property purchase invariant');
assert.match(checkout, /source_storage: 'device-local'/, 'checkout records the device-local photo boundary');
assert.doesNotMatch(checkout, /MESHY_PROPERTY_CREDITS|readMeshyCreditBalance|meshyCreditsSufficient|storage\.from/i, 'checkout itself cannot spend Meshy credits or upload the photo');
assert.match(commerce, /createHash\('sha256'\).*voxel-pop-property-v1/s, 'property identity is stable and server-derived');
assert.match(commerce, /state === 'paid' \|\| state === 'minted'/, 'paid and minted property reservations are permanent');

assert.match(paidVerify, /paidPropertyGenerationReceipt\(auth, stripe, generationSessionId\)/, 'return from checkout verifies the paid receipt');
assert.match(paidVerify, /identityKey: receipt\.identityKey/, 'paid verification restores the canonical property identity');
assert.match(paidVerify, /propertyAddress: receipt\.propertyAddress/, 'paid verification restores the canonical address');
assert.doesNotMatch(paidVerify, /image-to-image|image-to-3d|MESHY_PROPERTY_CREDITS/i, 'receipt verification must not spend provider credits');

assert.match(voxelPhoto, /listPaidPropertyCollectiblesForBuyer/, 'voxel image generation independently verifies the paid property reservation');
assert.match(voxelPhoto, /reference_image_urls: \[reference\]/, 'the authorized prepared house photo is the voxel-image reference');
assert.match(voxelPhoto, /Preserve visible roof shape and pitch/, 'the prompt preserves visible architectural identity');
assert.match(voxelPhoto, /MESHY_PROPERTY_CREDITS\.afterSource/, 'the provider preflight covers voxel-image plus final-3D capacity');
assert.match(voxelPhoto, /voxelImageTaskToken: final3dTaskToken/, 'the completed image job receives the signed token required by final 3D');
assert.doesNotMatch(voxelPhoto, /storage\.from|property-references/i, 'the source photo is not persisted to generation object storage');

assert.match(property, /\/api\/property-photo-upload/, 'the browser verifies the paid session before resuming');
assert.match(property, /prepareReferenceDataUrl\(photo\)/, 'the browser prepares a bounded reference after payment');
assert.match(property, /\/api\/property-voxel-photo/, 'the paid browser flow starts and polls the real voxel image');
assert.match(property, /voxelDone\.voxelImageTaskToken/, 'the signed image handoff is forwarded into final 3D');
assert.match(property, /\/api\/property-voxel-3d/, 'the completed voxel image feeds the final 3D route');
assert.match(property, /phase: 'voxel'/, 'the final 3D request uses the voxel-image phase');
assert.doesNotMatch(property, /phase: 'source'/, 'there is no redundant generic source-3D generation stage');
assert.match(property, /MeshyModelViewer modelUrl=\{final3d\.modelUrl\}/, 'the finished generated GLB is the movable result');
assert.match(property, /const localSaved = savePropertyDraft\(finishedDraft\)/, 'finished 3D voxel auto-saves before optional minting');
assert.match(property, /Open inventory/, 'completion prioritizes the saved inventory result');
assert.match(property, /Mint this voxel/, 'the exact finished model can be minted');
assert.match(property, /onePropertyOnePurchase: true/, 'saved Vault item records the one-purchase invariant');
assert.match(property, /onePropertyOneMint: true/, 'saved Vault item records the one-mint invariant');
assert.doesNotMatch(property, /Looks good · continue|approvePreviewAndBuildVoxel/, 'the new flow has no redundant approval step between voxel image and 3D');
assert.doesNotMatch(property, /\/api\/property-local-voxel|LocalVoxelModelViewer|PhotoReliefModelViewer/, 'the shipping creator does not end in a local approximation');
assert.doesNotMatch(property, /\/api\/property-collectible\/checkout|collectAndSave|Collect voxel ·/, 'normal creation has no second collectible checkout');

assert.match(voxel3d, /phase === 'voxel'/, 'the 3D backend supports the requested voxel-image-to-3D path');
assert.match(voxel3d, /verifiedVoxelImageUrl/, 'the 3D backend verifies the completed generated voxel-image task');
assert.match(voxel3d, /propertyDraftItemId\(auth\.user\.id, draftId, phase\)/, 'the generated GLB is stored under the signed-in account voxel phase');

assert.match(vault, /mintHref/, 'Vault can recover mint-later from the generated 3D item');
assert.match(vault, /Mint voxel/, 'Vault exposes optional minting for the saved generated model');
assert.match(mintPrepare, /requireVoxelVaultUser/, 'mint preparation requires the signed-in account');
assert.match(mintPrepare, /verifyOwnedFinalVoxelModel/, 'mint verifies the exact account-owned final model');
assert.match(mintPrepare, /listPaidPropertyCollectiblesForBuyer/, 'mint verifies the paid one-property reservation');
assert.match(mintPrepare, /reservation\.state === 'minted'/, 'mint preparation blocks a second NFT after canonical mint confirmation');
assert.match(mintPrepare, /propertyVoxelVoucherUsed\(voucher\.voucherId\)/, 'mint preparation checks the one-time on-chain voucher');
assert.match(mintPrepare, /onePropertyOneMint: true/, 'mint preparation returns the one-property-one-mint invariant');
assert.match(mintConfirm, /verifyPropertyVoxelMint/, 'mint confirmation verifies the final chain result');
assert.match(mintConfirm, /state: 'minted'/, 'verified mint permanently marks the property reservation minted');
assert.match(mintMetadata, /propertyGenerationModelUrl/, 'NFT metadata resolves the saved generated 3D model');
assert.match(mintMetadata, /one_property_one_mint: true/, 'NFT metadata states the one-property-one-mint invariant');
assert.match(mintPage, /modelUrl: clean\(query\.get\('modelUrl'\)\)/, 'mint page displays the same saved generated GLB');
assert.match(mintPage, /Keep in inventory/, 'mint page lets the user keep the model without minting');

console.log('Paid VoxelPop regression passed: sign in -> house photo -> confirmed address -> one $4.99 unlock -> generated voxel image -> real final 3D GLB -> Vault -> optional one-property mint.');
