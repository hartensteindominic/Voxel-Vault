import assert from 'node:assert/strict';
import fs from 'node:fs';

const drafts = fs.readFileSync(new URL('../lib/property-drafts.js', import.meta.url), 'utf8');
const account = fs.readFileSync(new URL('../lib/property-drafts-account.ts', import.meta.url), 'utf8');
const syncBridge = fs.readFileSync(new URL('../app/vault/PropertyDraftSyncBridge.js', import.meta.url), 'utf8');
const vaultLayout = fs.readFileSync(new URL('../app/vault/layout.js', import.meta.url), 'utf8');
const truth = fs.readFileSync(new URL('../app/vault/earth/PropertyTruthStack.js', import.meta.url), 'utf8');
const vaultPage = fs.readFileSync(new URL('../app/vault/property-drafts/page.js', import.meta.url), 'utf8');
const draftViewer = fs.readFileSync(new URL('../app/vault/property-drafts/[draftId]/page.js', import.meta.url), 'utf8');
const earthPage = fs.readFileSync(new URL('../app/vault/earth/page.js', import.meta.url), 'utf8');

assert.match(drafts, /type:\s*'voxel-vault-property-3d-draft'/, 'saved objects must be explicit 3D property drafts');
assert.match(drafts, /minted:\s*false/, 'new property drafts must start unminted');
assert.match(drafts, /optional:\s*true/, 'blockchain minting must remain optional');
assert.match(drafts, /ownershipRightsCreatedByDraft:\s*false/, 'saving a 3D draft must never create property rights');
assert.match(drafts, /ownershipRightsCreatedByMint:\s*false/, 'minting a digital model must never be represented as creating real-property rights');
assert.match(drafts, /MAX_DRAFTS = 24/, 'property draft storage must stay bounded for mobile devices');
assert.match(drafts, /mergePropertyDraftRecords/, 'browser and cloud drafts must have a deterministic merge path');
assert.match(drafts, /timestamp\(draft\.updatedAt\) >= timestamp\(previous\.updatedAt\)/, 'newest draft update must win per stable draft id');
assert.match(drafts, /replaceLocalPropertyDrafts/, 'synced account drafts must be materializable back to local storage');
assert.match(drafts, /voxel-vault:property-draft-saved/, 'a successful local save must notify the Vault sync bridge');
assert.match(drafts, /localStorage\.setItem\(propertyDraftStorageKey/, '3D drafts must remain savable without a wallet');

assert.match(account, /avatar_style: \{ \.\.\.currentStyle, property_draft_library: bounded \}/, 'account sync must reuse the existing profile JSON without a new auth system');
assert.match(account, /syncLocalPropertyDraftsToAccount/, 'local and account property drafts must merge on sign-in');
assert.match(account, /deletePropertyDraftFromAccount/, 'deleting a synced draft must remove it from the account library');
assert.match(account, /mergePropertyDraftRecords\(cloud, local\)/, 'cloud and browser libraries must merge by stable draft id');
assert.match(syncBridge, /voxel-vault:property-draft-saved/, 'Vault-wide sync must react immediately after Earth saves a draft');
assert.match(syncBridge, /savePropertyDraftToAccount/, 'signed-in saves must mirror to account storage automatically');
assert.match(vaultLayout, /PropertyDraftSyncBridge/, 'automatic property draft sync must be mounted across Vault routes');

assert.match(truth, /PROPERTY → 3D VOXEL MAKER/, 'Earth evidence must expose the 3D-first maker funnel');
assert.match(truth, /NO MINT REQUIRED/, 'the primary property flow must clearly work without minting');
assert.match(truth, />3D DRAFT</, '3D draft must be the first funnel step');
assert.match(truth, />IMPROVE</, 'high-fidelity improvement must be a separate step');
assert.match(truth, />SAVE</, 'saving must happen before verification/minting');
assert.match(truth, />VERIFY</, 'property-right verification must remain separate');
assert.match(truth, />MINT</, 'minting may remain available as a later step');
assert.match(truth, /MINTING IS A LATER CHOICE, NOT THE CREATION STEP/, 'minting must never be the event that creates the property draft');
assert.match(truth, /savePropertyDraft\(draft\)/, 'Earth must save the selected property draft without a mint transaction');
assert.doesNotMatch(truth, /mintVoxelFlip|eth_requestAccounts|MetaMask/, 'the 3D draft maker must not require wallet code');

assert.match(vaultPage, /NO WALLET REQUIRED · NO MINT REQUIRED/, 'saved drafts page must remain explicitly offchain-capable');
assert.match(vaultPage, /syncLocalPropertyDraftsToAccount/, 'saved drafts page must expose cross-device account sync');
assert.match(vaultPage, /CONTINUE WITH GOOGLE/, 'users must be able to opt into account sync');
assert.match(vaultPage, /OPEN EXACT 3D/, 'saved draft cards must reopen their exact saved model');
assert.match(vaultPage, /\/vault\/property-drafts\/\$\{encodeURIComponent\(draft\.id\)\}/, 'saved cards must deep-link by stable draft id');
assert.match(vaultPage, /deletePropertyDraftFromAccount/, 'synced deletions must not reappear from cloud storage');
assert.match(vaultPage, /Saving this model does not create deed\/title/, 'saved draft page must preserve the legal/title boundary');

assert.match(draftViewer, /readPropertyDraft\(draftId\)/, 'exact viewer must first load the saved local geometry snapshot');
assert.match(draftViewer, /loadAccountPropertyDrafts/, 'exact viewer must restore a missing local snapshot from the signed-in account');
assert.match(draftViewer, /geometry: draft\.geometry \|\| null/, 'exact viewer must render saved geometry rather than a fresh nearest-building guess');
assert.match(draftViewer, /GeoReferenceModel/, 'saved property geometry must reopen inside the real 3D renderer');
assert.match(draftViewer, /live map updates do not silently replace it/, 'viewer must explain that the snapshot is stable until explicitly updated');
assert.match(draftViewer, /not a deed or guaranteed perfect replica/i, 'exact viewer must keep legal and fidelity claims conservative');

assert.match(earthPage, /PropertyTruthStack/, 'the 3D-first funnel must remain mounted in the main Earth property experience');
assert.match(earthPage, /automatic|MESHY|Meshy/i, 'Earth must keep its existing controlled high-fidelity reconstruction layer');

console.log('3D property draft checks passed: exact snapshots reopen in 3D, browser saves stay wallet-free, signed-in drafts sync across devices, synced deletion is supported, truth boundaries remain explicit, and minting stays optional.');
