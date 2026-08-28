import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fetchGlobalNeighborhoodReference } from '../lib/real-estate/global-neighborhood-reference.js';

function buildingWay(id, houseNumber, street, offset, tags = {}) {
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

function mappedWay(id, highway, coordinates, tags = {}) {
  return {
    type: 'way',
    id,
    tags: { highway, ...tags },
    geometry: coordinates.map(([lat, lon]) => ({ lat, lon })),
  };
}

let query = '';
const sourceFetch = async (_url, options = {}) => {
  query = new URLSearchParams(String(options.body || '')).get('data') || '';
  return {
    ok: true,
    json: async () => ({
      elements: [
        buildingWay(500, '620', 'Main St', 0.00000, { height: '9 m' }),
        buildingWay(501, '618', 'Main St', 0.00018, { 'building:levels': '4' }),
        mappedWay(700, 'primary', [
          [41.9997, -78.0002],
          [42.0001, -77.99995],
          [42.0005, -77.9997],
        ], { name: 'Main Street', lanes: '4' }),
        mappedWay(701, 'footway', [
          [42.0000, -78.0001],
          [42.0002, -77.9999],
        ], { surface: 'paved' }),
      ],
    }),
  };
};

const reference = await fetchGlobalNeighborhoodReference({
  address: '618 Main Street, Buffalo, NY',
  latitude: 42.00004,
  longitude: -77.99995,
  radiusMeters: 130,
}, { fetchImpl: sourceFetch, overpassUrl: 'https://map-context.example.test' });

assert.match(query, /\["building"\]/);
assert.match(query, /\["highway"\]/);
assert.equal(reference.matchStrategy, 'exact_source_address_match');
assert.equal(reference.source.recordId, 'way:501');
assert.equal(reference.publicRealm.found, true);
assert.equal(reference.publicRealm.mappedWayCount, 2);
assert.equal(reference.publicRealm.streetCount, 1);
assert.equal(reference.publicRealm.walkwayCount, 1);
assert.equal(reference.publicRealm.ways[0].geometry.type, 'LineString');
assert.equal(reference.publicRealm.ways.some((way) => way.kind === 'walkway'), true);
assert.equal(reference.publicRealm.ways.some((way) => way.tags.lanes === '4'), true);
assert.equal(Object.hasOwn(reference.publicRealm.ways[0], 'widthMeters'), false);
assert.equal(reference.publicRealm.legalEffects.definesParcelBoundary, false);
assert.equal(reference.publicRealm.legalEffects.provesRightOfWayWidth, false);
assert.equal(reference.publicRealm.legalEffects.provesSidewalkWidth, false);
assert.equal(reference.legalEffects.publicRealmDefinesParcelBoundary, false);
assert.match(reference.publicRealm.note, /map centerlines/i);
assert.match(reference.publicRealm.note, /stroke thickness is visual styling only/i);

const routeSource = fs.readFileSync(new URL('../app/api/geo/intake/route.ts', import.meta.url), 'utf8');
assert.match(routeSource, /mapped_public_realm_way_count/);
assert.match(routeSource, /mapped street\/path centerlines/i);
assert.match(routeSource, /stroke thickness and interpolated terrain mesh density are rendering choices/i);
assert.match(routeSource, /publicRealmCreatesParcelRights: false/);

const modelSource = fs.readFileSync(new URL('../app/geo/GeoReferenceModel.js', import.meta.url), 'utf8');
assert.match(modelSource, /function addPublicRealmContext/);
assert.match(modelSource, /LineDashedMaterial/);
assert.match(modelSource, /function addInterpolatedTerrain/);
assert.match(modelSource, /terrainRelativeMeters\(terrain, east, north\)/);
assert.match(modelSource, /function densifyLocalLine/);
assert.match(modelSource, /compassNeedleRef/);
assert.match(modelSource, /North compass/);
assert.match(modelSource, /mapped street\/path centerlines · stroke thickness is visual only/);
assert.match(modelSource, /interpolated visual surface from/);
assert.match(modelSource, /reference\?\.publicRealm\?\.mappedWayCount/);
assert.doesNotMatch(modelSource, /TubeGeometry|roadWidthMeters|sidewalkWidthMeters/);

console.log('GEO map context regression tests passed');