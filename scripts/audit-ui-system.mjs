import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const warnings = [];
const must = (condition, message) => { if (!condition) failures.push(message); };
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString('utf8').split('\0').filter(Boolean).sort();
const uiFile = (file) => {
  if (['index.html', 'privacy.html', 'terms.html'].includes(file)) return true;
  if (file === 'lib/product-map.js') return true;
  if (!/\.(?:js|jsx|ts|tsx|css|scss|html)$/.test(file)) return false;
  return file.startsWith('app/') || file.startsWith('components/') || file.startsWith('styles/');
};
const uiFiles = tracked.filter(uiFile);

const required = [
  'app/components/ProductTopNav.js',
  'app/components/ProductTopNav.module.css',
  'app/components/HomeProductPreview.js',
  'app/components/ConsumerFooter.js',
  'app/components/FinancialOSNav.js',
  'app/components/FinancialOSNav.module.css',
  'app/ui-system.css',
  'app/page.js',
  'app/demo/page.js',
  'app/property/page.js',
  'app/world/page.js',
  'app/vault/page.js',
  'app/more/page.js',
  'app/privacy/page.js',
  'app/terms/page.js',
  'app/about/page.js',
];
for (const file of required) must(fs.existsSync(path.join(root, file)), `${file}: required consumer UI file is missing`);

const home = read('app/page.js');
const preview = read('app/components/HomeProductPreview.js');
const topNav = read('app/components/ProductTopNav.js');
const topCss = read('app/components/ProductTopNav.module.css');
const dock = read('app/components/FinancialOSNav.js');
const dockCss = read('app/components/FinancialOSNav.module.css');
const footer = read('app/components/ConsumerFooter.js');
const system = read('app/ui-system.css');
const demo = read('app/demo/page.js');
const property = read('app/property/PropertyJourneyExact.js');
const propertyPage = read('app/property/page.js');

must(/HomeProductPreview/.test(home), 'Homepage must use real production 3D proof.');
must(!/voxelHouse/.test(home), 'Homepage must not regress to a decorative CSS house.');
must(/className=\{styles\.primaryAction\} href="\/property"/.test(home), 'Create must be the single visual primary hero action.');
must(/className=\{styles\.secondaryAction\} href="\/demo"/.test(home), 'No-login demo must remain the secondary proof action.');
must(/ONE SIMPLE FLOW/.test(home) && /Photo → approve → done\./.test(home), 'Homepage must keep the condensed one-flow explanation.');
must(/Saved automatically/.test(home) && /Mint optional/.test(home), 'Homepage must keep automatic-save and optional-mint facts visible.');
must(/VoxelPop is a digital creation product\./.test(home) && /does not create ownership[\s\S]*physical property/i.test(home), 'Homepage must keep the digital-only physical-property boundary visible.');
must(/PhotoReliefModelViewer/.test(preview) && /LocalVoxelModelViewer/.test(preview), 'Home product proof must use the actual voxel-photo and movable-voxel viewers.');

