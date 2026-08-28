import assert from 'node:assert/strict';
import { fetchOvertureBuildingNeighborhood } from '../lib/overture-building-tiles.js';

const point = {
  latitude: 40.748817,
  longitude: -73.985428,
  radiusMeters: 180,
};

const timeout = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Live Overture PMTiles lookup exceeded 25 seconds.')), 25_000);
});

const result = await Promise.race([
  fetchOvertureBuildingNeighborhood(point),
  timeout,
]);

assert.equal(result?.found, true, 'Live Overture PMTiles lookup must find a building in dense Midtown Manhattan.');
assert.ok(Number(result?.neighborhoodBuildingCount || 0) > 0, 'Live Overture lookup must return at least one real building footprint.');
assert.ok(Array.isArray(result?.neighborhoodBuildings) && result.neighborhoodBuildings[0]?.geometry, 'Live Overture lookup must return usable source-backed geometry.');
assert.equal(result?.source?.authority, 'Overture Maps Foundation', 'Live world lookup must retain Overture source attribution.');
assert.equal(result?.source?.license, 'ODbL', 'Live world lookup must retain the Buildings theme license.');
assert.match(String(result?.source?.release || ''), /^2026-07-22\.0$/, 'Live world lookup must use the reviewed Overture release.');
assert.equal(result?.legalEffects?.createsOwnership, false, 'Live world geometry must not create physical ownership rights.');
assert.equal(result?.legalEffects?.authoritativeParcelBoundary, false, 'Live world geometry must not be promoted to a cadastral parcel boundary.');

console.log(JSON.stringify({
  check: 'live-overture-world-atlas',
  buildingCount: result.neighborhoodBuildingCount,
  firstBuildingId: result.neighborhoodBuildings[0]?.overtureId || result.neighborhoodBuildings[0]?.id || null,
  firstDistanceMeters: result.neighborhoodBuildings[0]?.distanceMeters ?? null,
  release: result.source.release,
  cacheStatus: result.cacheStatus,
}, null, 2));
console.log('Live Overture world atlas smoke test passed.');
