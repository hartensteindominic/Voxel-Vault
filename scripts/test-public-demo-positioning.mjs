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
assert.match(home, /PHOTO → 3D → VOXEL → NFT/, 'home must state the centered creation order');
assert.match(home, /3D Preview[\s\S]*3D Voxel[\s\S]*NFT/, 'home must preserve 3D-before-voxel-before-NFT positioning');
assert.match(home, /HomeProductPreview/, 'home hero must show the real product preview instead of decorative art');
assert.match(homePreview, /PhotoReliefModelViewer/, 'home product proof must use the production 3D review viewer');
assert.match(homePreview, /LocalVoxelModelViewer/, 'home product proof must use the production local voxel viewer');
assert.match(homePreview, /House photo/, 'home preview must expose the source-photo state');
assert.match(homePreview, /3D preview/, 'home preview must name the intermediate 3D state');
assert.match(homePreview, /Movable 3D voxel/, 'home preview must name the final movable-model state');
assert.match(homePreview, /Optional NFT/, 'home preview must keep NFT minting downstream and optional');
assert.match(home, /Privacy/, 'home footer must expose Privacy');
assert.match(home, /Terms/, 'home footer must expose Terms');
assert.match(home, /About/, 'home footer must expose About/contact information');

// The middle review surface must be genuine inspectable Three.js voxel geometry,
// while staying source-faithful and bounded so one photo never pretends to prove
// hidden walls or exact dimensions.
assert.match(photoViewer, /getImageData\(0, 0, columns, rows\)/, '3D voxel-photo stage must sample visible source-image colors');
assert.match(photoViewer, /new THREE\.InstancedMesh/, '3D voxel-photo stage must render actual voxel instances');
assert.match(photoViewer, /new THREE\.BoxGeometry\(1, 1, 1\)/, '3D voxel-photo stage must use real cube geometry');
assert.match(photoViewer, /const depth = 0\.42/, '3D voxel-photo blocks must have inspectable physical depth');
assert.match(photoViewer, /edge \* 0\.34/, 'depth must respond to visible image structure');
assert.match(photoViewer, /voxels\.setColorAt\(instance, color\)/, 'voxel colors must remain tied to the selected source photo');
assert.doesNotMatch(photoViewer, /backingGeometry/, 'the voxel photo must not be a flat picture mounted to a rectangular backing');
assert.match(photoViewer, /plinthGeometry/, 'the voxel photo may use a floor reference without becoming a picture card');
assert.match(photoViewer, /ORIGINAL PHOTO/, 'voxel-photo review must keep the original source visible for comparison');
assert.match(photoViewer, /PHOTO-MATCHED BLOCKS/, 'review surface must identify the real source-matched block geometry');
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

console.log('Public VoxelPop positioning checks passed: centered photo -> real 3D voxel-photo geometry -> movable voxel -> optional NFT, with sample-first proof, source-photo comparison, and current trust surfaces.');
await import('./test-public-surface-coherence.mjs');
