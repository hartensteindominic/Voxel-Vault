import assert from 'node:assert/strict';
import fs from 'node:fs';

const drafts = fs.readFileSync(new URL('../lib/property-drafts.js', import.meta.url), 'utf8');
const truth = fs.readFileSync(new URL('../app/vault/earth/PropertyTruthStack.js', import.meta.url), 'utf8');
const vaultPage = fs.readFileSync(new URL('../app/vault/property-drafts/page.js', import.meta.url), 'utf8');
const earthPage = fs.readFileSync(new URL('../app/vault/earth/page.js', import.meta.url), 'utf8');

assert.match(drafts, /type:\s*'voxel-vault-property-3d-draft'/, 'saved objects must be explicit 3D property drafts');
assert.match(drafts, /minted:\s*false/, 'new property drafts must start unminted');
assert.match(drafts, /optional:\s*true/, 'blockchain minting must remain optional');
assert.match(drafts, /ownershipRightsCreatedByDraft:\s*false/, 'saving a 3D draft must never create property rights');
assert.match(drafts, /ownershipRightsCreatedByMint:\s*false/, 'minting a digital model must never be represented as creating real-property rights');
assert.match(drafts, /MAX_DRAFTS = 24/, 'browser draft storage must stay bounded for mobile devices');
assert.match(drafts, /localStorage\.setItem\(propertyDraftStorageKey/, '3D drafts must be savable without a wallet');

assert.match(truth, /PROPERTY → 3D VOXEL MAKER/, 'Earth evidence must expose the 3D-first maker funnel');
assert.match(truth, /NO MINT REQUIRED/, 'the primary property flow must clearly work without minting');
assert.match(truth, />3D DRAFT</, '3D draft must be the first funnel step');
assert.match(truth, />IMPROVE</, 'high-fidelity improvement must be a separate step');
assert.match(truth, />SAVE</, 'saving must happen before verification/minting');
assert.match(truth, />VERIFY</, 'property-right verification must remain separate');
assert.match(truth, />MINT</, 'minting may remain available as a later step');
assert.match(truth, /MINTING IS A LATER CHOICE, NOT THE CREATION STEP/, 'minting must never be the event that creates the property draft');
assert.match(truth, /savePropertyDraft\(draft\)/, 'Earth must save the selected property draft without a mint transaction');
assert.match(truth, /\/vault\/property-drafts/, 'Earth must link to the saved draft vault');
assert.match(truth, /\/vault\/properties\/claim/, 'Earth must route real-property rights to the verification workflow');
assert.doesNotMatch(truth, /mintVoxelFlip|eth_requestAccounts|MetaMask/, 'the 3D draft maker must not require wallet code');

assert.match(vaultPage, /NO WALLET REQUIRED · NO MINT REQUIRED/, 'saved drafts page must remain explicitly offchain-capable');
assert.match(vaultPage, /readPropertyDrafts/, 'saved drafts page must read the non-minted draft library');
assert.match(vaultPage, /exportPropertyDraft/, 'users must be able to export their saved 3D property record');
assert.match(vaultPage, /Saving this model does not create deed\/title/, 'saved draft page must preserve the legal/title boundary');

assert.match(earthPage, /PropertyTruthStack/, 'the 3D-first funnel must remain mounted in the main Earth property experience');
assert.match(earthPage, /automatic|MESHY|Meshy/i, 'Earth must keep its existing controlled high-fidelity reconstruction layer');

console.log('3D-first property funnel checks passed: every source-backed property can exist as an offchain draft first, saving is wallet-free, verification stays separate, and minting remains optional.');
