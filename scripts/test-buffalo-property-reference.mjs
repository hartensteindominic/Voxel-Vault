import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BUFFALO_CURRENT_PARCEL_LAYER,
  fetchBuffaloPropertyReference,
  normalizeBuffaloReferenceLookup,
} from '../lib/real-estate/buffalo-property-reference.js';

assert.deepEqual(
  normalizeBuffaloReferenceLookup({ sbl: '90.32-8-4', pin: '1402000903200008004000' }),
  { printKey: '90.32-8-4', rawSbl: '0903200008004000' },
  'Buffalo reference should accept county print key and derive raw city SBL from Erie PIN',
);

assert.throws(
  () => normalizeBuffaloReferenceLookup({ sbl: "90.32-8-4' OR '1'='1" }),
  /only letters, numbers, periods and hyphens/,
  'unsafe parcel keys must be rejected before the ArcGIS where clause is built',
);

const calls = [];
const mockFetch = async (url) => {
  calls.push(String(url));
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        features: [{
          attributes: {
            OBJECTID: 1047,
            SBL: '0903200008004000',
            Print_Key: '90.32-8-4',
            Front: 34,
            Depth: 120,
            House_Number: '1047',
            Street: 'KENSINGTON',
            Address: '1047 KENSINGTON',
            Zipcode: '14215',
            Year_Built: '1920',
            First_Story_Area: 1008,
            Second_Story_Area: 1008,
            Total_Living_Area: 2016,
            Building_Style_Code: '08',
            Building_Style_Description: 'Two story residence',
            Number_of_Units: 3,
            F__of_Stories: 2,
            Exterior_Wall_Code: 'C',
            Exterior_Wall_Description: 'Composite siding',
            Overall_Condition: 'A',
            Overall_Condition_Description: 'Average',
            Story_Height: 9,
            Latitude: 42.931,
            Longitude: -78.805,
            LandUse: 'Residential',
            Owner1: 'DO NOT RETURN',
            Mail1: 'DO NOT RETURN MAIL',
          },
        }],
      };
    },
  };
};

const result = await fetchBuffaloPropertyReference(
  { sbl: '90.32-8-4', pin: '1402000903200008004000' },
  { fetchImpl: mockFetch, observedAt: '2026-08-28T19:40:00Z' },
);

assert.equal(calls.length, 1);
assert.ok(calls[0].startsWith(`${BUFFALO_CURRENT_PARCEL_LAYER}/query?`));
const query = new URL(calls[0]);
assert.equal(query.searchParams.get('where'), "Print_Key='90.32-8-4'");
assert.equal(query.searchParams.get('returnGeometry'), 'false');
assert.equal(query.searchParams.get('outFields').includes('Owner1'), false);
assert.equal(query.searchParams.get('outFields').includes('Mail'), false);

assert.equal(result.found, true);
assert.equal(result.printKey, '90.32-8-4');
assert.equal(result.rawSbl, '0903200008004000');
assert.equal(result.address, '1047 KENSINGTON');
assert.equal(result.frontageFt, 34);
assert.equal(result.depthFt, 120);
assert.equal(result.totalLivingAreaSqFt, 2016);
assert.equal(result.stories, 2);
assert.equal(result.numberOfUnits, 3);
assert.equal(result.exteriorWallDescription, 'Composite siding');
assert.equal(result.visualMaterialClass, 'siding');
assert.equal(result.visualHeightMethod, 'city_story_count_x_story_height_reference');
assert.ok(Math.abs(result.visualHeightReferenceMeters - 5.4864) < 0.0001);
assert.ok(Object.values(result.legalEffects).every((value) => value === false));
assert.match(result.sourceLimitations.join(' '), /not a current-condition architectural survey/i);
assert.match(result.sourceLimitations.join(' '), /exact color, window placement, doors, porch geometry and roof form remain unverified/i);

const serialized = JSON.stringify(result);
assert.equal(serialized.includes('DO NOT RETURN'), false, 'owner identity must never enter the public rendering reference');
assert.equal(serialized.includes('DO NOT RETURN MAIL'), false, 'mailing data must never enter the public rendering reference');

const page = fs.readFileSync(new URL('../app/geo/page.js', import.meta.url), 'utf8');
const wrapper = fs.readFileSync(new URL('../app/geo/BuffaloCalibratedReferenceModel.js', import.meta.url), 'utf8');
const route = fs.readFileSync(new URL('../app/api/geo/buffalo-reference/route.ts', import.meta.url), 'utf8');

assert.match(page, /1047 Kensington Avenue, Buffalo, NY 14215/);
assert.match(page, /sbl: '90\.32-8-4'/);
assert.match(page, /\/api\/geo\/buffalo-reference/);
assert.match(page, /BuffaloCalibratedReferenceModel/);
assert.match(wrapper, /buildingGeometry: null/);
assert.match(wrapper, /heightStatus: 'derived_from_levels'/);
assert.match(wrapper, /Story count\/material class calibrate the render only/);
assert.match(route, /fetchBuffaloPropertyReference/);

console.log('Buffalo property reference calibration checks passed: 1047 starts from exact parcel identity, City assessment fields calibrate visual massing only, and owner/mailing data remain excluded.');
