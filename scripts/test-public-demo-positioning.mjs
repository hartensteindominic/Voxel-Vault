import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homeCss = read('app/home.module.css');
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

assert.match(home, /PROPERTY → COLLECTIBLE/, 'home must communicate the focused property collectible product immediately');
assert.match(home, /Create a property voxel/, 'home must keep a clear creation CTA');
assert.match(home, /Open Inventory/, 'home must keep the saved collection reachable from the front door');
assert.match(home, /confirm the address/i, 'home must include the property confirmation step');
assert.match(home, /voxel image/i, 'home must explain the voxel-preview stage');
assert.match(home, /saved to Inventory first/i, 'home must make the automatic saved result clear');
assert.match(home, /Mint if you want|Minting optional/i, 'home must keep minting explicitly optional');
assert.doesNotMatch(home, /Create mine · \$4\.99|Create · \$4\.99/, 'home must not insert legacy per-property checkout copy into the guided studio');
assert.match(home, /heroVisual/, 'home hero must use the new branded voxel-house visual system');
assert.match(homeCss, /#6f42f5/i, 'home must use the new Voxel Vault purple');
assert.match(homeCss, /#c9ff55/i, 'home must use the playful lime accent');
assert.match(homeCss, /@media\(max-width:620px\)/, 'home must include a dedicated phone layout');
assert.match(home, /This collectible is digital only\./, 'home must identify the collectible as digital');
assert.match(home, /does not create or transfer deed, title/i, 'home must preserve the physical-property rights boundary');
assert.match(home, /Privacy/, 'home footer must expose Privacy');
assert.match(home, /Terms/, 'home footer must expose Terms');
assert.match(home, /About/, 'home footer must expose About/contact information');

// Keep the production viewer proof component healthy for demo/secondary surfaces even though
// the redesigned homepage intentionally uses a playful branded illustration instead.
assert.match(homePreview, /LocalVoxelModelViewer/, 'production proof component must keep the real movable-voxel viewer');
assert.doesNotMatch(homePreview, /PhotoReliefModelViewer/, 'production proof component must not force users through a stage switcher');
assert.match(homePreview, />Address</, 'production proof component must disclose address confirmation');
assert.match(homePreview, />Inventory</, 'production proof component must disclose where the finished voxel is saved');
assert.match(homePreview, /MOVABLE 3D VOXEL/, 'production proof component must identify the interactive final result');
assert.doesNotMatch(homePreview, /\$4\.99/, 'production proof component must not show stale checkout pricing');

assert.match(photoViewer, /getImageData\(0, 0, columns, rows\)/, 'voxel-photo stage must sample visible source-image colors');
assert.match(photoViewer, /new THREE\.InstancedMesh/, 'voxel-photo stage must render actual voxel instances');
assert.match(photoViewer, /new THREE\.BoxGeometry\(1, 1, 1\)/, 'voxel-photo stage must use real block geometry');
assert.match(photoViewer, /const columns = compact \? 52 : 64/, 'voxel-photo stage must keep enough source detail for roofs, doors and windows to remain recognizable');
assert.match(photoViewer, /const baseDepth = 0\.10/, 'voxel-photo geometry must stay shallow enough to preserve the photographed likeness');
assert.match(photoViewer, /edge \* 0\.055/, 'voxel depth may respond gently to visible image structure without turning into a thick relief');
assert.doesNotMatch(photoViewer, /backingGeometry|plinthGeometry/, 'the voxel photo must be the geometry itself, not a backed picture or display plaque');
assert.match(photoViewer, /ORIGINAL PHOTO/, 'voxel-photo preview must keep the original source visible for comparison');
assert.match(photoViewer, /HIGH-FIDELITY PHOTO MATCH/, 'viewer must identify the source-faithful output as a likeness review');
assert.match(photoViewer, /targetY = clamp\(targetY \+ dx \* 0\.0034, -0\.28, 0\.28\)/, 'single-photo rotation must stay tightly bounded around the known front view');
assert.match(photoViewer, /ArrowLeft|ArrowRight/, '3D voxel photo must support keyboard inspection as well as drag input');
assert.match(photoViewerStyles, /focus-visible/, '3D viewer must keep a visible keyboard focus treatment');
assert.match(photoViewerStyles, /width:132px/, 'desktop likeness review must keep a large original-photo comparison card');

assert.match(demo, /FREE SAMPLE · NO LOGIN · NO PAYMENT/, 'demo route must remain public and free to inspect even though it is no longer a competing hero CTA');
assert.match(demo, /built-in demo artwork/i, 'demo must identify its built-in artwork');
assert.match(demo, /3D VOXEL PHOTO/, 'demo must present the intermediate voxel-photo state');
assert.match(demo, /MOVABLE 3D VOXEL/, 'demo must present the separate movable voxel state');
assert.match(demo, /not a fake reconstruction of unseen walls/i, 'demo must explain the single-photo reconstruction boundary');
assert.match(demo, /cannot prove hidden sides/i, 'demo must state what a single photo cannot establish');
assert.doesNotMatch(demo, /getSupabaseBrowserAsync|signInWithOAuth|checkout\.sessions|\/api\/property-generation\/checkout/, 'public demo must not hide an auth or payment gate');

assert.match(layout, /Turn Property Photos into 3D Voxel Collectibles/, 'site metadata must use the redesigned current promise');
assert.match(layout, /confirm the address, build a 3D voxel collectible/i, 'metadata must describe the property-photo creation journey');
assert.match(layout, /mint it when you want/i, 'metadata must keep minting optional and downstream');
assert.doesNotMatch(layout, /real estate digital twin|NFT vault/i, 'metadata must not revive broad legacy positioning');
assert.match(og, /house photo into a movable 3D voxel/i, 'social preview may retain the detailed product story');
assert.match(og, /3D VOXEL PHOTO/, 'social preview steps must name the voxel-photo stage');
assert.match(og, /MOVABLE VOXEL/, 'social preview steps must name the movable-voxel stage');

for (const page of [privacy, terms, about]) {
  assert.match(page, /Voxel Vault|VOXEL VAULT/, 'trust pages must identify Voxel Vault');
  assert.doesNotMatch(page, /ToolMint/, 'trust pages must not expose the unrelated legacy ToolMint brand');
}
assert.doesNotMatch(legacyPrivacy, /ToolMint/, 'root privacy HTML must no longer expose ToolMint');
assert.doesNotMatch(legacyTerms, /ToolMint/, 'root terms HTML must no longer expose ToolMint');
assert.match(privacy, /source photo/i, 'privacy page must explain source-photo handling');
assert.match(terms, /\$4\.99 DIGITAL/, 'terms must retain the existing paid-product disclosure until commercial terms are revised separately');
assert.match(about, /Contact and feedback/, 'about page must provide a real feedback/contact route');

assert.match(readme, /What this repo currently ships/, 'README must lead with the shipping product');
assert.match(readme, /Architecture at a glance/, 'README must document the architecture');
assert.match(readme, /Repo scope/, 'README must separate experimental systems from the public product');
assert.match(readme, /CONTRIBUTING\.md/, 'README must expose contribution guidance');
assert.doesNotMatch(readme.split('## What this repo currently ships')[0], /bank|REIT|Algorand|liquidity engine/i, 'README front door must not lead with experimental finance systems');

console.log('Public Voxel Vault positioning checks passed: branded property-collectible home, guided creation, high-fidelity voxel geometry, Inventory persistence, optional minting, and current trust surfaces remain aligned.');
await import('./test-public-surface-coherence.mjs');
