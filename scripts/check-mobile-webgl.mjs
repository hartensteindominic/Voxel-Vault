import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const voxel = await readFile(new URL('../app/components/VoxelViewer.js', import.meta.url), 'utf8');
const art = await readFile(new URL('../app/components/ArtPreview.js', import.meta.url), 'utf8');
const propertyTwin = await readFile(new URL('../app/real-estate/PropertyTwinCanvas.js', import.meta.url), 'utf8');
const geoReference = await readFile(new URL('../app/geo/GeoReferenceModel.js', import.meta.url), 'utf8');
const realEstateCss = await readFile(new URL('../app/real-estate/real-estate.module.css', import.meta.url), 'utf8');

// Passive mobile rendering must not be silently disabled by a workflow mutation.
// The guard only verifies that the source retains an explicit mobile strategy.
assert.match(voxel, /ResizeObserver/, 'VoxelViewer must observe its rendered frame');
assert.match(art, /ResizeObserver/, 'ArtPreview must observe its rendered frame');
assert.match(propertyTwin, /ResizeObserver/, 'PropertyTwinCanvas must observe its rendered frame');
assert.match(propertyTwin, /matchMedia\('\(max-width: 680px\)'\)/, 'PropertyTwinCanvas must keep an explicit compact mobile strategy');
assert.match(propertyTwin, /1\.25/, 'PropertyTwinCanvas must cap the denser hyperreal compact scene at 1.25 pixel ratio');
assert.match(propertyTwin, /compactFrameInterval = 1000 \/ 30/, 'PropertyTwinCanvas must cap dense compact rendering at 30fps');
assert.match(propertyTwin, /prefers-reduced-motion/, 'PropertyTwinCanvas must respect reduced motion');
assert.match(geoReference, /ResizeObserver/, 'GEO must observe its rendered 3D frame');
assert.match(geoReference, /matchMedia\?\.\('\(max-width: 680px\)'\)/, 'GEO must keep an explicit compact mobile strategy');
assert.match(geoReference, /1\.18/, 'GEO must cap compact mobile pixel ratio');
assert.match(geoReference, /prefers-reduced-motion/, 'GEO must respect reduced motion');
assert.match(realEstateCss, /mobileTabBar/, 'Real estate homepage must expose mobile quick navigation');
assert.match(realEstateCss, /safe-area-inset-bottom/, 'Real estate homepage must account for iPhone safe-area insets');
assert.match(realEstateCss, /calc\(100% - 22px\)/, 'Real estate mobile shell width must use valid CSS math');

console.log('Mobile WebGL source guard passed.');
