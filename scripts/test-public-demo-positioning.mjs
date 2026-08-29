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

assert.match(home, /Try 3D sample · no login/, 'home must show product value before Google sign-in');
assert.match(home, /href="\/demo"/, 'home must link to the public product sample');
assert.match(home, /Start VoxelPop · \$4\.99/, 'home must keep the paid creation price visible');
assert.match(home, /3D preview[\s\S]*movable 3D voxel/i, 'home must preserve 3D-review-before-model positioning');
assert.match(home, /HomeProductPreview/, 'home hero must show the real interactive product preview instead of decorative art');
assert.match(homePreview, /PhotoReliefModelViewer/, 'home product proof must use the production voxel-photo viewer');
assert.match(homePreview, /LocalVoxelModelViewer/, 'home product proof must use the production local voxel viewer');
assert.match(homePreview, /House photo/, 'home preview must expose the source-photo state');
assert.match(homePreview, /3D preview/, 'home preview must name the intermediate 3D review state');
assert.match(homePreview, /Movable 3D voxel/, 'home preview must name the final movable-model state');
assert.match(home, /Privacy/, 'home footer must expose Privacy');
assert.match(home, /Terms/, 'home footer must expose Terms');
assert.match(home, /About/, 'home footer must expose About/contact information');

assert.match(photoViewer, /getImageData\(0, 0, columns, rows\)/, 'voxel-photo stage must sample visible source-image colors');
assert.match(photoViewer, /new THREE\.InstancedMesh/, 'voxel-photo stage must render actual voxel instances');
assert.match(photoViewer, /new THREE\.BoxGeometry\(1, 1, 1\)/, 'voxel-photo stage must use real block geometry');
assert.match(photoViewer, /const depth = 0\.42/, 'voxel-photo blocks must have meaningful inspectable depth');
assert.match(photoViewer, /edge \* 0\.34/, 'voxel depth should respond to visible image structure instead of staying paper-thin');
assert.doesNotMatch(photoViewer, /backingGeometry/, 'the voxel photo must not be mounted to a rectangular picture backing');
assert.match(photoViewer, /plinthGeometry/, 'the voxel object may stand on a small floor reference without becoming a backed picture');
assert.match(photoViewer, /ORIGINAL PHOTO/, 'voxel-photo preview must keep the original source visible for comparison');
assert.match(photoViewer, /PHOTO-MATCHED BLOCKS/, 'viewer must identify the source-faithful output as real blocks, not a styled image');
assert.match(photoViewer, /ArrowLeft|ArrowRight/, '3D voxel photo must support keyboard inspection as well as drag input');
assert.match(photoViewerStyles, /focus-visible/, '3D viewer must keep a visible keyboard focus treatment');

assert.match(demo, /FREE SAMPLE · NO LOGIN · NO PAYMENT/, 'demo must state that it is public and free to inspect');
assert.match(demo, /built-in demo artwork/i, 'demo must identify its built-in artwork');
assert.match(demo, /3D VOXEL PHOTO/, 'demo must present the intermediate voxel-photo state');
assert.match(demo, /MOVABLE 3D VOXEL/, 'demo must present the separate movable voxel state');
assert.match(demo, /not a fake reconstruction of unseen walls/i, 'demo must explain the single-photo reconstruction boundary');
assert.match(demo, /cannot prove hidden sides/i, 'demo must state what a single photo cannot establish');
assert.doesNotMatch(demo, /getSupabaseBrowserAsync|signInWithOAuth|checkout\.sessions|\/api\/property-generation\/checkout/, 'public demo must not hide an auth or payment gate');

assert.match(layout, /Turn a House Photo into a 3D Voxel/, 'site metadata must use the focused current promise');
assert.match(layout, /3D voxel photo/, 'metadata must describe the shipping voxel-photo product');
assert.doesNotMatch(layout, /real estate digital twin|NFT vault/i, 'metadata must not revive broad legacy positioning');
assert.match(og, /house photo into a movable 3D voxel/i, 'social preview must show the current product story');
assert.match(og, /3D VOXEL PHOTO/, 'social preview steps must name the voxel-photo stage');
assert.match(og, /MOVABLE VOXEL/, 'social preview steps must name the movable-voxel stage');

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

console.log('Public VoxelPop positioning checks passed: sample-first product proof, real photo-matched 3D voxel geometry without a picture backing, movable voxel separation, focused $4.99 story, corrected trust pages, and current social preview remain aligned.');
await import('./test-public-surface-coherence.mjs');
