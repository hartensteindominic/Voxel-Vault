import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const directPhotoRoute = read('app/api/property-photo-upload/route.ts');
const property3dRoute = read('app/api/property-voxel-3d/route.ts');

// Normal Property creation no longer hands the photo to Meshy at all. Keep this
// regression explicit so a future compatibility edit cannot silently make the
// $4.99 creation path spend provider credits again.
assert.match(directPhotoRoute, /paidPropertyGenerationReceipt/, 'retired photo handoff may only verify an already-paid creation');
assert.match(directPhotoRoute, /migrated: true/, 'retired photo handoff must direct clients to the zero-credit maker');
assert.match(directPhotoRoute, /meshyCredits: 0/, 'retired photo handoff must explicitly report zero Meshy credits');
assert.doesNotMatch(directPhotoRoute, /api\.meshy\.ai|MESHY_API_KEY|ai_model|target_polycount|image-to-3d|readMeshyCreditBalance/, 'normal paid property photo handoff must never call or configure Meshy');

// A legacy/manual 3D route still exists elsewhere in the app. If that route is
// deliberately used by another surface, keep its provider request bounded to
// Meshy's supported meshy-t2 polycount range. The Property maker does not call it.
assert.match(property3dRoute, /ai_model:\s*'meshy-t2'/, 'legacy/manual property 3D route must keep the intended Meshy model explicit');
const polycounts = [...property3dRoute.matchAll(/target_polycount:\s*(\d+)/g)].map((match) => Number(match[1]));
assert.ok(polycounts.length > 0, 'legacy/manual property 3D route must declare a target polycount');
for (const value of polycounts) {
  assert.ok(value >= 100 && value <= 15000, `legacy/manual property 3D target_polycount ${value} must stay within the meshy-t2 100..15000 range`);
}
assert.ok(polycounts.includes(15000), 'legacy/manual property 3D route should keep the supported meshy-t2 maximum of 15000');

console.log('Property 3D regression passed: the normal $4.99 Property maker spends zero Meshy credits and its retired photo handoff cannot invoke Meshy; any separate legacy/manual Meshy 3D route remains bounded to meshy-t2 100..15000.');
