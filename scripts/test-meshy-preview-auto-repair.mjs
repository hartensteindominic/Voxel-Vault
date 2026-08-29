import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const viewer = read('app/vault/earth/MeshyModelViewer.js');
const propertyRoute = read('app/api/property-voxel-3d/route.ts');
const atlasRoute = read('app/api/world-atlas/mesh/route.ts');

assert.doesNotMatch(viewer, /cached Meshy GLB could not be loaded/i, 'viewer must not dead-end with the old cached GLB error');
assert.match(viewer, /3D IMAGE → INTERACTIVE 3D/, 'viewer must visibly stage the rendered 3D image before interactive GLB');
assert.match(viewer, /vvPreview/, 'viewer must read server-supplied Meshy thumbnail metadata');
assert.match(viewer, /vvRepair/, 'viewer must read server-supplied cache repair metadata');
assert.match(viewer, /getSupabaseBrowserAsync/, 'cache repair must authenticate the current signed-in account');
assert.match(viewer, /Refreshing interactive 3D/, 'viewer must retry a normal GLB load before repairing');
assert.match(viewer, /Repairing cached 3D from the completed Meshy job/, 'viewer must surface automatic repair progress');
assert.match(viewer, /recoveryRequested/, 'viewer must bound automatic cache repair attempts');

for (const [label, route] of [['property', propertyRoute], ['world atlas', atlasRoute]]) {
  assert.match(route, /Range: 'bytes=0-0'/, `${label} route must validate cached GLB readability before reuse`);
  assert.match(route, /repairCache = url\.searchParams\.get\('repair'\) === '1'/, `${label} route must expose explicit repair mode`);
  assert.match(route, /\(!cachedPlaybackUrl \|\| repairCache\)/, `${label} route must overwrite a missing or explicitly broken cache`);
  assert.match(route, /persistModelBinary/, `${label} route must repair from the existing completed provider GLB`);
  assert.match(route, /vvPreview/, `${label} route must attach the provider thumbnail for image-first display`);
  assert.match(route, /vvRepair/, `${label} route must attach an authenticated repair endpoint to the viewer URL`);
}

assert.doesNotMatch(propertyRoute, /repairCache[\s\S]{0,1200}method:\s*'POST'/, 'property cache repair must not start a new Meshy generation');
assert.doesNotMatch(atlasRoute, /repairCache[\s\S]{0,1200}method:\s*'POST'/, 'atlas cache repair must not start a new Meshy generation');

console.log('Meshy preview/repair regression passed: rendered 3D image first, interactive GLB second, and broken private caches auto-repair from the completed Meshy task without regeneration.');
