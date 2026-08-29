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
const homeCss = read('app/home.module.css');
const preview = read('app/components/HomeProductPreview.js');
const previewCss = read('app/components/HomeProductPreview.module.css');
const topNav = read('app/components/ProductTopNav.js');
const topCss = read('app/components/ProductTopNav.module.css');
const dock = read('app/components/FinancialOSNav.js');
const dockCss = read('app/components/FinancialOSNav.module.css');
const footer = read('app/components/ConsumerFooter.js');
const system = read('app/ui-system.css');
const demo = read('app/demo/page.js');
const property = read('app/property/PropertyJourneyExact.js');
const propertyCss = read('app/property/property.module.css');
const photoViewerCss = read('app/property/PhotoReliefModelViewer.module.css');

must(/HomeProductPreview/.test(home), 'Homepage must use real production 3D proof.');
must(!/voxelHouse/.test(home), 'Homepage must not regress to a decorative CSS house.');
must(/className=\{styles\.primaryAction\} href="\/property"/.test(home), 'Create must be the single visual primary hero action.');
must(/className=\{styles\.secondaryAction\} href="\/demo"/.test(home), 'No-login demo must be the secondary proof action.');
must(/WHAT \$4\.99 INCLUDES/.test(home), 'Purchase detail must stay in progressive disclosure.');
must(/AFTER CREATION/.test(home), 'Vault, World, and mint choices must stay downstream of the core creation flow.');
must(/3D VOXEL PHOTO/.test(home) && /MOVABLE VOXEL/.test(home), 'Homepage must distinguish the reviewable voxel photo from the movable model.');
must(/PhotoReliefModelViewer/.test(preview) && /LocalVoxelModelViewer/.test(preview), 'Home product proof must use the actual voxel-photo and movable-voxel viewers.');
must(/label: 'House photo'/.test(preview) && /label: '3D voxel photo'/.test(preview) && /label: 'Movable 3D voxel'/.test(preview), 'Home product proof must retain all three visual stages.');
must(!/box-shadow:0 6px 0 var\(--vv-purple-700\)/.test(homeCss), 'Homepage CTA must not regress to an exaggerated toy-like extrusion.');
must(!/box-shadow:0 4px 0 var\(--vv-purple-700\)/.test(previewCss), 'Home sample controls must stay flat and product-like.');

must(/Create · \$4\.99[\s\S]*Vault[\s\S]*World/.test(topNav), 'Desktop product nav must stay focused on Create, Vault, and World.');
must(/href="\/demo"/.test(topNav), 'Desktop product nav must keep the public demo reachable.');
must(!/label: 'More'/.test(topNav), 'More must not return to the primary desktop product navigation.');
must(/isOrganizedUserRoute/.test(topNav) && /mobileDocked/.test(topNav), 'Shared top nav must know when the mobile dock owns core navigation.');
must(/\.mobileDocked \.links\{display:none\}/.test(topCss), 'Core mobile routes must not duplicate the bottom navigation.');
must(/SIMPLE_PROPERTY_DOCK\.filter\(\(item\) => item\.id !== 'more'\)/.test(dock), 'Core iPhone navigation must stay condensed to Home, Create, World, and Vault.');
must(/@media\(max-width:720px\)/.test(dockCss) && /\.nav\{display:none\}/.test(dockCss), 'Bottom dock must be mobile-only.');
must(!/box-shadow:0 3px 0 #5120cf/.test(dockCss), 'Active dock icons must stay flat instead of toy-like.');
must(!/box-shadow:0 4px 0 var\(--vv-purple-700\)/.test(topCss), 'VoxelPop top-nav mark must stay flat.');

must(!/fontSize:\s*7\.8/.test(footer), 'Shared footer must not use unreadable 7.8px legal text.');
must(/\/demo/.test(footer) && /\/privacy/.test(footer) && /\/about/.test(footer), 'Shared footer must cover demo and trust surfaces.');
must(/\.vvConsumerFooterTruth\{[^}]*font-size:10\.5px/.test(system), 'Shared legal footer text must remain readable.');
must(/\[role="button"\]:focus-visible/.test(system), 'Custom interactive controls must receive visible keyboard focus.');
must(/prefers-reduced-motion:reduce/.test(system), 'UI system must respect reduced motion.');

must(/aspect-ratio:4\/3/.test(propertyCss), 'Create house review must stay landscape-oriented so the property is the visual focus.');
must(!/box-shadow:0 6px 0 var\(--purple-dark\)/.test(propertyCss), 'Core Create buttons must not regress to exaggerated extruded shadows.');
must(/width:132px/.test(photoViewerCss), 'Desktop voxel-photo review must keep a prominent original-photo comparison inset.');
must(/width:104px/.test(photoViewerCss), 'Mobile voxel-photo review must keep the original photo large enough to judge likeness.');

must(/ProductTopNav/.test(demo), 'Public demo must use shared product chrome.');
must(/role="tablist"/.test(demo) && /aria-selected/.test(demo), 'Public demo stage switcher must expose tab semantics.');
must(/3D VOXEL PHOTO/.test(demo) && /MOVABLE 3D VOXEL/.test(demo), 'Public demo must use the same two-output terminology as Create.');
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
  console.log('\nUI system invariants passed: real three-stage VoxelPop proof, condensed navigation, landscape Create review, prominent source comparison, optional minting, focus visibility, and reduced-motion support are enforced.');
}
