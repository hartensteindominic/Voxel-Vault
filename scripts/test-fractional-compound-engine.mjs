import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function importSource(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(url);
}

const engine = await importSource('../lib/real-estate/fractional-compound-engine.js');
const {
  FRACTIONAL_ENGINE_MODE,
  LIVE_FRACTIONAL_EXECUTION_ENABLED,
  buildFractionalPlan,
  simulateDailyAutoCompound,
} = engine;

assert.equal(FRACTIONAL_ENGINE_MODE, 'simulation');
assert.equal(LIVE_FRACTIONAL_EXECUTION_ENABLED, false, 'live fractional purchases must remain disabled');

const plan = buildFractionalPlan({ capital: 1000 });
assert.equal(plan.startingCapital, 1000);
assert.equal(plan.protectedReserve, 100, 'the default pilot must protect 10% of starting cash');
assert.ok(plan.investedValue > 0, 'the $1,000 demo should model fractional property holdings');
assert.ok(plan.investedValue + plan.feesPaid + plan.reinvestmentWallet <= 900.000001, 'the allocation cannot spend the protected reserve');
assert.ok(plan.holdings.length >= 3, 'the default $1,000 plan should diversify across multiple demo properties');
assert.ok(plan.holdings.every((holding) => holding.positionValue <= plan.investableCapital * 0.25 + 0.000001), 'first allocation must respect the 25% per-property concentration cap');

const compound = simulateDailyAutoCompound({ capital: 1000, years: 5 });
assert.equal(compound.liveExecutionEnabled, false);
assert.ok(compound.autoPurchases > 0, 'modeled net rent should eventually buy additional shares');
assert.equal(compound.timeline.length, 5, 'five-year simulation should expose five yearly checkpoints');
assert.ok(compound.timeline.at(-1).totalEconomicValue > 1000, 'positive demo rent should increase modeled economic value before taxes and external costs');

const tiny = buildFractionalPlan({ capital: 100 });
assert.ok(tiny.protectedReserve >= 10);
assert.equal(tiny.liveExecutionEnabled, false);

console.log('Fractional property auto-compound checks passed: $1,000 allocation diversifies, reserves cash, reinvests modeled rent and cannot execute live purchases.');
