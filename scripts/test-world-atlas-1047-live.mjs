import assert from 'node:assert/strict';
import { fetchBuffaloPropertyReference } from '../lib/real-estate/buffalo-property-reference.js';
import { inspectWorldAtlas } from '../lib/world-atlas.js';

const parcel = await fetchBuffaloPropertyReference({
  sbl: '90.32-8-4',
  pin: '1402000903200008004000',
});

assert.equal(parcel?.found, true, 'Live Buffalo parcel layer must resolve 1047 Kensington parcel 90.32-8-4.');
assert.equal(parcel?.printKey, '90.32-8-4', 'Live Buffalo result must remain bound to the exact parcel key.');
assert.equal(parcel?.address, '1047 KENSINGTON', 'Live Buffalo result must identify the expected address.');
assert.ok(Number.isFinite(Number(parcel?.latitude)), 'Live Buffalo parcel must return a source coordinate latitude.');
assert.ok(Number.isFinite(Number(parcel?.longitude)), 'Live Buffalo parcel must return a source coordinate longitude.');

const atlas = await inspectWorldAtlas({
  latitude: Number(parcel.latitude),
  longitude: Number(parcel.longitude),
  radiusMeters: 180,
});

assert.equal(atlas?.ok, true, 'World atlas must load around the live 1047 parcel coordinate.');
assert.equal(Number(atlas?.latitude), Number(parcel.latitude), 'World atlas must use the City coordinate rather than a guessed replacement latitude.');
assert.equal(Number(atlas?.longitude), Number(parcel.longitude), 'World atlas must use the City coordinate rather than a guessed replacement longitude.');
assert.ok(Array.isArray(atlas?.buildings), 'World atlas must return a bounded building array.');
assert.ok(atlas.buildings.length > 0, 'At least one source-backed building footprint must be available around the live 1047 parcel coordinate.');
assert.ok(atlas.buildings.length <= 36, '1047 region must keep the iPhone building cap.');
assert.ok(atlas?.sourceStatus?.primary === 'overture-pmtiles', '1047 should always attempt Overture first even if OSM fallback is later needed.');
assert.equal(atlas?.rights?.digitalStewardshipOnly, true, 'Mapping 1047 must not silently create physical property rights.');

console.log(JSON.stringify({
  check: 'live-1047-kensington-world-atlas',
  parcel: parcel.printKey,
  address: parcel.address,
  latitude: parcel.latitude,
  longitude: parcel.longitude,
  buildingCount: atlas.buildings.length,
  source: atlas.sourceStatus?.fallbackUsed ? atlas.sourceStatus?.fallback : atlas.sourceStatus?.primary,
}, null, 2));
console.log('Live 1047 Kensington world-atlas proof passed.');