must(/Create · \$4\.99[\s\S]*Vault/.test(topNav), 'Primary product nav must keep only Create and Vault as the focused choices.');
must(!/label: 'World'/.test(topNav) && !/className=\{styles\.demo\}/.test(topNav), 'World and Demo must stay out of the primary header.');
must(/focusedFunnel/.test(topNav) && /mobileDocked/.test(topNav) && /isOrganizedUserRoute/.test(topNav), 'Shared top nav must distinguish the focused Home/Create funnel from routes owned by the mobile dock.');
must(/\.mobileDocked \.links\{display:none\}/.test(topCss), 'Organized mobile routes must let the bottom dock own navigation instead of duplicating header links.');
must(/pathname === '\/' \|\| pathname === '\/property'/.test(dock), 'Home and the paid creator must suppress the duplicate bottom dock.');
must(/const DOCK = \[[\s\S]*id: 'home'[\s\S]*id: 'create'[\s\S]*id: 'vault'/.test(dock), 'Mobile dock must be condensed to Home, VoxelPop, and Vault.');
must(!/id: 'world'/.test(dock) && !/id: 'more'/.test(dock), 'World and More must not compete in the primary mobile dock.');
must(/@media\(max-width:720px\)/.test(dockCss) && /\.nav\{display:none\}/.test(dockCss), 'Bottom dock must be mobile-only.');
must(/FinancialOSNav\.module\.css/.test(dock), 'Bottom dock must use responsive stylesheet rather than always-on inline chrome.');

must(/SimpleJourneyPresentation/.test(propertyPage), 'Property creator page must apply the one-action presentation layer.');
must(/data-vv-hide-duplicate/.test(propertyPage) && /Done · Open Vault/.test(propertyPage), 'Creator must hide duplicate actions and make Vault the default finished action.');

must(!/fontSize:\s*7\.8/.test(footer), 'Shared footer must not use unreadable 7.8px legal text.');
must(/\/demo/.test(footer) && /\/privacy/.test(footer) && /\/about/.test(footer), 'Shared footer must cover demo and trust surfaces.');
must(/\.vvConsumerFooterTruth\{[^}]*font-size:10\.5px/.test(system), 'Shared legal footer text must remain readable.');
must(/\[role="button"\]:focus-visible/.test(system), 'Custom interactive controls must receive visible keyboard focus.');
must(/prefers-reduced-motion:reduce/.test(system), 'UI system must respect reduced motion.');

must(/ProductTopNav/.test(demo), 'Public demo must use shared product chrome.');
must(/role="tablist"/.test(demo) && /aria-selected/.test(demo), 'Public demo stage switcher must expose tab semantics.');
for (const file of ['app/privacy/page.js','app/terms/page.js','app/about/page.js']) {
  const source = read(file);
  must(/ProductTopNav/.test(source), `${file}: trust surface must use shared product chrome`);
  must(!/styles\.top/.test(source), `${file}: trust surface must not own a competing local top nav`);
  must(!/styles\.footer/.test(source), `${file}: trust surface must not own a duplicate footer`);
}

must(!/Mint is next/i.test(property), 'Creation completion must not imply minting is mandatory.');
must(/Minting is optional/.test(property), 'Creation completion must state the optional mint boundary.');

let tinyDeclarations = 0;
const tinyByFile = [];
for (const file of uiFiles) {
  let source;
  try { source = read(file); } catch { continue; }
  const values = [];
  for (const match of source.matchAll(/font-size\s*:\s*([0-9.]+)px/gi)) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value < 10) values.push(value);
  }
  for (const match of source.matchAll(/fontSize\s*:\s*['"]([0-9.]+)px['"]/g)) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value < 10) values.push(value);
  }
  if (values.length) {
    tinyDeclarations += values.length;
    tinyByFile.push([file, values.length, Math.min(...values)]);
  }
}
tinyByFile.sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]));
for (const [file,count,minimum] of tinyByFile.slice(0,25)) warnings.push(`${file}: ${count} sub-10px declarations (minimum ${minimum}px)`);

console.log(`UI system audit read ${uiFiles.length} tracked interface files.`);
console.log(`Sub-10px typography declarations found: ${tinyDeclarations}. They remain visible migration hotspots, while core-system violations fail the build.`);
if (warnings.length) {
  console.log('\nUI migration hotspots:');
  for (const warning of warnings) console.log(`  WARN ${warning}`);
}
if (failures.length) {
  console.error(`\nUI system blockers (${failures.length}):`);
  for (const failure of failures) console.error(`  ERROR ${failure}`);
  process.exitCode = 1;
} else {
  console.log('\nUI system invariants passed: real 3D proof, one clear homepage flow, Create/Vault primary navigation, compact Home/VoxelPop/Vault mobile dock, one-action creator presentation, readable trust chrome, optional minting, focus visibility, and reduced-motion support are enforced.');
}
