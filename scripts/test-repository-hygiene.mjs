import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .sort();

assert.ok(tracked.length > 100, `Expected a full repository checkout, found only ${tracked.length} tracked files.`);

const binaryExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.glb', '.gltfbin', '.pdf', '.zip', '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.mp4', '.mov', '.webm', '.wasm',
]);
const secretPatterns = [
  ['private key block', new RegExp('-----BEGIN ' + '(?:RSA |EC |OPENSSH )?PRIVATE KEY-----')],
  ['Stripe live secret', new RegExp('sk_' + 'live_[0-9A-Za-z]{16,}')],
  ['Stripe restricted live secret', new RegExp('rk_' + 'live_[0-9A-Za-z]{16,}')],
  ['Stripe webhook secret', new RegExp('wh' + 'sec_[0-9A-Za-z]{24,}')],
  ['GitHub classic token', new RegExp('gh' + 'p_[A-Za-z0-9]{30,}')],
  ['GitHub fine-grained token', new RegExp('github_' + 'pat_[A-Za-z0-9_]{40,}')],
  ['AWS access key', new RegExp('AK' + 'IA[0-9A-Z]{16}')],
  ['Slack token', new RegExp('xo' + 'x[baprs]-[A-Za-z0-9-]{20,}')],
];

const committedEnvFiles = tracked.filter((file) => {
  const base = path.basename(file);
  if (!base.startsWith('.env')) return false;
  return !base.endsWith('.example') && !base.endsWith('.sample') && !base.endsWith('.template');
});
assert.deepEqual(committedEnvFiles, [], `Real environment files must not be committed: ${committedEnvFiles.join(', ')}`);

let textFiles = 0;
let binaryFiles = 0;
let totalBytes = 0;
const largest = [];

for (const file of tracked) {
  const absolute = path.join(root, file);
  const stat = fs.statSync(absolute);
  totalBytes += stat.size;
  largest.push({ file, size: stat.size });
  if (!stat.isFile()) continue;

  const extension = path.extname(file).toLowerCase();
  if (binaryExtensions.has(extension)) {
    binaryFiles += 1;
    continue;
  }

  const buffer = fs.readFileSync(absolute);
  if (buffer.includes(0)) {
    binaryFiles += 1;
    continue;
  }

  textFiles += 1;
  const text = buffer.toString('utf8');
  assert.doesNotMatch(text, /^(?:<{7}|={7}|>{7})(?:\s|$)/m, `${file} contains an unresolved merge-conflict marker.`);
  for (const [label, pattern] of secretPatterns) {
    assert.doesNotMatch(text, pattern, `${file} appears to contain a committed ${label}.`);
  }
}

const cronPath = 'app/api/cron/catalog-3d/route.js';
const cron = fs.readFileSync(path.join(root, cronPath), 'utf8');
assert.match(cron, /CRON_SECRET/, 'catalog-3d cron must require CRON_SECRET.');
assert.match(cron, /authorization/i, 'catalog-3d cron must authenticate with the Authorization header.');
assert.match(cron, /status:\s*503/, 'catalog-3d cron must fail closed when scheduled-job authentication is not configured.');
assert.doesNotMatch(cron, /user-agent|vercel-cron/i, 'catalog-3d cron must never trust a spoofable User-Agent as authentication.');

const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
for (const name of [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CRON_SECRET',
  'VOXELFLIP_MINT_SIGNER_PRIVATE_KEY',
  'PROPERTY_VOXEL_METADATA_SECRET',
]) {
  assert.match(envExample, new RegExp(`^${name}=`, 'm'), `.env.example must document ${name}.`);
}

const migrationFiles = tracked.filter((file) => file.startsWith('supabase/migrations/') && file.endsWith('.sql'));
const migrationVersions = new Map();
for (const file of migrationFiles) {
  const name = path.basename(file);
  const version = name.split('_')[0];
  const list = migrationVersions.get(version) || [];
  list.push(file);
  migrationVersions.set(version, list);
}
const duplicateMigrationVersions = [...migrationVersions.entries()].filter(([, files]) => files.length > 1);
const reviewedLegacyDuplicateVersions = new Set(['002', '003']);
const unexpectedMigrationDuplicates = duplicateMigrationVersions.filter(([version]) => !reviewedLegacyDuplicateVersions.has(version));
assert.deepEqual(
  unexpectedMigrationDuplicates,
  [],
  `New duplicate Supabase migration versions are not allowed: ${unexpectedMigrationDuplicates.map(([version, files]) => `${version} => ${files.join(', ')}`).join(' | ')}`,
);

const legacyStaticOverlaps = [
  ['index.html', 'app/page.js'],
  ['privacy.html', 'app/privacy/page.js'],
  ['terms.html', 'app/terms/page.js'],
  ['robots.txt', 'app/robots.js'],
  ['sitemap.xml', 'app/sitemap.js'],
].filter(([legacy, next]) => tracked.includes(legacy) && tracked.includes(next));

largest.sort((a, b) => b.size - a.size);
const formatMb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log(`Repository hygiene audited ${tracked.length} tracked files: ${textFiles} text, ${binaryFiles} binary/opaque, ${formatMb(totalBytes)} total.`);
console.log(`Largest tracked files: ${largest.slice(0, 5).map(({ file, size }) => `${file} (${formatMb(size)})`).join(', ')}`);
if (duplicateMigrationVersions.length) {
  console.warn(`Reviewed legacy Supabase migration-version collisions remain: ${duplicateMigrationVersions.map(([version, files]) => `${version} => ${files.map(path.basename).join(', ')}`).join(' | ')}. Do not rename already-applied migrations without reconciling production migration history.`);
}
if (legacyStaticOverlaps.length) {
  console.warn(`Legacy root static files overlap current Next routes: ${legacyStaticOverlaps.map(([legacy, next]) => `${legacy} <-> ${next}`).join(', ')}. They are tracked for legacy compatibility and should not define the Vercel product surface.`);
}
console.log('Repository hygiene checks passed: all tracked files inventoried; text files scanned; secrets/conflict markers guarded; cron auth fail-closed; core env documentation present; migration collisions constrained.');
