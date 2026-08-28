import fs from 'node:fs';
import assert from 'node:assert/strict';

const hero = fs.readFileSync(new URL('../app/real-estate/PropertyTwinCanvas.js', import.meta.url), 'utf8');
const geo = fs.readFileSync(new URL('../app/geo/GeoReferenceModel.js', import.meta.url), 'utf8');

assert.match(hero, /InstancedMesh/, 'hero building should use instanced voxel construction');
assert.match(hero, /masonryFacade/, 'hero building should have block-built masonry relief');
assert.match(hero, /masonrySide/, 'hero building should voxelize side walls too');
assert.match(hero, /ACESFilmicToneMapping/, 'hero should use filmic tone mapping');
assert.match(hero, /PCFSoftShadowMap/, 'hero should keep soft architectural shadows');
assert.match(hero, /warm interior glow|warm window accents/i, 'hero should include warm architectural light treatment');
assert.match(hero, /Stepped voxel mansard roof/, 'illustrative hero should be explicitly block-built through the roof');
assert.match(hero, /visual demo only, not a sourced property record/, 'illustrative hero must not masquerade as a sourced property');
assert.match(hero, /compactFrameInterval/, 'dense hero must keep the compact frame cap');
assert.match(hero, /prefers-reduced-motion/, 'dense hero must respect reduced motion');

assert.match(geo, /addVoxelShell/, 'GEO must retain source-geometry voxel massing');
assert.match(geo, /facade details not inferred|unsupported architectural details are not invented/, 'GEO must preserve no-fabrication language');
assert.doesNotMatch(geo, /invented windows|invented roof|invented chimney/i);

console.log('Hyperreal voxel building regression tests passed');
