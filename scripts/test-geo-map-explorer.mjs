import assert from 'node:assert/strict';
import fs from 'node:fs';

const modelSource = fs.readFileSync(new URL('../app/geo/GeoReferenceModel.js', import.meta.url), 'utf8');

assert.match(modelSource, /useState/);
assert.match(modelSource, /function publicRealmLineClass/);
assert.match(modelSource, /majorStreetMaterial/);
assert.match(modelSource, /secondaryStreetMaterial/);
assert.match(modelSource, /serviceMaterial/);
assert.match(modelSource, /function createTextSprite/);
assert.match(modelSource, /CanvasTexture/);
assert.match(modelSource, /streetLabels/);
assert.match(modelSource, /const updateLod/);
assert.match(modelSource, /contextDetails/);
assert.match(modelSource, /new THREE\.Raycaster/);
assert.match(modelSource, /raycaster\.intersectObjects\(pickables/);
assert.match(modelSource, /Tap a building, street, path, or parcel to inspect its evidence/);
assert.match(modelSource, /Source-backed parcel boundary/);
assert.match(modelSource, /translucent fill = source-backed parcel boundary/);
assert.match(modelSource, /Mapped building/);
assert.match(modelSource, /Mapped street/);
assert.match(modelSource, /Mapped path/);
assert.match(modelSource, /source street names appear as you zoom closer/i);
assert.match(modelSource, /without inventing road width/i);
assert.match(modelSource, /cartographic styling only/i);
assert.match(modelSource, /elevation: 1\.49/);
assert.match(modelSource, /const compactFrameInterval = 1000 \/ 30/);
assert.match(modelSource, /matchMedia\?\.\('\(max-width: 680px\)'\)/);
assert.match(modelSource, /prefers-reduced-motion/);
assert.doesNotMatch(modelSource, /TubeGeometry|roadWidthMeters|sidewalkWidthMeters/);

console.log('GEO interactive map explorer regression tests passed');
