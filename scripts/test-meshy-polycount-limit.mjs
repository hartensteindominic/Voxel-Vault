import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const paidPhotoRoute = read('app/api/property-photo-upload/route.ts');
const property3dRoute = read('app/api/property-voxel-3d/route.ts');

// The paid house flow may use the configured VoxelPop image provider for the
// transient voxel-image review, but its final interactive 3D build stays on
// the local WebGL v2 engine. Keep this guard explicit so a future change
// cannot silently reconnect the paid resume route to metered Meshy 3D.
assert.match(paidPhotoRoute, /provider:\s*'[^']*voxelpop-local-webgl-v2[^']*'/, 'paid photo resume must declare the local VoxelPop WebGL v2 engine');
assert.doesNotMatch(paidPhotoRoute, /ai_model:\s*'meshy-t2'|target_polycount|api\.meshy|image-to-3d/i, 'paid photo resume must not call the Meshy 3D generation API');

// Standalone/legacy provider-backed 3D routes still keep their Meshy contract
// bounded correctly when they are used outside the guided house flow.
assert.match(property3dRoute, /ai_model:\s*'meshy-t2'/, 'standalone voxel image -> 3D must keep the intended Meshy model explicit');
const polycounts = [...property3dRoute.matchAll(/target_polycount:\s*(\d+)/g)].map((match) => Number(match[1]));
assert.ok(polycounts.length > 0, 'standalone Meshy 3D route must declare a target polycount');
for (const value of polycounts) {
  assert.ok(value >= 100 && value <= 15000, `standalone Meshy target_polycount ${value} must stay within the meshy-t2 100..15000 range`);
}
assert.ok(polycounts.includes(15000), 'standalone Meshy 3D route should use the supported meshy-t2 maximum of 15000');

console.log('Meshy/local generation guard passed: the paid house flow keeps its final 3D build local/WebGL v2, while standalone Meshy 3D requests remain within the meshy-t2 100..15000 range.');
