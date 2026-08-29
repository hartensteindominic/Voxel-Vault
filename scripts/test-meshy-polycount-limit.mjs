import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const directPhotoRoute = read('app/api/property-photo-upload/route.ts');
const property3dRoute = read('app/api/property-voxel-3d/route.ts');

for (const [name, source] of [
  ['direct photo -> 3D', directPhotoRoute],
  ['voxel image -> final 3D', property3dRoute],
]) {
  assert.match(source, /ai_model:\s*'meshy-t2'/, `${name} must keep the intended Meshy model explicit`);
  assert.match(source, /target_polycount:\s*15000/, `${name} must stay within the meshy-t2 maximum polycount`);
  assert.doesNotMatch(source, /target_polycount:\s*(?:1[5-9]\d{3}|[2-9]\d{4,})/, `${name} must never request more than 15000 polygons from meshy-t2`);
}

console.log('Meshy property polycount checks passed: source and final 3D requests stay at the meshy-t2 maximum of 15000.');
