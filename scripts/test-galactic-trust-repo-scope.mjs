import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';

async function absent(path) {
  try { await access(new URL(`../${path}`, import.meta.url)); return false; } catch { return true; }
}

for (const path of ['contracts', 'components', 'config', 'hooks', 'tools', 'workflowforge', 'hardhat.config.js', 'hardhat.config.cjs', 'index.html']) {
  assert.equal(await absent(path), true, `${path} must not remain in the Galactic Trust-focused repository`);
}
for (const path of ['app/marketplace', 'app/property', 'app/real-estate', 'app/forge', 'app/liquidity-engine', 'app/profit-engine', 'app/mint', 'app/ai-licensing']) {
  assert.equal(await absent(path), true, `${path} must not remain as an active app surface`);
}
assert.equal(await absent('lib/real-estate'), true, 'mixed real-estate provider code must not remain in lib');

const appEntries = (await readdir(new URL('../app', import.meta.url))).sort();
assert.deepEqual(appEntries, ['api', 'bank', 'layout.js', 'page.js'].sort(), 'app must contain only Galactic Trust product surfaces');
const libEntries = (await readdir(new URL('../lib', import.meta.url))).sort();
assert.deepEqual(libEntries, ['admin-auth.ts', 'banking', 'supabase-admin.ts', 'supabase-browser.js'].sort(), 'lib must contain only Galactic Trust banking/auth infrastructure');

const vercel = await readFile(new URL('../vercel.json', import.meta.url), 'utf8');
assert.doesNotMatch(vercel, /catalog-3d|neural-core|voxel/i, 'Vercel config must not schedule old product jobs');

console.log('Galactic Trust repository scope passed.');
