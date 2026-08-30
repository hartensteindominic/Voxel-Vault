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
assert.deepEqual(appEntries, ['api', 'bank', 'layout.js', 'page.js', 'privacy', 'terms'].sort(), 'app must contain only Galactic Trust product and legal surfaces');
const libEntries = (await readdir(new URL('../lib', import.meta.url))).sort();
assert.deepEqual(libEntries, ['admin-auth.ts', 'banking', 'supabase-admin.ts', 'supabase-browser.js'].sort(), 'lib must contain only Galactic Trust banking/auth infrastructure');

const terms = await readFile(new URL('../app/terms/page.js', import.meta.url), 'utf8');
const privacy = await readFile(new URL('../app/privacy/page.js', import.meta.url), 'utf8');
assert.match(terms, /Galactic Trust is not a bank/i, 'terms must preserve the nonbank boundary');
assert.match(terms, /pretend-money sandbox/i, 'terms must identify current provider banking as sandbox-only');
assert.match(terms, /not a real KYC, CIP, AML, sanctions, credit, or bank-account approval decision/i, 'terms must not turn sandbox validation into production approval');
assert.match(privacy, /Galactic Trust does not currently use this application to hold real customer deposits or move real customer money/i, 'privacy notice must preserve the no-real-money boundary');
assert.match(privacy, /server-only/i, 'privacy notice must state the provider-secret boundary');
assert.doesNotMatch(`${terms}\n${privacy}`, /Voxel Vault|VoxelPop|marketplace|property token/i, 'Galactic Trust legal pages must not restore legacy product copy');

const vercel = await readFile(new URL('../vercel.json', import.meta.url), 'utf8');
assert.doesNotMatch(vercel, /catalog-3d|neural-core|voxel/i, 'Vercel config must not schedule old product jobs');

console.log('Galactic Trust repository scope passed.');
