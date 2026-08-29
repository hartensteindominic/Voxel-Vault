import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const heroProof = read('app/HeroProductProof.js');
const topNav = read('app/components/ConsumerTopNav.js');
const demo = read('app/demo/page.js');
const layout = read('app/layout.js');
const privacy = read('app/privacy/page.js');
const terms = read('app/terms/page.js');
const about = read('app/about/page.js');
const legacyPrivacy = read('privacy.html');
const legacyTerms = read('terms.html');
const readme = read('README.md');
const og = read('app/opengraph-image.js');

assert.match(home, /Create my voxel · \$4\.99/, 'home must have one concise paid primary action');
assert.match(home, /See the 3D demo/, 'home must keep the public product proof as the secondary action');
assert.match(home, /HeroProductProof/, 'home hero must render actual product-viewer proof rather than a decorative fake house');
assert.doesNotMatch(home, /voxelHouse|houseBody|priceBubble/, 'home source must not return to the decorative CSS-house hero');
assert.match(home, /href="\/demo"/, 'home must link to the public product sample');
assert.match(home, /\$4\.99/, 'the focused paid-creation price must remain public');
assert.match(home, /3D preview[\s\S]*voxel/i, 'home must preserve preview-before-voxel positioning');
assert.match(home, /What’s included · privacy \+ accuracy/, 'dense caveats must be progressively disclosed instead of sitting under the CTA row');
assert.match(home, /Privacy/, 'home footer must expose Privacy');
assert.match(home, /Terms/, 'home footer must expose Terms');
assert.match(home, /About \+ contact/, 'home footer must expose About/contact');

assert.match(heroProof, /PhotoReliefModelViewer/, 'hero proof must use the real production 3D preview viewer');
assert.match(heroProof, /LocalVoxelModelViewer/, 'hero proof must use the real production local voxel viewer');
assert.match(heroProof, /Drag to inspect/, 'hero proof should explicitly invite 3D interaction');
assert.match(topNav, /Create[\s\S]*World[\s\S]*Vault[\s\S]*More/, 'shared top navigation must mirror the core application map');
assert.match(topNav, /3D Demo/, 'shared top navigation must keep public product proof reachable');

assert.match(demo, /PhotoReliefModelViewer/, 'public demo must use the production photo-relief viewer');
assert.match(demo, /LocalVoxelModelViewer/, 'public demo must use the production local voxel viewer');
assert.match(demo, /ConsumerTopNav/, 'public demo must use the same page chrome as the core app');
assert.match(demo, /NO LOGIN · NO PAYMENT · PUBLIC SAMPLE/, 'demo must state that it is public and free to inspect');
assert.match(demo, /Illustrative built-in demo artwork/, 'demo must not pretend the sample is a customer property');
assert.match(demo, /not a customer property/i, 'demo must preserve social-proof truthfulness');
assert.doesNotMatch(demo, /getSupabaseBrowserAsync|signInWithOAuth|checkout\.sessions|\/api\/property-generation\/checkout/, 'public demo must not hide an auth or payment gate');

assert.match(layout, /Turn a House Photo into a 3D Voxel/, 'site metadata must use the focused current promise');
assert.match(layout, /house photo to 3D/, 'SEO keywords must focus on the shipping product');
assert.doesNotMatch(layout, /real estate digital twin|NFT vault/i, 'metadata must not revive broad legacy positioning');
assert.match(og, /house photo into a movable 3D voxel/i, 'social preview must show the current product story');

for (const page of [privacy, terms, about]) {
  assert.match(page, /Voxel Vault|VOXEL VAULT|ConsumerTopNav/, 'trust pages must identify Voxel Vault and stay inside the consumer chrome');
  assert.match(page, /ConsumerTopNav/, 'trust pages must use the shared navigation system');
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

console.log('Public VoxelPop positioning checks passed: real 3D hero proof, concise CTA hierarchy, shared consumer chrome, focused $4.99 story, trust pages, social preview, and scoped README remain intact.');
await import('./test-public-surface-coherence.mjs');
