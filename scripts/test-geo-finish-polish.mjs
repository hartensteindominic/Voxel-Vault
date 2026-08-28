import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fetchGlobalNeighborhoodReference } from '../lib/real-estate/global-neighborhood-reference.js';

function way(id, houseNumber, street, offset, tags = {}) {
  const lat = 42 + offset;
  return {
    type: 'way',
    id,
    tags: { building: 'yes', 'addr:housenumber': houseNumber, 'addr:street': street, ...tags },
    geometry: [
      { lat, lon: -78.00000 },
      { lat, lon: -77.99990 },
      { lat: lat + 0.00008, lon: -77.99990 },
      { lat: lat + 0.00008, lon: -78.00000 },
      { lat, lon: -78.00000 },
    ],
  };
}

const addressAwareFetch = async () => ({
  ok: true,
  json: async () => ({
    elements: [
      way(500, '620', 'Main St', 0.00000, { height: '9 m' }),
      way(501, '618', 'Main St', 0.00018, { 'building:levels': '4' }),
    ],
  }),
});

const matched = await fetchGlobalNeighborhoodReference({
  address: '618 Main Street, Buffalo, NY',
  latitude: 42.00004,
  longitude: -77.99995,
  radiusMeters: 130,
}, { fetchImpl: addressAwareFetch, overpassUrl: 'https://address-match.example.test' });

assert.equal(matched.found, true);
assert.equal(matched.matchStrategy, 'exact_source_address_match');
assert.equal(matched.addressMatch.exactSourceAddressMatch, true);
assert.equal(matched.addressMatch.sourceHouseNumber, '618');
assert.equal(matched.addressMatch.sourceStreet, 'Main St');
assert.equal(matched.source.recordId, 'way:501');
assert.equal(matched.neighborhoodBuildings[0].id, 'way:501');
assert.equal(matched.neighborhoodBuildings[0].selected, true);
assert.equal(matched.height.referenceHeightMeters, 12);
assert.equal(matched.legalEffects.authoritativeParcelBoundary, false);
assert.match(matched.note, /address tags matching/i);

const fallbackFetch = async () => ({
  ok: true,
  json: async () => ({ elements: [
    way(600, '620', 'Main St', 0.00000),
    way(601, '622', 'Main St', 0.00020),
  ] }),
});

const fallback = await fetchGlobalNeighborhoodReference({
  address: '618 Main Street, Buffalo, NY',
  latitude: 42.00004,
  longitude: -77.99995,
  radiusMeters: 130,
}, { fetchImpl: fallbackFetch, overpassUrl: 'https://nearest-fallback.example.test' });

assert.equal(fallback.matchStrategy, 'nearest_source_building_within_neighborhood');
assert.equal(fallback.addressMatch.exactSourceAddressMatch, false);
assert.equal(fallback.source.recordId, 'way:600');
assert.match(fallback.note, /nearest source-backed building footprint as reference context/i);
assert.equal(fallback.legalEffects.verifiesTitle, false);
assert.equal(fallback.legalEffects.createsOwnership, false);

const routeSource = fs.readFileSync(new URL('../app/api/geo/intake/route.ts', import.meta.url), 'utf8');
assert.match(routeSource, /fetchGlobalNeighborhoodReference\(\{ address: intake\.address,/);
assert.match(routeSource, /nearest source building reference only/i);

const modelSource = fs.readFileSync(new URL('../app/geo/GeoReferenceModel.js', import.meta.url), 'utf8');
assert.match(modelSource, /function addParcelBoundary/);
assert.match(modelSource, /authoritativeTwin\?\.location\?\.parcelGeometry/);
assert.match(modelSource, /cameraPreset\(viewMode, sceneRadius, compactMode, focusRadius, focusHeight\)/);
assert.match(modelSource, /const compactFrameInterval = 1000 \/ 30/);
assert.match(modelSource, /IntersectionObserver/);
assert.match(modelSource, /visibilitychange/);
assert.match(modelSource, /renderer\.domElement\.tabIndex = 0/);
assert.match(modelSource, /Nearest source-backed building/);
assert.doesNotMatch(modelSource, /invented window|invented roof|fake facade/i);

console.log('GEO finish polish regression tests passed');
