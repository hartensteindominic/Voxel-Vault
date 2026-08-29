import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const warnings = [];

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .sort();

const uiFile = (file) => {
  if (['index.html', 'privacy.html', 'terms.html'].includes(file)) return true;
  if (file === 'lib/product-map.js') return true;
  if (!/\.(?:js|jsx|ts|tsx|css|scss|html)$/.test(file)) return false;
  return file.startsWith('app/') || file.startsWith('components/') || file.startsWith('styles/');
};

const uiFiles = tracked.filter(uiFile);
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const must = (condition, message) => { if (!condition) failures.push(message); };

const required = [
  'app/components/ConsumerHeader.js',
  'app/components/ConsumerFooter.js',
  'app/components/Home3DProof.js',
  'app/consumer-system.css',
  'app/page.js',
  'app/demo/page.js',
  'app/property/PropertyJourneyExact.js',
  'app/world/page.js',
  'app/vault/page.js',
  'app/more/page.js',
];
for (const file of required) must(fs.existsSync(path.join(root, file)), `${file}: required consumer UI file is missing`);

const source = Object.fromEntries(required.filter((file) => fs.existsSync(path.join(root, file))).map((file) => [file, read(file)]));
const home = source['app/page.js'] || '';
const property = source['app/property/PropertyJourneyExact.js'] || '';
const header = source['app/components/ConsumerHeader.js'] || '';
const footer = source['app/components/ConsumerFooter.js'] || '';
const system = source['app/consumer-system.css'] || '';
const dock = fs.existsSync(path.join(root, 'app/components/FinancialOSNav.js')) ? read('app/components/FinancialOSNav.js') : '';

must(/Home3DProof/.test(home), 'Homepage must show the production 3D product proof in the hero.');
must(!/voxelHouse/.test(home), 'Homepage must not fall back to the decorative CSS house hero.');
must(/Create my house/.test(home), 'Homepage must expose one concise primary creation CTA.');
must(/Try 3D demo/.test(home), 'Homepage must expose the no-login demo as the secondary proof action.');
must(/What’s included|What's included/.test(home), 'Homepage must move dense purchase/legal detail into progressive disclosure.');

must(/Home[\s\S]*Create[\s\S]*World[\s\S]*Vault[\s\S]*More/.test(header), 'Shared consumer header must mirror the core product map.');
must(/Try 3D demo/.test(header), 'Shared consumer header must keep the product-proof demo discoverable.');
must(/vvConsumerFooter/.test(footer), 'Shared footer must use the consumer design system rather than tiny inline styles.');
must(/focus-visible/.test(system), 'Consumer design system must define visible keyboard focus.');
must(/prefers-reduced-motion/.test(system), 'Consumer design system must respect reduced-motion preferences.');
must(/--vv-purple/.test(system) && /--vv-lime/.test(system), 'Consumer design system must define explicit brand color tokens.');
must(!/background:\s*['"]#c9ff54['"]/.test(dock), 'Bottom navigation must not use lime as the primary active-navigation fill.');

must(/href="\/demo"/.test(property), 'Signed-out Create must offer visible product proof before Google sign-in.');
must(!/Mint is next/i.test(property), 'Finished creation must not imply minting is the mandatory next step.');
must(/Choose what’s next|Choose what's next/.test(property), 'Finished creation must present optional next actions neutrally.');

const noLocalNav = [
  'app/page.js', 'app/demo/page.js', 'app/world/page.js', 'app/vault/page.js', 'app/more/page.js',
  'app/privacy/page.js', 'app/terms/page.js', 'app/about/page.js',
];
for (const file of noLocalNav) {
  if (!fs.existsSync(path.join(root, file))) continue;
  const text = read(file);
  if (/<nav\s+className=(?:\{styles\.top\}|"top")/.test(text)) failures.push(`${file}: core consumer page still owns a competing local top navigation`);
}

const tinyByFile = [];
let tinyDeclarations = 0;
for (const file of uiFiles) {
  let text;
  try { text = read(file); } catch { continue; }
  const hits = [];
  for (const match of text.matchAll(/font-size\s*:\s*([0-9.]+)px/gi)) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value < 10) hits.push(value);
  }
  for (const match of text.matchAll(/fontSize\s*:\s*['"]([0-9.]+)px['"]/g)) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value < 10) hits.push(value);
  }
  if (hits.length) {
    tinyDeclarations += hits.length;
    tinyByFile.push([file, hits.length, Math.min(...hits)]);
  }
}

tinyByFile.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
for (const [file, count, minimum] of tinyByFile.slice(0, 20)) warnings.push(`${file}: ${count} sub-10px font declarations (minimum ${minimum}px)`);

console.log(`UI system audit read ${uiFiles.length} tracked interface files.`);
console.log(`Sub-10px typography declarations found: ${tinyDeclarations}. These are reported as migration hotspots unless a core-system invariant above is violated.`);
if (warnings.length) {
  console.log('\nUI migration hotspots:');
  for (const warning of warnings) console.log(`  WARN ${warning}`);
}
if (failures.length) {
  console.error(`\nUI system blockers (${failures.length}):`);
  for (const failure of failures) console.error(`  ERROR ${failure}`);
  process.exitCode = 1;
} else {
  console.log('\nUI system invariants passed: real 3D proof, one product map, optional minting, shared readable chrome, keyboard focus, and reduced-motion support are enforced.');
}
