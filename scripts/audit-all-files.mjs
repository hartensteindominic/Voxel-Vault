import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { TextDecoder } from 'node:util';

const root = process.cwd();
const decoder = new TextDecoder('utf-8', { fatal: true });
const errors = [];
const warnings = [];
const counts = { files: 0, bytes: 0, text: 0, binary: 0, json: 0, markdown: 0, source: 0 };
const byTopLevel = new Map();
const manifest = crypto.createHash('sha256');

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .sort();

const binaryExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz', '.woff', '.woff2', '.ttf', '.otf',
  '.glb', '.gltf.bin', '.mp3', '.mp4', '.mov', '.webm', '.wasm', '.mapbox', '.pmtiles',
]);
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
const resolvableExtensions = ['', '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.css', '.scss', '.svg'];
const expectedEmpty = new Set(['.nojekyll']);

function record(level, file, message) {
  (level === 'error' ? errors : warnings).push(`${file}: ${message}`);
}

function topLevel(file) {
  return file.includes('/') ? file.split('/')[0] : '(root)';
}

function isProbablyBinary(file, buffer) {
  const lower = file.toLowerCase();
  if ([...binaryExtensions].some((ext) => lower.endsWith(ext))) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  for (const byte of sample) if (byte === 0) return true;
  return false;
}

function cleanSpecifier(specifier) {
  return specifier.split('?')[0].split('#')[0];
}

function relativeTargetExists(fromFile, specifier) {
  const cleaned = cleanSpecifier(specifier);
  const base = path.resolve(root, path.dirname(fromFile), cleaned);
  for (const ext of resolvableExtensions) {
    if (fs.existsSync(`${base}${ext}`) && fs.statSync(`${base}${ext}`).isFile()) return true;
  }
  for (const ext of resolvableExtensions) {
    const candidate = path.join(base, `index${ext}`);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return true;
  }
  return false;
}

function auditRelativeImports(file, text) {
  const patterns = [
    /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g,
    /\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
  ];
  const seen = new Set();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const specifier = match[1];
      if (!specifier || seen.has(specifier)) continue;
      seen.add(specifier);
      if (!relativeTargetExists(file, specifier)) record('error', file, `relative import does not resolve: ${specifier}`);
    }
  }
}

function auditMarkdownLinks(file, text) {
  counts.markdown += 1;
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of text.matchAll(linkPattern)) {
    let target = String(match[1] || '').trim();
    if (!target || target.startsWith('#') || /^(?:https?:|mailto:|tel:|data:)/i.test(target)) continue;
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
    target = target.split(/\s+["']/)[0].split('#')[0].split('?')[0];
    try { target = decodeURIComponent(target); } catch {}
    if (!target) continue;
    const resolved = path.resolve(root, path.dirname(file), target);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      record('error', file, `local Markdown link escapes repository: ${target}`);
      continue;
    }
    if (!fs.existsSync(resolved)) record('error', file, `local Markdown link is missing: ${target}`);
  }
}

function auditHighConfidenceSecrets(file, text) {
  if (file === '.env.example' || file.startsWith('docs/') || file.startsWith('scripts/') || file.startsWith('test/') || file.startsWith('tests/')) return;
  const patterns = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'embedded private key'],
    [/\bsk_live_[A-Za-z0-9]{20,}\b/, 'live Stripe secret key'],
    [/\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{30,}\b/, 'GitHub access token'],
    [/\bxox(?:b|p|a|r|s)-[A-Za-z0-9-]{20,}\b/, 'Slack access token'],
    [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key ID'],
  ];
  for (const [pattern, label] of patterns) if (pattern.test(text)) record('error', file, label);
}

for (const file of tracked) {
  const full = path.join(root, file);
  let stat;
  try { stat = fs.lstatSync(full); } catch (error) {
    record('error', file, `cannot stat tracked path: ${error.message}`);
    continue;
  }
  if (!stat.isFile() && !stat.isSymbolicLink()) {
    record('warning', file, 'tracked path is not a regular file or symlink');
    continue;
  }

  let buffer;
  try { buffer = fs.readFileSync(full); } catch (error) {
    record('error', file, `cannot read tracked file: ${error.message}`);
    continue;
  }

  counts.files += 1;
  counts.bytes += buffer.length;
  byTopLevel.set(topLevel(file), (byTopLevel.get(topLevel(file)) || 0) + 1);
  manifest.update(file); manifest.update('\0'); manifest.update(buffer); manifest.update('\0');

  if (buffer.length === 0 && !expectedEmpty.has(file)) record('warning', file, 'empty tracked file');
  if (isProbablyBinary(file, buffer)) {
    counts.binary += 1;
    continue;
  }

  let text;
  try { text = decoder.decode(buffer); } catch {
    counts.binary += 1;
    record('warning', file, 'non-binary extension contains non-UTF-8 bytes');
    continue;
  }
  counts.text += 1;

  if (/^<<<<<<< /m.test(text) || /^>>>>>>> /m.test(text)) record('error', file, 'unresolved merge-conflict marker');
  auditHighConfidenceSecrets(file, text);

  const ext = path.extname(file).toLowerCase();
  if (ext === '.json') {
    counts.json += 1;
    try { JSON.parse(text); } catch (error) { record('error', file, `invalid JSON: ${error.message}`); }
  }
  if (ext === '.md' || ext === '.mdx') auditMarkdownLinks(file, text);
  if (sourceExtensions.has(ext)) {
    counts.source += 1;
    auditRelativeImports(file, text);
  }

  if (buffer.length > 180_000 && !['package-lock.json'].includes(file)) {
    record('warning', file, `large tracked text file (${Math.round(buffer.length / 1024)} KiB); consider splitting for maintainability`);
  }
  if (/\b(?:TODO|FIXME|HACK)\b/i.test(text) && !file.startsWith('docs/')) {
    record('warning', file, 'contains TODO/FIXME/HACK marker');
  }
}

console.log(`Repository file audit read ${counts.files} tracked files (${counts.text} text, ${counts.binary} binary), ${counts.bytes.toLocaleString()} bytes total.`);
console.log(`Validated ${counts.json} JSON files, ${counts.markdown} Markdown files, and relative imports in ${counts.source} source files.`);
console.log(`Whole-repository content digest: ${manifest.digest('hex')}`);
console.log('Tracked files by top-level area:');
for (const [area, count] of [...byTopLevel.entries()].sort((a, b) => a[0].localeCompare(b[0]))) console.log(`  ${area}: ${count}`);

if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const warning of warnings) console.log(`  WARN ${warning}`);
}
if (errors.length) {
  console.error(`\nErrors (${errors.length}):`);
  for (const error of errors) console.error(`  ERROR ${error}`);
  process.exitCode = 1;
} else {
  console.log('\nFull tracked-file audit passed with no blocking file-integrity errors.');
}
