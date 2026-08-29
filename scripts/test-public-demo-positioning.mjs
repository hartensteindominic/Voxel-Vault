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

assert.match(home, /Try the sample · no login/, 'home must show product value before Google sign-in');
assert.match(home, /href="\/demo"/, 'home must link to the public product sample');
assert.match(home, /Create my voxel · \$4\.99/, 'home must keep the paid creation price visible');
assert.match(home, /3D voxel photo[\s\S]*movable 3D voxel/i, 'home must preserve voxel-photo-before-model positioning');
assert.match(home, /HomeProductPreview/, 'home hero must show the real interactive product preview instead of a decorative CSS-only house');
assert.match(homePreview, /PhotoReliefModelViewer/, 'home product proof must use the production voxel-photo viewer');
assert.match(homePreview, /LocalVoxelModelViewer/, 'home product proof must use the production local voxel viewer');
assert.match(homePreview, /Your house photo/, 'home preview must expose the source-photo state');
assert.match(homePreview, /3D voxel photo/, 'home preview must name the intermediate voxel-photo state');
assert.match(homePreview, /Movable 3D voxel/, 'home preview must name the final movable-model state');
assert.match(home, /Privacy/, 'home footer must expose Privacy');
assert.match(home, /Terms/, 'home footer must expose Terms');
assert.match(home, /About/, 'home footer must expose About/contact information');

assert.match(photoViewer, /getImageData/, 'voxel-photo stage must sample the visible source image into voxel colors');
assert.match(photoViewer, /InstancedMesh/, 'voxel-photo stage must render actual voxel instances');
assert.match(photoViewer, /BoxGeometry\(1, 1, 1\)/, 'voxel-photo stage must use real block geometry');
assert.match(photoViewer, /const depth = 0\.11/, 'voxel-photo blocks must have shallow 3D depth for inspection');
assert.match(photoViewer, /ORIGINAL PHOTO/, 'preview must keep the original source visibly available for comparison');
assert.match(photoViewer, /ArrowLeft|ArrowRight/, '3D voxel photo must support keyboard inspection as well as drag input');
assert.match(photoViewerStyles, /focus-visible/, '3D viewer must keep a visible keyboard focus treatment');

assert.match(demo, /NO LOGIN · NO PAYMENT · PUBLIC SAMPLE/, 'demo must state that it is public and free to inspect');
assert.match(demo, /Illustrative built-in demo artwork/, 'demo must not pretend the sample is a customer property');
assert.match(demo, /not a customer property/i, 'demo must preserve social-proof truthfulness');
assert.match(demo, /3D voxel photo/, 'demo must present the same intermediate voxel-photo state as Create');
assert.match(demo, /movable voxel/i, 'demo must present the separate movable voxel state');
assert.match(demo, /one photo cannot reveal hidden sides/i, 'demo must explain the single-photo reconstruction limit');
assert.doesNotMatch(demo, /getSupabaseBrowserAsync|signInWithOAuth|checkout\.sessions|\/api\/property-generation\/checkout/, 'public demo must not hide an auth or payment gate');

assert.match(layout, /Turn a House Photo into a 3D Voxel/, 'site metadata must use the focused current promise');
assert.match(layout, /house photo to 3D/, 'SEO keywords must focus on the shipping product');
assert.doesNotMatch(layout, /real estate digital twin|NFT vault/i, 'metadata must not revive broad legacy positioning');
assert.match(og, /house photo into a movable 3D voxel/i, 'social preview must show the current product story');

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

console.log('Public VoxelPop positioning checks passed: public sample, voxel-photo-first product proof, local movable voxel viewer, focused $4.99 story, trust pages, social preview, and scoped README remain aligned.');
await import('./test-public-surface-coherence.mjs');
