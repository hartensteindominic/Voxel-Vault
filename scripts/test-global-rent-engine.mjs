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
const { canAttachMintedVoxel, canEndLease, canTenantUseProperty, assertRentalTransition, archiveTenantAttachments, rentalTruth } = rental;

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
}), true, 'confirmed minted voxel may be associated with an active rental');
assert.equal(canAttachMintedVoxel({
  status: 'current',
  leaseVerifiedAt: '2026-08-01T00:00:00Z',
  tokenId: '',
  accountMintConfirmed: false,
}), false, 'unminted creation must not be permanently attached');

const archived = archiveTenantAttachments([{ id: 'attachment-1', tokenId: '42', voxelSessionId: 'voxel-1', status: 'active' }], '2026-09-01T00:00:00Z');
assert.equal(archived[0].status, 'archived', 'lease end archives tenant placement');
assert.equal(archived[0].tokenId, '42', 'lease end must not burn or delete renter-owned token identity');
assert.equal(archived[0].voxelSessionId, 'voxel-1', 'lease end must not transfer/delete renter-owned voxel record');

const truth = rentalTruth();
assert.equal(truth.automaticEviction, false, 'application must never claim automatic eviction');
assert.equal(truth.latePaymentEndsTenancy, false, 'late payment cannot itself terminate occupancy rights');
assert.equal(truth.tenantKeepsOwnedVoxelAfterLease, true, 'renter keeps separately owned voxels after lease end');

const [migration, tenantApi, adminApi, rentalPage] = await Promise.all([
  source('../supabase/migrations/020_property_rentals.sql'),
  source('../app/api/vault/rentals/[leaseId]/attachments/route.ts'),
  source('../app/api/admin/rentals/route.ts'),
  source('../app/vault/rentals/page.js'),
]);

assert.match(migration, /status <> 'ended'[\s\S]*termination_verified_at is not null[\s\S]*termination_reference_hash/i, 'database must require termination evidence before ended state');
assert.doesNotMatch(migration, /for insert to authenticated|for update to authenticated|for delete to authenticated/i, 'tenants must not self-verify or mutate authoritative lease/payment rows directly');
assert.match(tenantApi, /loadAccountVoxel/, 'tenant attachment API must verify the signed-in account voxel record server-side');
assert.match(tenantApi, /payload\?\.mint\?\.tokenId/, 'permanent attachment requires a confirmed mint token ID');
assert.match(adminApi, /requireVoxelVaultAdmin/, 'lease/payment reconciliation must be owner/provider-gated');
assert.match(adminApi, /automaticEviction:\s*false/, 'admin rental API must explicitly deny automatic eviction semantics');
assert.match(adminApi, /status:\s*'archived'/, 'verified lease end archives tenant placements instead of deleting assets');
assert.match(rentalPage, /does not automatically evict/i, 'renter UI must explain late payment does not automatically evict');
assert.match(rentalPage, /The voxel is still your separate asset/i, 'renter UI must preserve separate ownership of attached voxels');
assert.match(rentalPage, /PAY MONTHLY/, 'renter UI should keep the monthly payment flow simple and visible');

console.log('Global rent + legal tenant-layer safety checks passed.');
