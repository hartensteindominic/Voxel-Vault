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
  'app/property/HouseVoxelJourney.js',
  'app/property/property.module.css',
  'app/vault/property-drafts/page.js',
  'app/world/page.js',
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
const propertyRoute = read('app/property/page.js');
const property = read('app/property/HouseVoxelJourney.js');
const propertyCss = read('app/property/property.module.css');
const vault = read('app/vault/property-drafts/page.js');
const mint = read('app/property/mint/page.js');

must(/HomeProductPreview/.test(home), 'Homepage must use a real interactive voxel proof.');
must(!/voxelHouse/.test(home), 'Homepage must not regress to a decorative CSS house.');
must(/className=\{styles\.primaryAction\} href="\/property"/.test(home), 'Create must be the single visual primary hero action.');
must(!/secondaryAction/.test(home), 'Homepage must not present a competing secondary hero button.');
must(/HOUSE PHOTO → VOXEL → 3D · \$4\.99/.test(home), 'Homepage must state the focused house-photo product and price.');
must(/Upload a house\. Confirm the address\. Get a voxel image, then a mintable 3D voxel\./.test(home), 'Homepage must explain the exact creation sequence.');
must(/Saved to your Voxel Vault · mint when you want/.test(home), 'Homepage must make saving automatic and minting optional.');
must(/One property\. One collectible\./.test(home), 'Homepage must state the one-property uniqueness rule.');
must(/Digital collectible only\. No deed, title, or physical-property rights\./.test(home), 'Homepage must preserve the digital-only property-rights boundary.');
must(/LocalVoxelModelViewer/.test(preview), 'Home product proof must remain interactive rather than decorative.');

must(/Create · \$4\.99[\s\S]*Vault/.test(topNav), 'Primary product nav must stay focused on Create + Vault.');
must(!/label: 'World'/.test(topNav) && !/className=\{styles\.demo\}/.test(topNav), 'World and Demo must not compete in the primary header.');
must(/focusedFunnel/.test(topNav) && /mobileDocked/.test(topNav) && /isOrganizedUserRoute/.test(topNav), 'Shared top nav must distinguish focused Home/Create from organized secondary routes.');
must(/\.mobileDocked \.links\{display:none\}/.test(topCss), 'Organized mobile routes must let the bottom dock own navigation.');
must(/\.focusedFunnel \.links a:nth-child\(2\)\{display:inline-flex\}/.test(topCss), 'Focused Home/Create mobile header must keep Vault reachable.');
must(/pathname === '\/' \|\| pathname === '\/property'/.test(dock), 'Home and creator must suppress the duplicate bottom dock.');
must(/const DOCK = \[[\s\S]*id: 'home'[\s\S]*id: 'create'[\s\S]*id: 'vault'/.test(dock), 'Mobile dock must be condensed to Home, VoxelPop, and Vault.');
must(!/id: 'world'/.test(dock) && !/id: 'more'/.test(dock), 'World and More must not compete in the primary mobile dock.');
must(/@media\(max-width:720px\)/.test(dockCss) && /\.nav\{display:none\}/.test(dockCss), 'Bottom dock must be mobile-only.');

must(!/fontSize:\s*7\.8/.test(footer), 'Shared footer must not use unreadable 7.8px legal text.');
must(/\/demo/.test(footer) && /\/privacy/.test(footer) && /\/about/.test(footer), 'Shared footer must cover demo and trust surfaces.');
must(/\.vvConsumerFooterTruth\{[^}]*font-size:10\.5px/.test(system), 'Shared legal footer text must remain readable.');
must(/\[role="button"\]:focus-visible/.test(system), 'Custom interactive controls must receive visible keyboard focus.');
must(/prefers-reduced-motion:reduce/.test(system), 'UI system must respect reduced motion.');

must(/ProductTopNav/.test(demo), 'Public demo must use shared product chrome.');
must(/role="tablist"/.test(demo) && /aria-selected/.test(demo), 'Public demo stage switcher must expose tab semantics.');
for (const file of ['app/privacy/page.js', 'app/terms/page.js', 'app/about/page.js']) {
  const source = read(file);
  must(/ProductTopNav/.test(source), `${file}: trust surface must use shared product chrome`);
  must(!/styles\.top/.test(source), `${file}: trust surface must not own a competing local top nav`);
  must(!/styles\.footer/.test(source), `${file}: trust surface must not own a duplicate footer`);
}

must(/\.\/HouseVoxelJourney/.test(propertyRoute), 'Active /property route must use the focused house journey.');
must(/const labels = \['PHOTO', 'ADDRESS', 'VOXEL', '3D', 'DONE'\]/.test(property), 'Creator must expose the exact five-step flow.');
must(/Choose one house photo\./.test(property), 'Creator must start with one obvious photo action.');
must(/Confirm address/.test(property) && /\/api\/property-identity/.test(property), 'Creator must visibly confirm the canonical address before generation.');
must(/I took this photo or have permission to use it\./.test(property), 'Creator must preserve source-photo authorization.');
must(/\/api\/property-voxel-image\?/.test(property), 'Creator must wait for the generated voxel image.');
must(/\/api\/property-voxel-3d/.test(property) && /phase: 'voxel'/.test(property), 'Creator must turn that voxel image into the final 3D model.');
must(/MeshyModelViewer modelUrl=\{final3d\.modelUrl\}/.test(property), 'Creator must show the final movable 3D voxel.');
must(/Open inventory/.test(property), 'Completion must lead to the automatically saved result.');
must(/Mint this voxel/.test(property), 'Minting must remain available after saving.');
must(/Minting is optional/.test(property), 'Completion must explicitly state the optional-mint boundary.');
must(!/Looks good · continue|approvePreviewAndBuildVoxel/.test(property), 'Creator must not reintroduce a redundant approval screen.');
must(!/PropertyWorldMap|Add to My World/.test(property), 'World/map controls must stay out of the core creation funnel.');
must(/safe-area-inset-bottom/.test(propertyCss), 'Creator must respect iPhone safe areas.');
must(/prefers-reduced-motion/.test(propertyCss), 'Creator must respect reduced-motion preferences.');

must(/mintHref/.test(vault) && /Mint voxel/.test(vault), 'Inventory must support mint-later for a saved generated voxel.');
must(/Open 3D/.test(vault), 'Inventory must let users reopen the saved 3D model.');
must(/Keep in inventory/.test(mint), 'Mint page must let users leave the voxel unminted.');
must(/one-of-one mint|one mint/i.test(mint), 'Mint page must keep the one-property mint limit visible.');

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
tinyByFile.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
for (const [file, count, minimum] of tinyByFile.slice(0, 25)) warnings.push(`${file}: ${count} sub-10px declarations (minimum ${minimum}px)`);

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
  console.log('\nUI system invariants passed: one house-photo CTA, confirmed address, generated voxel image, final 3D voxel, automatic inventory save, optional one-property mint, focused navigation, trust chrome, focus visibility, and reduced-motion support.');
}
