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

assert.match(home, /Try the free demo/, 'home must show product value before sign-in');
assert.match(home, /href="\/demo"/, 'home must link to the public product sample');
assert.match(home, /Create my VoxelPop · \$4\.99/, 'home must keep the paid creation price visible');
assert.match(home, /3D VOXEL PHOTO[\s\S]*MOVABLE VOXEL/i, 'home must preserve voxel-photo-before-movable-voxel positioning');
assert.match(home, /HomeProductPreview/, 'home hero must show the production visual stages instead of decorative-only art');
assert.match(homePreview, /PhotoReliefModelViewer/, 'home product proof must use the production 3D voxel-photo viewer');
assert.match(homePreview, /LocalVoxelModelViewer/, 'home product proof must use the production movable-voxel viewer');
assert.match(homePreview, /label: '3D voxel photo'/, 'home product proof must identify the first 3D output as a voxel photo');
assert.match(homePreview, /label: 'Movable 3D voxel'/, 'home product proof must distinguish the later movable model');
assert.match(home, /Privacy/, 'home footer must expose Privacy');
assert.match(home, /Terms/, 'home footer must expose Terms');
assert.match(home, /About/, 'home footer must expose About/contact information');

assert.match(photoViewer, /getImageData\(0, 0, columns, rows\)/, 'voxel-photo colors and depth must originate from the chosen source image');
assert.match(photoViewer, /new THREE\.InstancedMesh/, '3D voxel photo must use real instanced voxel geometry');
assert.match(photoViewer, /new THREE\.BoxGeometry\(1, 1, 1\)/, 'voxel-photo cells must be physical cube geometry');
assert.match(photoViewer, /const depth = 0\.42/, 'voxel photo must have meaningful per-block depth');
assert.match(photoViewer, /voxels\.setColorAt\(instance, color\)/, 'voxel colors must remain tied to the source image');
assert.doesNotMatch(photoViewer, /backingGeometry/, '3D voxel photo must not be mounted on a rectangular picture backing');
assert.match(photoViewer, /plinthGeometry/, 'a floor reference may support the voxel object without turning it into a picture slab');
assert.match(photoViewer, /YOUR SOURCE PHOTO/, 'viewer must keep the original source visibly available for likeness checking');
assert.match(photoViewer, /ArrowLeft|ArrowRight/, '3D voxel photo must support keyboard inspection as well as drag input');
assert.match(photoViewerStyles, /focus-visible/, '3D viewer must keep a visible keyboard focus treatment');

assert.match(demo, /PhotoReliefModelViewer/, 'public demo must use the production voxel-photo viewer');
assert.match(demo, /LocalVoxelModelViewer/, 'public demo must use the production movable-voxel viewer');
assert.match(demo, /FREE SAMPLE · NO LOGIN · NO PAYMENT/, 'demo must state that it is public and free to inspect');
assert.match(demo, /block-by-block 3D voxel photo/i, 'demo must explain the first real voxel-photo result');
assert.match(demo, /not a fake reconstruction of unseen walls/i, 'demo must preserve the one-photo truth boundary');
assert.match(demo, /not a customer property/i, 'demo must preserve social-proof truthfulness');
assert.doesNotMatch(demo, /getSupabaseBrowserAsync|signInWithOAuth|checkout\.sessions|\/api\/property-generation\/checkout/, 'public demo must not hide an auth or payment gate');

assert.match(layout, /Turn a House Photo into a 3D Voxel Photo/, 'site metadata must use the focused current promise');
assert.match(layout, /house photo to voxel/, 'SEO keywords must focus on the shipping product');
assert.doesNotMatch(layout, /real estate digital twin|NFT vault/i, 'metadata must not revive broad legacy positioning');
assert.match(og, /Your house\. Built from voxels\./i, 'social preview must lead with the current VoxelPop product story');
assert.match(og, /3D VOXEL PHOTO/, 'social preview must name the first 3D output correctly');
assert.match(og, /MOVABLE VOXEL/, 'social preview must distinguish the later movable model');
assert.doesNotMatch(og, /3D PREVIEW/, 'social preview must not revive the ambiguous old preview wording');

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

console.log('Public VoxelPop positioning checks passed: free demo, real 3D voxel-photo object without a picture backing, separate movable voxel, focused $4.99 story, corrected trust pages, current social preview, and scoped README remain intact.');
await import('./test-public-surface-coherence.mjs');
