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

assert.match(home, /See an example/, 'home must show product value before Google sign-in');
assert.match(home, /href="\/demo"/, 'home must link to the public product sample');
assert.match(home, /Create mine · \$4\.99/, 'home must keep the paid creation price visible');
assert.match(home, /REVIEW 3D VOXEL PHOTO[\s\S]*CREATE MOVABLE VOXEL/i, 'home must preserve voxel-photo-review-before-movable-voxel positioning');
assert.match(home, /HomeProductPreview/, 'home hero must show the real interactive product preview instead of a decorative CSS-only house');
assert.match(homePreview, /PhotoReliefModelViewer/, 'home product proof must use the production voxel-photo viewer');
assert.match(homePreview, /LocalVoxelModelViewer/, 'home product proof must use the production movable-voxel viewer');
assert.match(homePreview, /compare the voxelized 3D view with the original photo/i, 'home product proof must explain the source-photo comparison');
assert.match(home, /Privacy/, 'home footer must expose Privacy');
assert.match(home, /Terms/, 'home footer must expose Terms');
assert.match(home, /About/, 'home footer must expose About/contact information');

assert.match(photoViewer, /getImageData/, '3D voxel photo must sample the uploaded image into block colors');
assert.match(photoViewer, /InstancedMesh/, '3D voxel photo must use actual repeated 3D voxel geometry');
assert.match(photoViewer, /new THREE\.BoxGeometry\(1, 1, 1\)/, 'voxel-photo cells must be real cube geometry');
assert.match(photoViewer, /const depth = 0\.11/, 'voxel-photo cells must have visible 3D depth');
assert.match(photoViewer, /ORIGINAL PHOTO/, 'preview must keep the original photo visibly available for likeness checking');
assert.match(photoViewer, /ArrowLeft|ArrowRight/, '3D voxel photo must support keyboard inspection as well as drag input');
assert.match(photoViewerStyles, /focus-visible/, '3D viewer must keep a visible keyboard focus treatment');
assert.match(photoViewerStyles, /width:132px/, 'desktop source-photo comparison must remain prominent');

assert.match(demo, /PhotoReliefModelViewer/, 'public demo must use the production voxel-photo viewer');
assert.match(demo, /LocalVoxelModelViewer/, 'public demo must use the production local voxel viewer');
assert.match(demo, /NO LOGIN · NO PAYMENT · PUBLIC SAMPLE/, 'demo must state that it is public and free to inspect');
assert.match(demo, /Illustrative built-in demo artwork/, 'demo must not pretend the sample is a customer property');
assert.match(demo, /not a customer property/i, 'demo must preserve social-proof truthfulness');
assert.match(demo, /3D VOXEL PHOTO/, 'demo must name the first stage correctly');
assert.match(demo, /samples the visible source image into real 3D blocks/i, 'demo must explain what the voxel-photo stage actually does');
assert.match(demo, /original photo stays visible for comparison/i, 'demo must preserve the likeness-comparison checkpoint');
assert.doesNotMatch(demo, /getSupabaseBrowserAsync|signInWithOAuth|checkout\.sessions|\/api\/property-generation\/checkout/, 'public demo must not hide an auth or payment gate');

assert.match(layout, /Turn a House Photo into a 3D Voxel Photo/, 'site metadata must use the focused current promise');
assert.match(layout, /3D voxel photo/, 'SEO metadata must focus on the shipping product');
assert.doesNotMatch(layout, /real estate digital twin|NFT vault/i, 'metadata must not revive broad legacy positioning');
assert.match(og, /house photo into a movable 3D voxel/i, 'social preview must show the current product story');

for (const page of [privacy, terms, about]) {
  assert.match(page, /Voxel Vault|VOXEL VAULT/, 'trust pages must identify Voxel Vault');
  assert.match(page, /3D voxel photo/i, 'trust pages must use the same 3D voxel photo terminology as the product');
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

console.log('Public VoxelPop positioning checks passed: demo-first proof, real 3D voxel photo, separate movable voxel, focused $4.99 story, corrected trust pages, and scoped README remain intact.');
await import('./test-public-surface-coherence.mjs');
