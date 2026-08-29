import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const staticIndex = read('index.html');
const staticSitemap = read('sitemap.xml');
const staticRobots = read('robots.txt');
const staticPrivacy = read('privacy.html');
const staticTerms = read('terms.html');
const appSitemap = read('app/sitemap.js');
const appRobots = read('app/robots.js');
const layout = read('app/layout.js');
const home = read('app/page.js');
const checkout = read('app/api/checkout/route.ts');
const secureCheckout = read('app/api/checkout-secure/route.ts');
const productMap = read('lib/product-map.js');

for (const [name, source] of [
  ['static index', staticIndex],
  ['static sitemap', staticSitemap],
  ['static robots', staticRobots],
]) {
  assert.match(source, /https:\/\/www\.voxelvault\.io/, `${name} must point to the canonical Voxel Vault domain.`);
  assert.doesNotMatch(source, /Ad-Revenue|voxel-vault\.vercel\.app|VoxelForge/, `${name} must not preserve an obsolete public identity.`);
}

for (const [name, source, path] of [
  ['static privacy', staticPrivacy, '/privacy'],
  ['static terms', staticTerms, '/terms'],
]) {
  const url = `https://www.voxelvault.io${path}`;
  assert.ok(source.includes(`rel="canonical" href="${url}"`), `${name} must canonicalize to the live policy route.`);
  assert.ok(source.includes(`window.location.replace('${url}')`), `${name} must redirect to the live policy route.`);
  assert.match(source, /name="robots" content="noindex,follow"/, `${name} must not compete with the live policy in search results.`);
  assert.doesNotMatch(source, /Ad-Revenue|voxel-vault\.vercel\.app|VoxelForge/, `${name} must not preserve an obsolete public identity.`);
}

for (const route of ['/', '/demo', '/property', '/world', '/more', '/about', '/privacy', '/terms']) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(appSitemap, new RegExp(`path:\\s*['"]${escaped}['"]`), `Next sitemap must include ${route}.`);
}
assert.doesNotMatch(appSitemap, /path:\s*['"]\/studio['"]/, 'The optional Studio route must not replace the current property product in the public sitemap.');

for (const privatePath of ['/admin/', '/api/', '/vault/', '/account/', '/checkout/', '/property/mint']) {
  assert.match(appRobots, new RegExp(privatePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `robots metadata must keep ${privatePath} out of search crawling.`);
}

assert.doesNotMatch(layout, /alternates:\s*\{\s*canonical:\s*SITE_URL/, 'The root layout must not force the homepage canonical onto every child route.');
assert.match(home, /alternates:\s*\{\s*canonical:\s*['"]\/['"]\s*\}/, 'The homepage must own its own canonical URL.');

for (const [name, source] of [['checkout', checkout], ['secure checkout', secureCheckout]]) {
  assert.match(source, /NEXT_PUBLIC_SITE_URL[\s\S]*NEXT_PUBLIC_APP_URL[\s\S]*https:\/\/www\.voxelvault\.io/, `${name} must use the canonical domain as its safe fallback.`);
  assert.doesNotMatch(source, /https:\/\/voxel-vault\.vercel\.app/, `${name} must not redirect a customer to the obsolete Vercel hostname.`);
}

assert.match(productMap, /Authorized photo → \$4\.99 real 3D voxel photo → approval → separate movable 3D voxel → optional World\/map\/mint\./, 'Canonical product-map copy must preserve voxel-photo-before-movable-voxel ordering.');
assert.match(productMap, /included voxel for eligible purchases/, 'Product-map Digital Twin copy must preserve the purchased-twin voxel entitlement.');

console.log('Public-surface coherence passed: canonical domain, static legal redirects, sitemap/robots, checkout fallbacks, canonical scoping, and voxel-photo-before-movable-voxel positioning are aligned.');
