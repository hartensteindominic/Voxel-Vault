import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const voxel = await readFile(new URL('../app/components/VoxelViewer.js', import.meta.url), 'utf8');
const art = await readFile(new URL('../app/components/ArtPreview.js', import.meta.url), 'utf8');
const propertyTwin = await readFile(new URL('../app/real-estate/PropertyTwinCanvas.js', import.meta.url), 'utf8');
const geoReference = await readFile(new URL('../app/geo/GeoReferenceModel.js', import.meta.url), 'utf8');
const earthPage = await readFile(new URL('../app/vault/earth/page.js', import.meta.url), 'utf8');
const earthCss = await readFile(new URL('../app/vault/earth/earth-experience.module.css', import.meta.url), 'utf8');
const earthGlobe = await readFile(new URL('../app/vault/earth/GlobalEarthGlobe.js', import.meta.url), 'utf8');
const googleReality = await readFile(new URL('../app/vault/earth/GoogleRealityMap.js', import.meta.url), 'utf8');
const meshyViewer = await readFile(new URL('../app/vault/earth/MeshyModelViewer.js', import.meta.url), 'utf8');
const meshyPanel = await readFile(new URL('../app/vault/earth/MeshyHeroPanel.js', import.meta.url), 'utf8');
const realEstateCss = await readFile(new URL('../app/real-estate/real-estate.module.css', import.meta.url), 'utf8');

assert.match(voxel, /ResizeObserver/, 'VoxelViewer must observe its rendered frame');
assert.match(art, /ResizeObserver/, 'ArtPreview must observe its rendered frame');
assert.match(propertyTwin, /ResizeObserver/, 'PropertyTwinCanvas must observe its rendered frame');
assert.match(propertyTwin, /matchMedia\('\(max-width: 680px\)'\)/, 'PropertyTwinCanvas must keep explicit compact strategy');
assert.match(propertyTwin, /1\.25/, 'PropertyTwinCanvas must cap compact hyperreal pixel ratio');
assert.match(propertyTwin, /compactFrameInterval = 1000 \/ 30/, 'PropertyTwinCanvas must cap compact rendering at 30fps');
assert.match(propertyTwin, /prefers-reduced-motion/, 'PropertyTwinCanvas must respect reduced motion');
assert.match(geoReference, /ResizeObserver/, 'GEO must observe rendered frame');
assert.match(geoReference, /matchMedia\?\.\('\(max-width: 680px\)'\)/, 'GEO must keep compact mobile strategy');
assert.match(geoReference, /1\.18/, 'GEO must cap compact pixel ratio');
assert.match(geoReference, /prefers-reduced-motion/, 'GEO must respect reduced motion');

assert.match(earthGlobe, /compact \? 1\.18 : 1\.35/, 'Earth globe must keep strict compact pixel ratio');
assert.match(earthGlobe, /time - lastRender < 33/, 'Earth globe must cap compact rendering near 30fps');
assert.match(earthGlobe, /activePointers\.size >= 2/, 'Earth globe must retain two-finger pinch zoom');
assert.match(earthGlobe, /IntersectionObserver/, 'Earth globe must pause offscreen');
assert.match(earthGlobe, /prefers-reduced-motion/, 'Earth globe must respect reduced motion');

assert.match(googleReality, /height:50vh/, 'Google reality surface must have explicit compact phone height');
assert.match(googleReality, /min-height:360px/, 'Google reality surface must remain visible on iPhone');
assert.match(googleReality, /gestureHandling:\s*'COOPERATIVE'/, 'Google 3D must preserve one-finger page scrolling and use deliberate map gestures');
assert.match(googleReality, /OPEN IN GOOGLE MAPS/, 'Google 3D failure must leave navigable fallback');
assert.match(earthPage, />COMPARE</, 'Earth must expose compare mode on mobile');
assert.match(earthPage, />REALITY</, 'Earth must expose Reality mode on mobile');
assert.match(earthPage, />VOXEL</, 'Earth must expose Voxel mode on mobile');
assert.match(earthPage, />GLOBE</, 'Earth must expose Globe mode on mobile');
assert.match(earthPage, /GOOGLE_3D_ENABLED \? 'compare' : 'voxel'/, 'deployment without Google 3D must start in working Voxel view');
assert.match(earthCss, /grid-template-columns:repeat\(4,1fr\)/, 'four view tabs must become equal phone controls');
assert.match(earthCss, /\.compare\{height:auto;min-height:0;grid-template-columns:1fr/, 'Compare mode must stack Reality and Voxel vertically on compact screens');
assert.match(earthCss, /safe-area-inset-bottom/, 'Earth page must account for iPhone safe area');

assert.match(meshyViewer, /compact \? 1\.15 : 1\.35/, 'Meshy GLB viewer must keep strict compact pixel ratio');
assert.match(meshyViewer, /time - lastRender < 33/, 'Meshy GLB viewer must cap compact rendering near 30fps');
assert.match(meshyViewer, /pointers\.size >= 2/, 'Meshy GLB viewer must retain two-finger pinch zoom');
assert.match(meshyViewer, /IntersectionObserver/, 'Meshy GLB viewer must pause offscreen');
assert.match(meshyViewer, /prefers-reduced-motion/, 'Meshy GLB viewer must respect reduced motion');
assert.match(meshyPanel, /maxSide = 2048/, 'iPhone reference photos must normalize to bounded Meshy upload size');
assert.match(meshyPanel, /image\/jpeg/, 'iPhone reference normalization must output Meshy-compatible JPEG');

assert.match(realEstateCss, /mobileTabBar/, 'Real estate homepage must expose mobile quick navigation');
assert.match(realEstateCss, /safe-area-inset-bottom/, 'Real estate homepage must account for iPhone safe area');
assert.match(realEstateCss, /calc\(100% - 22px\)/, 'Real estate mobile shell width must use valid CSS math');

console.log('Mobile WebGL source guard passed: Voxel, GEO, Globe, Google Reality/Compare, Meshy GLB and iPhone reference-photo flows retain touch-safe mobile fallbacks and rendering limits.');
