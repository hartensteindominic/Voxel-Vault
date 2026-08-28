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

const constants = fs.readFileSync(new URL('../lib/test-land-deploy.js', import.meta.url), 'utf8');
assert.match(constants, /TEST_LAND_CHAIN_ID = 84532/);
assert.match(constants, /TEST_LAND_CREATION_SHA256 = '0x16e3c9317b08a2e021195b4a53251e7485eac9fd958ee284337a4b58421c6590'/);
assert.match(constants, /TEST_LAND_RUNTIME_SHA256 = '0x484a6730263d66f35ff6d79cedc1a39691cb04fa9d844b5ae7319c4e00c8253d'/);
assert.match(constants, /TEST_LAND_MAX_PARCELS = 64/);
assert.match(constants, /TEST_LAND_MINT_PRICE_WEI = 100000000000000n/);
assert.doesNotMatch(constants, /mainnet\.base\.org|0x2105/i, 'Reviewed deployment constants must remain testnet-only.');

const bytecodeCheck = fs.readFileSync(new URL('../scripts/check-test-land-deploy-bytecode.mjs', import.meta.url), 'utf8');
assert.match(bytecodeCheck, /createHash\('sha256'\)/);
assert.match(bytecodeCheck, /TEST_LAND_CREATION_SHA256/);
assert.match(bytecodeCheck, /TEST_LAND_BYTECODE_PARTS/);

const deployPage = fs.readFileSync(new URL('../app/vault/test-land/deploy/page.js', import.meta.url), 'utf8');
assert.match(deployPage, /loadReviewedBytecode/);
assert.match(deployPage, /TEST_LAND_CREATION_SHA256/);
assert.match(deployPage, /TEST_LAND_RUNTIME_SHA256/);
assert.match(deployPage, /runtime\.length !== TEST_LAND_RUNTIME_BYTECODE_CHARS/);
assert.match(deployPage, /BigInt\(maxParcels\) !== BigInt\(TEST_LAND_MAX_PARCELS\)/);
assert.match(deployPage, /BigInt\(price\) !== TEST_LAND_MINT_PRICE_WEI/);
assert.match(deployPage, /BigInt\(totalMinted\) !== 0n/, 'Fresh deployment must be verified to contain zero pre-minted parcels.');
assert.match(deployPage, /factory\.deploy\(wallet\)/);
assert.match(deployPage, /window\.localStorage\.setItem\(RECOVERY_KEY/, 'Deployment tx must be recoverable before confirmation.');
assert.match(deployPage, /RECOVER PREVIOUS DEPLOYMENT — NO NEW GAS/);
assert.match(deployPage, /NO REAL PROPERTY/i);
assert.doesNotMatch(deployPage, /PRIVATE_KEY|DEPLOYER_PRIVATE_KEY|mainnet\.base\.org|0x2105/i, 'Browser deployer must not request a private key or expose a mainnet deployment path.');

const tests = fs.readFileSync(new URL('../test/VoxelTestLand.test.js', import.meta.url), 'utf8');
assert.match(tests, /blocks duplicate, out-of-range and incorrectly priced mints/i);
assert.match(tests, /metadata explicitly disclaims real-property and investment rights/i);
assert.match(tests, /only lets the owner withdraw accumulated test ETH/i);

console.log('Voxel Test Land safety checks passed.');
