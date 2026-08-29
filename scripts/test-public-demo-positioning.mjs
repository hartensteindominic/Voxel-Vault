import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homeProof = read('app/components/Home3DProof.js');
const header = read('app/components/ConsumerHeader.js');
const footer = read('app/components/ConsumerFooter.js');
const demo = read('app/demo/page.js');
const layout = read('app/layout.js');
const privacy = read('app/privacy/page.js');
const terms = read('app/terms/page.js');
const about = read('app/about/page.js');
const legacyPrivacy = read('privacy.html');
const legacyTerms = read('terms.html');
const readme = read('README.md');
const og = read('app/opengraph-image.js');

assert.match(home, /Home3DProof/, 'home must lead with real production 3D product proof rather than decorative artwork');
assert.match(home, /Create my house · \$4\.99/, 'home must have one concise primary paid-creation CTA');
assert.match(home, /Try 3D demo · no login/, 'home must show product value before Google sign-in');
assert.match(home, /href="\/demo"/, 'home must link to the public product sample');
assert.match(home, /\$4\.99/, 'the focused paid-creation price must remain public');
assert.match(home, /3D PREVIEW[\s\S]*APPROVE[\s\S]*VOXEL/i, 'home must preserve preview-before-voxel positioning');
assert.match(home, /What’s included \/ what isn’t/, 'dense purchase and legal detail must use progressive disclosure');
assert.doesNotMatch(home, /voxelHouse/, 'home must not regress to the decorative CSS-house hero');
assert.match(homeProof, /PhotoReliefModelViewer/, 'home proof must use the production 3D preview viewer');
assert.match(homeProof, /LocalVoxelModelViewer/, 'home proof must use the production local voxel viewer');
assert.match(header, /Home[\s\S]*Create[\s\S]*World[\s\S]*Vault[\s\S]*More/, 'desktop consumer navigation must mirror the core product map');
assert.match(footer, /Privacy/, 'shared footer must expose Privacy');
assert.match(footer, /Terms/, 'shared footer must expose Terms');
assert.match(footer, /About/, 'shared footer must expose About/contact');

assert.match(demo, /PhotoReliefModelViewer/, 'public demo must use the production photo-relief viewer');
assert.match(demo, /LocalVoxelModelViewer/, 'public demo must use the production local voxel viewer');
assert.match(demo, /NO LOGIN · NO PAYMENT · PUBLIC SAMPLE/, 'demo must state that it is public and free to inspect');
assert.match(demo, /Illustrative built-in demo artwork/, 'demo must not pretend the sample is a customer property');
assert.match(demo, /not a customer property/i, 'demo must preserve social-proof truthfulness');
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

console.log('Public VoxelPop positioning checks passed: real no-login 3D proof, focused $4.99 story, one consumer product map, corrected trust pages, richer social preview, and scoped README remain intact.');
await import('./test-public-surface-coherence.mjs');
