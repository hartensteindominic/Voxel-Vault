import assert from 'node:assert/strict';
import fs from 'node:fs';

const contract = fs.readFileSync(new URL('../contracts/VoxelTestLand.sol', import.meta.url), 'utf8');
assert.match(contract, /uint256 public constant MAX_PARCELS = 64;/, 'Test Land supply must remain finite at 64 parcels.');
assert.match(contract, /uint256 public constant MINT_PRICE = 0\.0001 ether;/, 'Test Land mint price must remain explicit and fixed for the demo.');
assert.match(contract, /block\.chainid != 84532 && block\.chainid != 31337/, 'Test Land contract must reject production-chain deployment.');
assert.match(contract, /ParcelAlreadyMinted/, 'A parcel must never be minted twice.');
assert.match(contract, /msg\.value != MINT_PRICE/, 'Mint must require the exact reviewed test price.');
assert.match(contract, /No deed, real property, rent, security, or investment rights/i, 'On-chain metadata must disclose that Test Land is not real property or an investment.');
assert.doesNotMatch(contract, /PropertyInterestToken|DistributionVault|rentDistribution|deedTransfer/i, 'Test Land must not contain real-property investment or rent-distribution logic.');

const deploy = fs.readFileSync(new URL('../scripts/deploy-test-land.js', import.meta.url), 'utf8');
assert.match(deploy, /network\.chainId !== 84532n/, 'Deployment script must be Base Sepolia-only.');
assert.match(deploy, /No parcels were minted automatically/i, 'Deployment must not auto-mint land.');
assert.doesNotMatch(deploy, /mintParcel\s*\(/, 'Deployment script must not mint a parcel.');

const page = fs.readFileSync(new URL('../app/vault/test-land/page.js', import.meta.url), 'utf8');
assert.match(page, /const CHAIN_ID = '0x14a34'/, 'Browser flow must target Base Sepolia.');
assert.match(page, /TESTNET ONLY/i);
assert.match(page, /No deed, physical land, rent, security, or investment rights/i, 'UI must clearly distinguish fictional Test Land from real property.');
assert.match(page, /parcelOwner\(selected\)/, 'UI must re-check ownership immediately before minting.');
assert.match(page, /mintParcel\(selected, \{ value: price \}\)/, 'Mint must use the contract-reported exact price.');
assert.match(page, /tx\.wait\(\)/, 'UI must wait for a confirmed receipt before claiming ownership.');
assert.doesNotMatch(page, /0x2105|mainnet\.base\.org|basescan\.org\/tx/i, 'Test Land browser flow must not expose a Base mainnet write path.');

const tests = fs.readFileSync(new URL('../test/VoxelTestLand.test.js', import.meta.url), 'utf8');
assert.match(tests, /blocks duplicate, out-of-range and incorrectly priced mints/i);
assert.match(tests, /metadata explicitly disclaims real-property and investment rights/i);
assert.match(tests, /only lets the owner withdraw accumulated test ETH/i);

console.log('Voxel Test Land safety checks passed.');
