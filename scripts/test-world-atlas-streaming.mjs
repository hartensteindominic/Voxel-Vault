import assert from 'node:assert/strict';
import {
  worldAtlasTileKey,
  WORLD_ATLAS_STREAM_MAX_BUILDINGS,
  WORLD_ATLAS_STREAM_MAX_RING,
} from '../lib/world-atlas-tile-stream.js';

const origin = worldAtlasTileKey(0, 0, 15);
assert.deepEqual(origin, { z: 15, x: 16384, y: 16384 }, 'Web Mercator origin should resolve deterministically at z15');

const northWest = worldAtlasTileKey(85, -179.999, 15);
const southEast = worldAtlasTileKey(-85, 179.999, 15);
for (const tile of [northWest, southEast]) {
  assert.equal(tile.z, 15);
  assert.ok(tile.x >= 0 && tile.x < 2 ** 15, 'tile x must stay inside the world');
  assert.ok(tile.y >= 0 && tile.y < 2 ** 15, 'tile y must stay inside Web Mercator bounds');
}

const buffaloA = worldAtlasTileKey(42.8864, -78.8784, 15);
const buffaloB = worldAtlasTileKey(42.88641, -78.87841, 15);
assert.deepEqual(buffaloA, buffaloB, 'nearby points inside one tile should share a streaming cache key');

assert.throws(() => worldAtlasTileKey(90, 0, 15), /Latitude is outside its valid range/);
assert.throws(() => worldAtlasTileKey(0, 181, 15), /Longitude is outside its valid range/);
assert.equal(WORLD_ATLAS_STREAM_MAX_BUILDINGS, 500, 'one server response must stay bounded');
assert.equal(WORLD_ATLAS_STREAM_MAX_RING, 1, 'one visible-region request may load at most a 3x3 tile neighborhood');

console.log('World atlas streaming engine tests passed: deterministic z15 tile keys, bounded world coordinates, invalid-coordinate rejection, and strict response/ring caps.');
