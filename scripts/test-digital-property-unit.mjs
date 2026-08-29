import assert from 'node:assert/strict';
import { quoteDigitalPropertyUnit } from '../lib/real-estate/digital-property-unit.js';

const same = quoteDigitalPropertyUnit({ referencePropertyValue: 250000, propertyValue: 250000 });
assert.equal(same.ready, true);
assert.equal(same.priceCents, 199);
assert.equal(same.ratio, 1);

const half = quoteDigitalPropertyUnit({ referencePropertyValue: 250000, propertyValue: 125000 });
assert.equal(half.priceCents, 100);
assert.equal(half.ratio, 0.5);

const double = quoteDigitalPropertyUnit({ referencePropertyValue: 250000, propertyValue: 500000 });
assert.equal(double.priceCents, 398);
assert.equal(double.ratio, 2);

const invalid = quoteDigitalPropertyUnit({ referencePropertyValue: 0, propertyValue: 250000 });
assert.equal(invalid.ready, false);
assert.equal(invalid.priceCents, null);

console.log('digital property unit pricing tests passed');
