import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function importSource(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(url);
}

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

const engine = await importSource('../lib/real-estate/global-asset-engine.js');
const jurisdiction = await importSource('../lib/real-estate/jurisdiction-gate.js');
const rental = await importSource('../lib/real-estate/property-rental.js');

const { LIVE_ACQUISITION_ENABLED, buildAcquisitionPlan, demoAssetCatalog, rankAssets } = engine;
const { evaluateJurisdictionGate, requiredJurisdictionChecks } = jurisdiction;
const { canAttachMintedVoxel, canEndLease, canTenantUseProperty, assertRentalTransition, archiveTenantAttachments, rentalTruth, tenantVoxelOwnershipMessage } = rental;

assert.equal(LIVE_ACQUISITION_ENABLED, false, 'live acquisition must remain disabled in the pilot');

const emptyGate = evaluateJurisdictionGate({});
assert.equal(emptyGate.eligible, false, 'jurisdiction must fail closed when checks are missing');
assert.equal(emptyGate.missing.length, requiredJurisdictionChecks.length, 'every jurisdiction check must be required');

const passedChecks = Object.fromEntries(requiredJurisdictionChecks.map((key) => [key, true]));
assert.equal(evaluateJurisdictionGate(passedChecks).eligible, true, 'fully verified jurisdiction record should pass');

const ranked = rankAssets(demoAssetCatalog, 10000);
assert.ok(ranked.length > 0, 'demo capital should produce at least one eligible candidate');
assert.ok(ranked.every((asset) => asset.legalStatus === 'eligible'), 'blocked/review assets must never be ranked as purchasable');
assert.ok(!ranked.some((asset) => asset.id === 'SCOOTER-DEMO-001'), 'future mobility adapter must remain blocked');

const plan = buildAcquisitionPlan({ capital: 10000, reserveFloor: 0.1 });
assert.equal(plan.liveAcquisitionEnabled, false, 'plan cannot represent a live acquisition');
assert.equal(plan.protectedReserve, 1000, '10% profile reserve should remain protected');
assert.ok(plan.spent <= 9000, 'engine must not spend the protected reserve');
assert.ok(plan.purchases.every((asset) => asset.acquisitionCost > 0), 'only valid positive-cost assets may be selected');

const tinyPlan = buildAcquisitionPlan({ capital: 400, reserveFloor: 0.1 });
assert.equal(tinyPlan.purchases.length, 0, 'engine must keep cash rather than force an unaffordable purchase');

// Real rental V1: payment delinquency may change workflow status, but does not itself
// terminate the lease or remove tenant-layer permissions.
for (const status of ['current', 'late', 'notice', 'legal-process']) {
  assert.equal(canTenantUseProperty({ status, leaseVerifiedAt: '2026-08-01T00:00:00Z' }), true, `${status} must retain tenant-layer access before lawful termination`);
}
assert.equal(canTenantUseProperty({ status: 'pending-verification', leaseVerifiedAt: null }), false, 'unverified lease cannot create tenant rights');
assert.equal(canTenantUseProperty({ status: 'ended', leaseVerifiedAt: '2026-08-01T00:00:00Z', terminationVerifiedAt: '2026-09-01T00:00:00Z' }), false, 'ended lease must make tenant layer read-only');
assert.equal(canEndLease({ terminationVerifiedAt: '2026-09-01T00:00:00Z', terminationReferenceHash: 'a'.repeat(64) }), true, 'verified termination evidence can close a lease');
assert.equal(canEndLease({ terminationVerifiedAt: '', terminationReferenceHash: '' }), false, 'late rent alone cannot close a lease');
assert.throws(() => assertRentalTransition('late', 'ended', { leaseVerifiedAt: '2026-08-01T00:00:00Z' }), /lawful termination/i, 'late rent must never auto-end tenancy');
assert.equal(assertRentalTransition('late', 'ended', {
  leaseVerifiedAt: '2026-08-01T00:00:00Z',
  terminationVerifiedAt: '2026-09-01T00:00:00Z',
  terminationReferenceHash: 'b'.repeat(64),
}), true, 'lawfully verified termination may end the digital tenant layer');

