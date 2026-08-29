import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homePreview = read('app/components/HomeProductPreview.js');
const photoViewer = read('app/property/PhotoReliefModelViewer.js');
const photoViewerStyles = read('app/property/PhotoReliefModelViewer.module.css');
const demo = read('app/demo/page.js');
const layout = read('app/layout.js');
const privacy = read('app/privacy/page.js');
const terms = read('app/terms/page.js');
const about = read('app/about/page.js');
const legacyPrivacy = read('privacy.html');
const legacyTerms = read('terms.html');
const readme = read('README.md');
const og = read('app/opengraph-image.js');

assert.match(home, /HOUSE PHOTO → VOXEL → 3D · \$4\.99/, 'home must communicate the product immediately');
assert.match(home, /Create house voxel · \$4\.99/, 'home must keep one clear paid creation CTA and price');
assert.match(home, /Upload a house\. Confirm the address\. Get a voxel image, then a mintable 3D voxel\./, 'home must state the requested sequence plainly');
assert.match(home, /Saved to your Voxel Vault · mint when you want/, 'home must make the automatic final result and optional mint clear');
assert.match(home, /HomeProductPreview/, 'home hero must show an interactive product result instead of decorative art');
assert.doesNotMatch(home, /secondaryAction|Try voxel sample · no login/, 'home must not add a competing hero action');
assert.match(homePreview, /LocalVoxelModelViewer/, 'home product proof must use an interactive voxel viewer');
assert.doesNotMatch(homePreview, /PhotoReliefModelViewer/, 'home proof must not force users through a stage switcher before creating');
assert.match(homePreview, /MOVABLE 3D VOXEL/, 'home proof must identify the interactive final result');
assert.match(home, /Privacy/, 'home footer must expose Privacy');
assert.match(home, /Terms/, 'home footer must expose Terms');

// The public sample can keep the deterministic local voxel comparison as an
// explanation of the visual concept. The paid creator now uses the provider
// voxel-image -> final-GLB path and is tested separately.
assert.match(photoViewer, /getImageData\(0, 0, columns, rows\)/, 'sample voxel-photo stage must sample visible source-image colors');
assert.match(photoViewer, /new THREE\.InstancedMesh/, 'sample voxel-photo stage must render actual voxel instances');
assert.match(photoViewer, /new THREE\.BoxGeometry\(1, 1, 1\)/, 'sample voxel-photo stage must use real block geometry');
assert.match(photoViewer, /const columns = compact \? 52 : 64/, 'sample review must retain recognizable detail');
assert.match(photoViewer, /const baseDepth = 0\.10/, 'sample geometry must stay shallow enough to preserve photographed likeness');
assert.match(photoViewer, /edge \* 0\.055/, 'sample depth may respond gently to visible image structure');
assert.doesNotMatch(photoViewer, /backingGeometry|plinthGeometry/, 'sample voxel photo must be geometry rather than a display plaque');
assert.match(photoViewer, /ORIGINAL PHOTO/, 'sample comparison must keep the original source visible');
assert.match(photoViewer, /HIGH-FIDELITY PHOTO MATCH/, 'sample viewer must identify the source-faithful output');
assert.match(photoViewer, /targetY = clamp\(targetY \+ dx \* 0\.0034, -0\.28, 0\.28\)/, 'single-photo sample rotation must stay bounded around the known view');
assert.match(photoViewer, /ArrowLeft|ArrowRight/, 'sample 3D voxel photo must support keyboard inspection');
assert.match(photoViewerStyles, /focus-visible/, 'sample 3D viewer must keep visible keyboard focus');
assert.match(photoViewerStyles, /width:132px/, 'desktop sample must keep a useful original-photo comparison card');

assert.match(demo, /FREE SAMPLE · NO LOGIN · NO PAYMENT/, 'demo route must remain public and free to inspect');
assert.match(demo, /built-in demo artwork/i, 'demo must identify its built-in artwork');
assert.match(demo, /3D VOXEL PHOTO/, 'demo may present the explanatory voxel-photo state');
assert.match(demo, /MOVABLE 3D VOXEL/, 'demo must present the separate movable voxel state');
assert.match(demo, /not a fake reconstruction of unseen walls/i, 'demo must explain the single-photo reconstruction boundary');
assert.match(demo, /cannot prove hidden sides/i, 'demo must state what a single photo cannot establish');
assert.doesNotMatch(demo, /getSupabaseBrowserAsync|signInWithOAuth|checkout\.sessions|\/api\/property-generation\/checkout/, 'public demo must not hide an auth or payment gate');

assert.match(layout, /Turn a House Photo into a 3D Voxel/, 'site metadata must use the focused current promise');
assert.doesNotMatch(layout, /real estate digital twin|NFT vault/i, 'metadata must not revive broad legacy positioning');
assert.match(og, /house photo into a movable 3D voxel/i, 'social preview must show the current product story');
assert.match(og, /MOVABLE VOXEL/, 'social preview steps must name the movable-voxel result');

for (const page of [privacy, terms, about]) {
  assert.match(page, /Voxel Vault|VOXEL VAULT/, 'trust pages must identify Voxel Vault');
  assert.doesNotMatch(page, /ToolMint/, 'trust pages must not expose the unrelated legacy ToolMint brand');
}
assert.doesNotMatch(legacyPrivacy, /ToolMint/, 'root privacy HTML must no longer expose ToolMint');
assert.doesNotMatch(legacyTerms, /ToolMint/, 'root terms HTML must no longer expose ToolMint');
assert.match(privacy, /source photo/i, 'privacy page must explain source-photo handling');
assert.match(terms, /\$4\.99 DIGITAL/, 'terms must state what the creation purchase means');
assert.match(about, /Contact and feedback/, 'about page must provide a real feedback/contact route');

assert.match(readme, /What this repo currently ships/, 'README must lead with the shipping product');
assert.match(readme, /Architecture at a glance/, 'README must document the architecture');
assert.match(readme, /Repo scope/, 'README must separate experimental systems from the public product');
assert.match(readme, /CONTRIBUTING\.md/, 'README must expose contribution guidance');
assert.doesNotMatch(readme.split('## What this repo currently ships')[0], /bank|REIT|Algorand|liquidity engine/i, 'README front door must not lead with experimental finance systems');

console.log('Public VoxelPop positioning checks passed: one-action homepage, explicit house-photo -> address -> voxel -> 3D story, interactive proof, free public sample, corrected trust pages, and current social preview remain aligned.');
await import('./test-public-surface-coherence.mjs');
