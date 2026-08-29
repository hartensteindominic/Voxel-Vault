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
  'app/property/HouseVoxelMintFlow.js',
  'app/property/PhotoReliefModelViewer.js',
  'app/property/LocalVoxelModelViewer.js',
  'app/world/page.js',
  'app/vault/page.js',
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
const property = read('app/property/HouseVoxelMintFlow.js');
const photoPreview = read('app/property/PhotoReliefModelViewer.js');
const localViewer = read('app/property/LocalVoxelModelViewer.js');

must(/HomeProductPreview/.test(home), 'Homepage must use real production 3D proof.');
must(!/voxelHouse/.test(home), 'Homepage must not regress to a decorative CSS house.');
must(/className=\{styles\.primaryAction\} href="\/property"/.test(home), 'Create must be the single visual primary hero action.');
must(!/secondaryAction/.test(home), 'Homepage must not present a competing secondary hero button.');
must(/HOUSE PHOTO → VOXEL → MINT/.test(home) && /confirm the address/i.test(home) && /Saved to Inventory/i.test(home), 'Homepage must explain the condensed house creation path.');
must(!/\$4\.99/.test(home), 'Homepage must not place checkout pricing in the core house flow.');
must(/collectible is digital/i.test(home) && /deed, title, or physical-property rights/i.test(home), 'Homepage must keep the digital-only physical-property boundary visible.');
must(/LocalVoxelModelViewer/.test(preview), 'Home product proof must use the actual movable-voxel viewer.');
must(/>Address</.test(preview) && />Inventory</.test(preview), 'Home proof must show address confirmation and Inventory.');
must(!/\$4\.99/.test(preview), 'Home proof must not reintroduce a price badge.');

must(/label: 'Create'/.test(topNav) && /label: 'Inventory'/.test(topNav), 'Primary product nav must stay focused on Create + Inventory.');
must(!/\$4\.99/.test(topNav), 'Primary product nav must not insert a checkout price.');
must(!/label: 'World'/.test(topNav) && !/className=\{styles\.demo\}/.test(topNav), 'World and Demo must not compete in the primary header.');
must(/focusedFunnel/.test(topNav) && /mobileDocked/.test(topNav) && /isOrganizedUserRoute/.test(topNav), 'Shared top nav must distinguish focused Home/Create from organized secondary routes.');
must(/\.mobileDocked \.links\{display:none\}/.test(topCss), 'Organized mobile routes must let the bottom dock own navigation.');
must(/\.focusedFunnel \.links a:nth-child\(2\)\{display:inline-flex\}/.test(topCss), 'Focused Home/Create mobile header must keep Inventory reachable.');
must(/pathname === '\/' \|\| pathname === '\/property'/.test(dock), 'Home and creator must suppress the duplicate bottom dock.');
must(/const DOCK = \[[\s\S]*id: 'home'[\s\S]*id: 'create'[\s\S]*id: 'vault'/.test(dock), 'Mobile dock must remain Home, Create, and Vault.');
must(!/id: 'world'/.test(dock) && !/id: 'more'/.test(dock), 'World and More must not compete in the primary mobile dock.');
must(/@media\(max-width:720px\)/.test(dockCss) && /\.nav\{display:none\}/.test(dockCss), 'Bottom dock must be mobile-only.');

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

must(/HouseVoxelMintFlow/.test(propertyRoute), 'Live /property route must use the house voxel flow.');
must(/const LABELS = \['PHOTO', 'ADDRESS', 'VOXEL IMAGE', '3D VOXEL', 'DONE'\]/.test(property), 'Creator must show the requested five-stage journey.');
must(/Upload one house photo\./.test(property), 'Creator must start with one obvious photo action.');
must(/Confirm the address\./.test(property), 'Address confirmation must be the second step.');
must(/\/api\/property-generation\/confirm/.test(property), 'Creator must use the duplicate-safe address confirmation endpoint.');
must(!/\/api\/property-generation\/checkout|Pay \$|Stripe/i.test(property), 'Creator must not contain a checkout step.');
must(/PhotoReliefModelViewer/.test(property) && /setStage\('model'\)/.test(property), 'Voxel image must automatically advance into 3D generation.');
must(!/Looks good · continue|approveVoxelImage|previewApproved/.test(property), 'Creator must not add an unnecessary voxel-image approval click.');
must(/LocalVoxelModelViewer/.test(property) && /\/api\/property-local-voxel/.test(property), 'Creator must build and persist a real movable voxel.');
must(/\/api\/property-generation\/finalize/.test(property), 'Creator must finalize the one-property lock after the 3D voxel exists.');
must(/savePropertyDraft\(finishedDraft\)/.test(property) && /savePropertyDraftToAccount/.test(property), 'Completion must save the result locally and to the signed-in Inventory.');
must(/Mint voxel/.test(property) && /Keep in inventory/.test(property), 'Completion must offer both mint and keep-in-inventory outcomes.');
must(/does not create rights in the physical property/i.test(property), 'Completion must preserve the physical-property rights boundary.');
must(!/PropertyWorldMap|Add to My World/.test(property), 'World/map controls must stay out of the core creation funnel.');
must(/aria-label="House address"/.test(property), 'Address field must have an accessible label.');
must(/role="status"/.test(property), 'Dynamic creation status must be announced.');
must(/normalizeIphonePhoto/.test(property) && /\.heic,\.heif/.test(property), 'Creator must remain iPhone-photo friendly.');
must(/new THREE\.InstancedMesh/.test(photoPreview), 'Voxel image stage must use real voxel instances.');
must(/InstancedMesh/.test(localViewer), 'Movable 3D result must use real voxel geometry.');

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
  console.log('\nUI system invariants passed: photo -> address -> voxel image -> automatic 3D voxel -> Inventory -> optional one-property mint, with focused navigation, trust boundaries, accessibility, and responsive behavior.');
}
