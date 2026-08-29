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
  const polycounts = [...source.matchAll(/target_polycount:\s*(\d+)/g)].map((match) => Number(match[1]));
  assert.ok(polycounts.length > 0, `${name} must declare a target polycount`);
  for (const value of polycounts) {
    assert.ok(value >= 100 && value <= 15000, `${name} target_polycount ${value} must stay within the meshy-t2 100..15000 range`);
  }
  assert.ok(polycounts.includes(15000), `${name} should use the supported meshy-t2 maximum of 15000`);
}

console.log('Meshy property polycount checks passed: source and final 3D requests stay within the meshy-t2 100..15000 range.');
