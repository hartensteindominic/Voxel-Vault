import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const demo = read('app/demo/page.js');
const layout = read('app/layout.js');
const sitemap = read('app/sitemap.js');
const privacy = read('app/privacy/page.js');
const terms = read('app/terms/page.js');
const about = read('app/about/page.js');
const legacyPrivacy = read('privacy.html');
const legacyTerms = read('terms.html');
const readme = read('README.md');
const og = read('app/opengraph-image.js');

assert.match(home, /SEE 3D SAMPLE · NO LOGIN/, 'home must show product value before Google sign-in');
assert.match(home, /href="\/demo"/, 'home must link to the public product sample');
assert.match(home, /\$4\.99/, 'the focused paid-creation price must remain public');
assert.match(home, /3D preview[\s\S]*voxel/i, 'home must preserve preview-before-voxel positioning');
assert.match(home, /Privacy/, 'home footer must expose Privacy');
assert.match(home, /Terms/, 'home footer must expose Terms');
assert.match(home, /href="\/about">About<\/Link>/, 'home footer must expose a distinct About link');
assert.match(home, /href="\/about#contact">Contact<\/Link>/, 'home footer must expose a distinct Contact link');

assert.match(demo, /PhotoReliefModelViewer/, 'public demo must use the production photo-relief viewer');
assert.match(demo, /LocalVoxelModelViewer/, 'public demo must use the production local voxel viewer');
assert.match(demo, /NO LOGIN · NO PAYMENT · PUBLIC SAMPLE/, 'demo must state that it is public and free to inspect');
assert.match(demo, /Illustrative built-in demo artwork/, 'demo must not pretend the sample is a customer property');
assert.match(demo, /not a customer property/i, 'demo must preserve social-proof truthfulness');
assert.match(demo, /href="\/about#contact">Contact<\/Link>/, 'public demo must expose the support/contact path');
assert.doesNotMatch(demo, /getSupabaseBrowserAsync|signInWithOAuth|checkout\.sessions|\/api\/property-generation\/checkout/, 'public demo must not hide an auth or payment gate');

assert.match(layout, /Turn a House Photo into a 3D Voxel/, 'site metadata must use the focused current promise');
assert.match(layout, /house photo to 3D/, 'SEO keywords must focus on the shipping product');
assert.doesNotMatch(layout, /real estate digital twin|NFT vault/i, 'metadata must not revive broad legacy positioning');
assert.match(og, /house photo into a movable 3D voxel/i, 'social preview must show the current product story');

for (const route of ['/', '/demo', '/property', '/world', '/vault', '/about', '/privacy', '/terms']) {
  assert.ok(sitemap.includes(`path: '${route}'`), `sitemap must expose current public route ${route}`);
}
assert.doesNotMatch(sitemap, /path: '\/studio'/, 'legacy Studio must not outrank the current VoxelPop funnel in search metadata');
assert.match(sitemap, /path: '\/demo'[\s\S]*priority: 0\.95/, 'public no-login demo should be the highest-priority product route after Home');
assert.match(sitemap, /path: '\/property'[\s\S]*priority: 0\.9/, 'paid property creator should remain a high-priority product route');

for (const page of [privacy, terms, about]) {
  assert.match(page, /Voxel Vault|VOXEL VAULT/, 'trust pages must identify Voxel Vault');
  assert.doesNotMatch(page, /ToolMint/, 'trust pages must not expose the unrelated legacy ToolMint brand');
}
assert.doesNotMatch(legacyPrivacy, /ToolMint/, 'root privacy HTML must no longer expose ToolMint');
assert.doesNotMatch(legacyTerms, /ToolMint/, 'root terms HTML must no longer expose ToolMint');
assert.match(privacy, /source photo/i, 'privacy page must explain source-photo handling');
assert.match(terms, /\$4\.99 DIGITAL/, 'terms must state what the creation purchase means');
assert.match(about, /id="contact"/, 'about page must provide a directly linkable contact section');
assert.match(about, /Contact and feedback/, 'about page must provide a real feedback/contact route');

assert.match(readme, /What this repo currently ships/, 'README must lead with the shipping product');
assert.match(readme, /Architecture at a glance/, 'README must document the architecture');
assert.match(readme, /Repo scope/, 'README must separate experimental systems from the public product');
assert.match(readme, /CONTRIBUTING\.md/, 'README must expose contribution guidance');
assert.doesNotMatch(readme.split('## What this repo currently ships')[0], /bank|REIT|Algorand|liquidity engine/i, 'README front door must not lead with experimental finance systems');

console.log('Public VoxelPop positioning checks passed: no-login product proof, focused $4.99 story, current sitemap, explicit trust/contact navigation, richer social preview, and scoped README remain intact.');
