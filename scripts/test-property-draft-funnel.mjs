import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const drafts = read('lib/property-drafts.js');
const account = read('lib/property-drafts-account.ts');
const syncBridge = read('app/vault/PropertyDraftSyncBridge.js');
const vaultLayout = read('app/vault/layout.js');
const truth = read('app/vault/earth/PropertyTruthStack.js');
const vaultPage = read('app/vault/property-drafts/page.js');
const draftViewer = read('app/vault/property-drafts/[draftId]/page.js');
const earthPage = read('app/vault/earth/page.js');

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
assert.match(drafts, /world:\s*\{\s*public:\s*false/, 'new property drafts must be private on World by default');

assert.match(account, /avatar_style: \{ \.\.\.currentStyle, property_draft_library: bounded \}/, 'account sync must reuse the existing profile JSON without a new auth system');
assert.match(account, /syncLocalPropertyDraftsToAccount/, 'local and account property drafts must merge on sign-in');
assert.match(account, /deletePropertyDraftFromAccount/, 'deleting a synced draft must remove it from the account library');
assert.match(account, /mergePropertyDraftRecords\(cloud, local\)/, 'cloud and browser libraries must merge by stable draft id');
assert.match(syncBridge, /voxel-vault:property-draft-saved/, 'Vault-wide sync must react immediately after a Vault save');
assert.match(syncBridge, /savePropertyDraftToAccount/, 'signed-in saves must mirror to account storage automatically');
assert.match(vaultLayout, /PropertyDraftSyncBridge/, 'automatic property draft sync must be mounted across Vault routes');

assert.match(truth, /PROPERTY → 3D VOXEL MAKER/, 'advanced Earth evidence must retain the 3D-first maker funnel');
assert.match(truth, /NO MINT REQUIRED/, 'creating a property draft must clearly work without minting');
assert.match(truth, />3D DRAFT</, '3D draft must be the first advanced funnel step');
assert.match(truth, />VERIFY</, 'property-right verification must remain separate');
assert.match(truth, />MINT</, 'minting may remain available as a later step');
assert.match(truth, /MINTING IS A LATER CHOICE, NOT THE CREATION STEP/, 'minting must never be the event that creates the property draft');
assert.doesNotMatch(truth, /mintVoxelFlip|eth_requestAccounts|MetaMask/, 'the 3D draft maker must not require wallet code');

assert.match(vaultPage, /VOXEL VAULT · INVENTORY/, 'the consumer Vault must clearly present the VoxelPop inventory');
assert.match(vaultPage, /Your voxels\./, 'Vault should read as the user’s simple voxel inventory');
assert.match(vaultPage, /syncLocalPropertyDraftsToAccount/, 'the simplified Vault must retain cross-device account sync');
assert.match(vaultPage, /Sync with Google/, 'account sync must remain available without dominating the page');
assert.match(vaultPage, /Create another house/, 'Vault must provide the repeat creation loop');
assert.match(vaultPage, /Open 3D/, 'saved property cards must reopen their exact 3D model');
assert.match(vaultPage, /\/vault\/property-drafts\/\$\{encodeURIComponent\(draft\.id\)\}/, 'saved cards must deep-link by stable draft id');
assert.match(vaultPage, /mintHref/, 'saved generated voxels must retain an optional mint-later path');
assert.match(vaultPage, /Mint voxel/, 'mint-later must be directly available from inventory');
assert.match(vaultPage, /deletePropertyDraftFromAccount/, 'synced deletions must not reappear from cloud storage');
assert.match(vaultPage, /digital collectibles/i, 'Vault must describe its contents as digital collectibles rather than physical property ownership');
assert.match(vaultPage, /does not transfer deed, title, occupancy, rent, equity, or other rights/i, 'Vault must preserve the digital-versus-real-property truth boundary');
assert.doesNotMatch(vaultPage, /MetaMask|eth_requestAccounts/, 'the basic property Vault must not require a wallet');

assert.match(draftViewer, /readPropertyDraft\(draftId\)/, 'exact viewer must first load the saved local snapshot');
assert.match(draftViewer, /loadAccountPropertyDrafts/, 'exact viewer must restore a missing local snapshot from the signed-in account');
assert.match(draftViewer, /geometry: parcelOnly \? null : \(draft\.geometry \|\| null\)/, 'parcel-only geometry must not be extruded as a fake building');
assert.match(draftViewer, /parcelGeometry: draft\.geometry/, 'parcel-only drafts must still render their saved parcel geometry');
assert.match(draftViewer, /PARCEL · NO BUILDING INVENTED/, 'land drafts must disclose that no structure was invented');
assert.match(draftViewer, /MeshyModelViewer/, 'generated VoxelPop items must reopen the actual saved 3D model');
assert.match(draftViewer, /generatedModelUrl \? <MeshyModelViewer/, 'generated model should take precedence over the map-only fallback viewer');
assert.match(draftViewer, /GeoReferenceModel/, 'map/parcel-only drafts must retain the source-backed 3D fallback renderer');
assert.match(draftViewer, /never silently changes the saved voxel/, 'current map evidence must never silently replace the saved collectible');
assert.match(draftViewer, /CHECK CURRENT MAP EVIDENCE/, 'viewer must compare saved state with current map evidence without overwriting it');
assert.match(draftViewer, /not a deed or guaranteed perfect replica/i, 'exact viewer must keep legal and fidelity claims conservative');
assert.match(draftViewer, /single source photo cannot verify unseen sides/i, 'single-photo fidelity limits must remain visible');

assert.match(earthPage, /PropertyTruthStack/, 'the advanced Earth property experience must remain available behind the simple product');
assert.match(earthPage, /automatic|MESHY|Meshy/i, 'Earth must keep its controlled high-fidelity reconstruction layer');

console.log('Property draft guards passed: generated 3D VoxelPop inventory, wallet-free saving, account sync, exact generated-model reopen, optional one-property minting, deletion, and digital-only rights boundaries remain enforced.');
