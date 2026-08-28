import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildPropertySceneWalletMessage,
  normalizeSceneTransform,
  PROPERTY_SCENE_POLICY,
} from '../lib/vault/property-scene.js';

assert.equal(PROPERTY_SCENE_POLICY.digitalOnly, true);
assert.equal(PROPERTY_SCENE_POLICY.changesDeed, false);
assert.equal(PROPERTY_SCENE_POLICY.changesPropertyAppraisal, false);
assert.equal(PROPERTY_SCENE_POLICY.createsRentRights, false);
assert.equal(PROPERTY_SCENE_POLICY.transfersAttachedNft, false);
assert.equal(PROPERTY_SCENE_POLICY.verifiedPropertyControllerRequired, true);
assert.equal(PROPERTY_SCENE_POLICY.currentVoxelOwnershipRequiredForAttachOrMove, true);
assert.equal(PROPERTY_SCENE_POLICY.userEnteredSceneValueAllowed, false);

const transform = normalizeSceneTransform({ x: 1.25, y: 0.5, z: -2, rotationY: 1.2, scale: 1.4 });
assert.deepEqual(transform, { x: 1.25, y: 0.5, z: -2, rotationY: 1.2, scale: 1.4 });
assert.throws(() => normalizeSceneTransform({ x: 999 }), /bounds/i);
assert.throws(() => normalizeSceneTransform({ scale: 0 }), /scale/i);

const message = buildPropertySceneWalletMessage({
  action: 'ATTACH',
  propertyIdentityId: '11111111-1111-1111-1111-111111111111',
  chainId: 11155111,
  contractAddress: '0x1111111111111111111111111111111111111111',
  tokenId: '42',
  transform,
  timestamp: 123456789,
});
assert.match(message, /Voxel Vault Property Scene/);
assert.match(message, /Action: ATTACH/);
assert.match(message, /NFT: 11155111:0x1111111111111111111111111111111111111111:42/);
assert.match(message, /does not change the deed, property appraisal, rent rights, or NFT ownership/i);

const migration = fs.readFileSync(new URL('../supabase/migrations/020_property_voxel_scenes.sql', import.meta.url), 'utf8');
assert.match(migration, /vault_property_scene_items/i);
assert.match(migration, /unique \(property_identity_id, nft_chain_id, nft_contract, nft_token_id\)/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on table public\.vault_property_scene_items from anon, authenticated/i);
assert.doesNotMatch(migration, /create policy .*insert/is, 'Browser users must not write scene attachments directly.');
assert.doesNotMatch(migration, /apprais/i, 'Scene storage must not contain an appraisal/value mutation field.');

const route = fs.readFileSync(new URL('../app/api/vault/property-scenes/route.ts', import.meta.url), 'utf8');
assert.match(route, /requireVoxelVaultUser/);
assert.match(route, /claim_status', 'verified'/i, 'Scene editing requires a verified property claim.');
assert.match(route, /owner_authorized', true/i, 'Scene editing requires the authorized property controller.');
assert.match(route, /verifyMessage\(/, 'Wallet signature must be cryptographically verified.');
assert.match(route, /ownerOf\(/, 'Current on-chain Voxel ownership must be checked.');
assert.match(route, /currentOwner !== wallet/i, 'A different token owner must fail closed.');
assert.match(route, /signatureMaxAgeMs/i, 'Wallet approval must expire.');
assert.match(route, /propertyRightsChanged: false/);
assert.match(route, /appraisalChanged: false/);
assert.match(route, /nftTransferred: false/);
assert.doesNotMatch(route, /price_cents|estimatedValueUsd|appraisal_value|property_value/i, 'Scene API must not mutate or invent a real-property valuation.');

const page = fs.readFileSync(new URL('../app/vault/properties/scene/page.js', import.meta.url), 'utf8');
assert.match(page, /CREATE A NEW VOXEL/i);
assert.match(page, /LOAD MY OWNED VOXELS/i);
assert.match(page, /ATTACH OWNED VOXEL/i);
assert.match(page, /SAVE NEW POSITION/i);
assert.match(page, /REMOVE FROM SCENE/i);
assert.match(page, /DIGITAL SCENE VALUE/i);
assert.match(page, /REAL PROPERTY VALUE/i);
assert.match(page, /NFT OWNERSHIP/i);
assert.match(page, /signMessage\(/, 'Browser must ask the connected wallet to sign scene placement.');
assert.doesNotMatch(page, /private key|seed phrase/i);

const canvas = fs.readFileSync(new URL('../app/vault/properties/scene/PropertySceneCanvas.js', import.meta.url), 'utf8');
assert.match(canvas, /GLTFLoader/);
assert.match(canvas, /animation_url/);
assert.match(canvas, /DIGITAL VALUE ≠ APPRAISAL/);

console.log('Property Scene safety tests passed.');