assert.equal(canAttachMintedVoxel({
  status: 'current',
  leaseVerifiedAt: '2026-08-01T00:00:00Z',
  tokenId: '42',
  accountMintConfirmed: true,
  walletOwnershipVerified: true,
}), true, 'account-confirmed mint plus current wallet owner proof may be associated with an active rental');
assert.equal(canAttachMintedVoxel({
  status: 'current',
  leaseVerifiedAt: '2026-08-01T00:00:00Z',
  tokenId: '42',
  accountMintConfirmed: true,
  walletOwnershipVerified: false,
}), false, 'a stored token ID alone is not enough to attach a voxel');
assert.equal(canAttachMintedVoxel({
  status: 'current',
  leaseVerifiedAt: '2026-08-01T00:00:00Z',
  tokenId: '',
  accountMintConfirmed: false,
  walletOwnershipVerified: false,
}), false, 'unminted creation must not be permanently attached');

const ownershipMessage = tenantVoxelOwnershipMessage({ userId: 'user-1', leaseId: 'lease-1', sessionId: 'voxel-1', tokenId: '42', signedAt: '2026-08-29T00:00:00.000Z' });
assert.match(ownershipMessage, /does not transfer the voxel, property, lease, money, or any ownership right/i, 'wallet proof must be non-transactional and narrowly scoped');

const archived = archiveTenantAttachments([{ id: 'attachment-1', tokenId: '42', voxelSessionId: 'voxel-1', status: 'active' }], '2026-09-01T00:00:00Z');
assert.equal(archived[0].status, 'archived', 'lease end archives tenant placement');
assert.equal(archived[0].tokenId, '42', 'lease end must not burn or delete renter-owned token identity');
assert.equal(archived[0].voxelSessionId, 'voxel-1', 'lease end must not transfer/delete renter-owned voxel record');

const truth = rentalTruth();
assert.equal(truth.automaticEviction, false, 'application must never claim automatic eviction');
assert.equal(truth.latePaymentEndsTenancy, false, 'late payment cannot itself terminate occupancy rights');
assert.equal(truth.attachmentRequiresWalletOwnershipProof, true, 'permanent tenant placement must require current wallet ownership proof');
assert.equal(truth.tenantKeepsOwnedVoxelAfterLease, true, 'renter keeps separately owned voxels after lease end');

const [migration, roomMigration, tenantApi, roomPhotoApi, adminApi, rentalPage, roomPanel, roomDecorator, voxelAccount, productMap, rentalDocs] = await Promise.all([
  source('../supabase/migrations/020_property_rentals.sql'),
  source('../supabase/migrations/021_rental_room_references.sql'),
  source('../app/api/vault/rentals/[leaseId]/attachments/route.ts'),
  source('../app/api/vault/rentals/[leaseId]/room-photo/route.ts'),
  source('../app/api/admin/rentals/route.ts'),
  source('../app/vault/rentals/page.js'),
  source('../app/vault/rentals/RentalRoomPanel.js'),
  source('../app/vault/rentals/BasicRoomDecorator.js'),
  source('../lib/voxelpop-account.ts'),
  source('../lib/product-map.js'),
  source('../docs/PROPERTY_RENTALS.md'),
]);

assert.match(migration, /status <> 'ended'[\s\S]*termination_verified_at is not null[\s\S]*termination_reference_hash/i, 'database must require termination evidence before ended state');
assert.doesNotMatch(migration, /for insert to authenticated|for update to authenticated|for delete to authenticated/i, 'tenants must not self-verify or mutate authoritative lease/payment rows directly');
assert.match(migration, /ownership_proof_hash/, 'tenant placement must retain a non-secret audit hash of wallet ownership proof');
assert.match(migration, /ownership_verified_at/, 'tenant placement must record when wallet ownership was checked');
assert.match(migration, /placed_transform jsonb/, 'tenant attachment schema must have a private placement transform');
assert.match(roomMigration, /vault_rental_room_references/, 'room references must live in a separate private rental table');
assert.match(roomMigration, /No authenticated client write policy/i, 'room-photo writes must stay behind signed-in server verification');
assert.match(roomMigration, /not public property evidence|not.*verified floor plans/i, 'room photo schema must deny property/floor-plan truth semantics');

