import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const voxel = await readFile(new URL('../app/components/VoxelViewer.js', import.meta.url), 'utf8');
const art = await readFile(new URL('../app/components/ArtPreview.js', import.meta.url), 'utf8');
const propertyTwin = await readFile(new URL('../app/real-estate/PropertyTwinCanvas.js', import.meta.url), 'utf8');
const geoReference = await readFile(new URL('../app/geo/GeoReferenceModel.js', import.meta.url), 'utf8');
const earthPage = await readFile(new URL('../app/vault/earth/page.js', import.meta.url), 'utf8');
const earthCss = await readFile(new URL('../app/vault/earth/earth-experience.module.css', import.meta.url), 'utf8');
const earthGlobe = await readFile(new URL('../app/vault/earth/GlobalEarthGlobe.js', import.meta.url), 'utf8');
const planetGlobe = await readFile(new URL('../app/vault/earth/PlanetStreamGlobe.js', import.meta.url), 'utf8');
const openReality = await readFile(new URL('../app/vault/earth/OpenRealityPanel.js', import.meta.url), 'utf8');
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

assert.match(planetGlobe, /compact \? 1\.15 : 1\.35/, 'streaming Earth globe must keep strict compact pixel ratio');
assert.match(planetGlobe, /time - lastRender < 33/, 'streaming Earth globe must cap compact rendering near 30fps');
assert.match(planetGlobe, /activePointers\.size >= 2/, 'streaming Earth globe must retain two-finger pinch zoom');
assert.match(planetGlobe, /IntersectionObserver/, 'streaming Earth globe must pause offscreen');
assert.match(planetGlobe, /prefers-reduced-motion/, 'streaming Earth globe must respect reduced motion');
assert.match(planetGlobe, /function selectedPoint\(next = \{\}\)/, 'property World mode must resolve its selected point without a provider call');
assert.match(planetGlobe, /targetY = -point\.longitude \* Math\.PI \/ 180/, 'selected property longitude must rotate to the front of the globe');
assert.match(planetGlobe, /cameraDistance = compact \? 9\.75 : 9\.25/, 'selected property World mode must use closer phone and desktop framing');
assert.match(planetGlobe, /if \(simpleMode && focusSelected\(dataRef\.current, true\)\) return/, 'World reset must return to the selected property instead of an arbitrary global view');
assert.match(planetGlobe, /if \(!simpleMode && !reducedMotion/, 'simple property World mode must remain stable instead of drifting away');
assert.match(planetGlobe, /3D PROPERTY WORLD · SOURCE-BACKED MAP/, 'focused property World mode must truthfully describe its map representation');
assert.match(planetGlobe, /listingHeightMeters/, 'property marker may use source-backed mapped height evidence');
assert.match(planetGlobe, /coordinatePointCount/, 'property marker may use source-backed footprint complexity');
assert.match(planetGlobe, /TorusGeometry/, 'selected property must have a clear touch-friendly focus halo');
assert.match(planetGlobe, />FOCUS</, 'property World must expose a one-tap focus control');
assert.match(earthGlobe, /MAX_STREAMED_BUILDINGS = 420/, 'client globe cache must remain bounded');
assert.match(earthGlobe, /MAX_VISITED_REGIONS = 96/, 'visited-region memory must remain bounded');
assert.match(earthGlobe, /\/api\/world-atlas\/stream/, 'globe must stream visible Earth regions through the bounded API');
assert.match(earthGlobe, /onLocation\?\.\(\{ latitude:/, 'streamed markers must deepen through location lookup rather than bypass property truth');

assert.match(openReality, /@media\(max-width:680px\)/, 'open street reality must have explicit compact phone layout');
assert.match(openReality, /min-height:390px/, 'open street reality must remain visible on iPhone');
assert.match(openReality, /overflow-x:auto/, 'open street thumbnails must stay horizontally scrollable on narrow screens');
assert.match(openReality, /NO OPEN STREET PHOTO HERE YET/, 'missing open imagery must keep a visible non-blank fallback');
assert.match(earthPage, />COMPARE</, 'Earth must expose compare mode on mobile');
assert.match(earthPage, />STREET</, 'Earth must expose free street imagery mode on mobile');
assert.match(earthPage, />VOXEL</, 'Earth must expose Voxel mode on mobile');
assert.match(earthPage, />GLOBE</, 'Earth must expose Globe mode on mobile');
assert.match(earthPage, /useState\('compare'\)/, 'Earth should start in a useful open comparison without a paid map key');
assert.match(earthCss, /grid-template-columns:repeat\(4,1fr\)/, 'four view tabs must become equal phone controls');
assert.match(earthCss, /\.compare\{height:auto;min-height:0;grid-template-columns:1fr/, 'Compare mode must stack open street evidence and Voxel vertically on compact screens');
assert.match(earthCss, /safe-area-inset-bottom/, 'Earth page must account for iPhone safe area');

assert.match(meshyViewer, /compact \? 1\.15 : 1\.35/, 'Meshy GLB viewer must keep strict compact pixel ratio');
assert.match(meshyViewer, /time - lastRender < 33/, 'Meshy GLB viewer must cap compact rendering near 30fps');
assert.match(meshyViewer, /pointers\.size >= 2/, 'Meshy GLB viewer must retain two-finger pinch zoom');
assert.match(meshyViewer, /IntersectionObserver/, 'Meshy GLB viewer must pause offscreen');
assert.match(meshyViewer, /prefers-reduced-motion/, 'Meshy GLB viewer must respect reduced motion');
assert.match(meshyPanel, /maxSide = 2048/, 'iPhone reference photos must normalize to bounded Meshy upload size');
assert.match(meshyPanel, /image\/jpeg/, 'iPhone reference normalization must output Meshy-compatible JPEG');
assert.match(meshyPanel, /FREE OPEN KARTAVIEW VIEW/, 'open-licensed street imagery must be loadable into Meshy from a phone');

assert.match(realEstateCss, /mobileTabBar/, 'Real estate homepage must expose mobile quick navigation');
assert.match(realEstateCss, /safe-area-inset-bottom/, 'Real estate homepage must account for iPhone safe area');
assert.match(realEstateCss, /calc\(100% - 22px\)/, 'Real estate mobile shell width must use valid CSS math');

console.log('Mobile WebGL source guard passed: Voxel, GEO, focused source-backed no-credit property World, streaming Globe, free open street Compare, optional Meshy GLB and iPhone reference-photo flows retain touch-safe mobile fallbacks, bounded caches and rendering limits.');
