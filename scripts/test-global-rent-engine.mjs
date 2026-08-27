import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function importSource(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(url);
}

const engine = await importSource('../lib/real-estate/global-asset-engine.js');
const jurisdiction = await importSource('../lib/real-estate/jurisdiction-gate.js');

const { LIVE_ACQUISITION_ENABLED, buildAcquisitionPlan, demoAssetCatalog, rankAssets } = engine;
const { evaluateJurisdictionGate, requiredJurisdictionChecks } = jurisdiction;

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

console.log('Global rent engine safety checks passed.');
