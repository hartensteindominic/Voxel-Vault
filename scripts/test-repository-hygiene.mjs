import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString('utf8').split('\0').filter(Boolean);
assert.ok(tracked.length > 0, 'repository hygiene guard must see tracked files');

const forbiddenTracked = [
  /(^|\/)\.env($|\.)/,
  /(^|\/)deployed-mainnet-addresses\.json$/,
  /(^|\/)node_modules\//,
  /(^|\/)\.next\//,
  /(^|\/)artifacts\//,
  /(^|\/)cache\//,
];
for (const file of tracked) {
  for (const pattern of forbiddenTracked) {
    assert.doesNotMatch(file, pattern, `generated or secret-bearing file must not be tracked: ${file}`);
  }
}

const binaryExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf',
  '.pdf', '.zip', '.glb', '.gltf', '.mp3', '.mp4', '.mov', '.avi', '.bin', '.wasm',
]);
const textFiles = tracked.filter((file) => !binaryExtensions.has(path.extname(file).toLowerCase()));
let scannedTextFiles = 0;
for (const file of textFiles) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute) || fs.statSync(absolute).size > 2_500_000) continue;
  const text = fs.readFileSync(absolute, 'utf8');
  scannedTextFiles += 1;

  assert.doesNotMatch(text, /sk_live_[A-Za-z0-9]{12,}/, `live Stripe secret-looking value found in ${file}`);
  assert.doesNotMatch(text, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, `private key material found in ${file}`);
  assert.doesNotMatch(text, /hartensteindominic\.github\.io\/Ad-Revenue/i, `obsolete Ad-Revenue GitHub Pages URL found in ${file}`);
}

assert.ok(scannedTextFiles > 0, 'repository hygiene guard must scan text files');

const rootIndex = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
assert.match(rootIndex, /https:\/\/www\.voxelvault\.io\//, 'legacy root entry must point to the canonical Voxel Vault site');
assert.match(robots, /https:\/\/www\.voxelvault\.io\/sitemap\.xml/, 'robots.txt must advertise the canonical sitemap');
assert.match(sitemap, /https:\/\/www\.voxelvault\.io\/property/, 'sitemap must include the primary property creator');
assert.doesNotMatch(sitemap, /Ad-Revenue/i, 'sitemap must not contain the retired Ad-Revenue project');

console.log(`Repository hygiene guard passed: ${tracked.length} tracked paths enumerated and ${scannedTextFiles} text files scanned.`);