assert.match(tenantApi, /loadAccountVoxel/, 'tenant attachment API must bind placement to the signed-in account voxel record');
assert.match(tenantApi, /verifyMessage/, 'tenant attachment API must verify a wallet signature server-side');
assert.match(tenantApi, /ownerOf/, 'tenant attachment API must check current on-chain token ownership');
assert.match(tenantApi, /walletOwnershipVerified:\s*true/, 'permanent attachment may pass only after wallet and chain verification');
assert.match(tenantApi, /ownershipVerifiedOnChain:\s*true/, 'successful attachment response must disclose that current chain ownership was verified');
assert.match(tenantApi, /export async function PATCH/, 'tenant attachment API must support saving decoration placement');
assert.match(tenantApi, /position:\s*\[clamp\([\s\S]*-3\.45, 3\.45\)[\s\S]*-2\.45, 2\.45\)/, 'room placement positions must be bounded server-side');
assert.match(tenantApi, /scale:\s*\[uniformScale, uniformScale, uniformScale\]/, 'room placement scale must be normalized server-side');
assert.match(tenantApi, /Canonical property geometry is unchanged/i, 'layout save must deny edits to canonical property truth');

assert.match(roomPhotoApi, /requireVoxelVaultUser/, 'room photo upload must require the signed-in renter');
assert.match(roomPhotoApi, /canTenantUseProperty/, 'room photo upload must require verified active tenant rights');
assert.match(roomPhotoApi, /rightsConfirmed/, 'room photo upload must require explicit photo rights confirmation');
assert.match(roomPhotoApi, /public:\s*false/, 'room photos must use private storage');
assert.match(roomPhotoApi, /createSignedUrl/, 'room photo viewing must use temporary signed URLs');
assert.match(roomPhotoApi, /not a verified floor plan or canonical property geometry/i, 'room photo API must label the upload as reference-only');

assert.match(adminApi, /requireVoxelVaultAdmin/, 'lease/payment reconciliation must be owner/provider-gated');
assert.match(adminApi, /automaticEviction:\s*false/, 'admin rental API must explicitly deny automatic eviction semantics');
assert.match(adminApi, /status:\s*'archived'/, 'verified lease end archives tenant placements instead of deleting assets');
assert.match(rentalPage, /does not automatically evict/i, 'renter UI must explain late payment does not automatically evict');
assert.match(rentalPage, /getWallet/, 'renter must explicitly connect/sign with the current token-owning wallet before placement');
assert.match(rentalPage, /On-chain ownership was checked/i, 'renter UI must disclose successful current-owner verification');
assert.match(rentalPage, /PAY MONTHLY/, 'renter UI should keep the monthly payment flow simple and visible');
assert.match(rentalPage, /UPLOAD ROOM/, 'renter flow must expose room photo upload before decoration');
assert.match(rentalPage, /RentalRoomPanel/, 'rented property page must include the room decoration experience');

assert.match(roomPanel, /Upload room photo/, 'room panel must offer a clear image upload action');
assert.match(roomPanel, /image\/\*,\.heic,\.heif/, 'room upload picker should support iPhone photo selection');
assert.match(roomPanel, /I took this photo or have permission to use it/, 'room upload must confirm user rights after preview');
assert.match(roomPanel, /ROOM REFERENCE · NOT VERIFIED FLOOR PLAN/, 'room upload must visibly deny floor-plan verification');
assert.match(roomPanel, /method:\s*'PATCH'/, 'room panel must persist selected voxel placement');
assert.match(roomPanel, /only changes your renter decoration layer/i, 'room panel must explain saved layout is tenant-only');

assert.match(roomDecorator, /BASIC ROOM · DECORATION LAYER/, 'decorator must label the approximate basic room');
assert.match(roomDecorator, /Not a verified floor plan/, 'decorator must deny exact floor-plan truth');
assert.match(roomDecorator, /Save layout/, 'decorator must provide an explicit touch-friendly persistence action');
assert.match(roomDecorator, /DRAG TO TURN ROOM · PINCH TO ZOOM · TAP A VOXEL/, 'decorator must expose mobile 3D controls');
assert.match(voxelAccount, /modelUrl:\s*String\(normalized\.payload\.mesh\?\.modelUrl/, 'rental room must receive ready VoxelPop GLB URLs when available');

assert.match(productMap, /href: '\/vault\/rentals', label: 'Rented'/, 'Rented must be discoverable from the simple VoxelPop property dock');
assert.match(productMap, /path === '\/vault\/rentals'/, 'Rented must stay inside the simplified property navigation mode');
assert.match(rentalDocs, /does \*\*not\*\* yet provide:[\s\S]*production e-signature provider/i, 'docs must fail closed about legal lease execution');
assert.match(rentalDocs, /late rent does not automatically end tenancy/i, 'docs must preserve lawful termination boundary');

console.log('Global rent + room decorator safety checks passed: verified lease -> monthly status -> private room reference -> wallet-owned minted voxels -> bounded tenant layout -> lawful lease end/archive, never automatic eviction or fake floor-plan truth.');
