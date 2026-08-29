import assert from 'node:assert/strict';
import { buildVaultManifest, summarizeVaultManifest } from '../lib/vault/manifest.js';

const entries = buildVaultManifest({
  creations: [
    { sessionId: 'creator-1', name: 'tiny-cyberpunk-shop', image: 'data:image/png;base64,abc', meshStatus: 'ready', mint: null },
    { sessionId: 'creator-2', name: 'dragon-barista', image: 'data:image/png;base64,def', meshStatus: 'ready', mint: { tokenId: '77' } },
  ],
  collectibles: [{ tokenId: '9', metadata: { name: 'Verified Twin #9', image: 'ipfs://image' } }],
  reitPositions: [
    { stockId: 'stock-vnq', symbol: 'VNQ', amount: 1.25 },
    { stockId: 'stock-empty', symbol: 'ZERO', amount: 0 },
    { stockId: 'stock-negative', symbol: 'NEG', amount: -1 },
  ],
  creatorSource: 'google-synced',
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  provider: 'Dinari',
  providerEnvironment: 'sandbox',
  providerAccountScope: 'user-bound',
});

const summary = summarizeVaultManifest(entries);
assert.deepEqual(summary, { total: 4, creations: 2, collectibles: 1, digitalReits: 1 });
const readyCreation = entries.find((entry) => entry.id === 'creation:creator-1');
assert.equal(readyCreation?.truthLabel, '3D CREATION');
assert.equal(readyCreation?.sourceLabel, 'GOOGLE-SYNCED LIBRARY');
assert.match(readyCreation?.note || '', /not a real-property interest/i);
const mintedCreation = entries.find((entry) => entry.id === 'creation:creator-2');
assert.equal(mintedCreation?.truthLabel, 'MINTED CREATION');
assert.match(mintedCreation?.href || '', /\/voxelflip\/mint/);
const collectible = entries.find((entry) => entry.kind === 'collectible');
assert.equal(collectible?.truthLabel, 'ON-CHAIN OWNER VERIFIED');
assert.match(collectible?.note || '', /does not make the token a property deed/i);
const reit = entries.find((entry) => entry.kind === 'digital-reit');
assert.equal(reit?.title, 'VNQ');
assert.equal(reit?.amount, 1.25);
assert.equal(reit?.truthLabel, 'USER-BOUND PROVIDER POSITION');
assert.equal(reit?.sourceLabel, 'DINARI SANDBOX ACCOUNT · USER BOUND');
assert.match(reit?.note || '', /provider account bound to this Voxel Vault identity/i);
assert.match(reit?.note || '', /not a deed or direct ownership/i);
assert.equal(entries.some((entry) => entry.title === 'ZERO'), false, 'zero provider balances must not become spatial holdings');
assert.equal(entries.some((entry) => entry.title === 'NEG'), false, 'negative provider balances must not become spatial holdings');
const malformed = buildVaultManifest({ creations: [{ sessionId: '', image: 'x' }, { sessionId: 'x', image: '' }], collectibles: [{ tokenId: '' }], reitPositions: [{ symbol: 'BAD', amount: 'not-a-number' }] });
assert.equal(malformed.length, 0, 'malformed or unheld assets must fail closed instead of entering My Vault');
console.log('Unified Vault checks passed: creator, wallet and user-bound provider assets keep separate provenance/truth labels; only positive provider positions become spatial holdings; direct-property claims are never inferred.');
await import('./test-purchased-twin-voxel.mjs');