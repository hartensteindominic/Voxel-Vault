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
  'app/components/ConsumerFooter.js',
  'app/components/FinancialOSNav.js',
  'app/components/FinancialOSNav.module.css',
  'app/ui-system.css',
  'app/page.js',
  'app/home.module.css',
  'app/demo/page.js',
  'app/property/page.js',
  'app/property/PropertyStudioFlow.js',
  'app/property/PropertyStudio.module.css',
  'app/property/PhotoReliefModelViewer.js',
  'app/property/LocalVoxelModelViewer.js',
  'app/property/mint/page.js',
  'app/vault/property-drafts/page.js',
  'app/world/page.js',
  'app/vault/page.js',
  'app/privacy/page.js',
  'app/terms/page.js',
  'app/about/page.js',
];
for (const file of required) must(fs.existsSync(path.join(root, file)), `${file}: required consumer UI file is missing`);

const home = read('app/page.js');
const homeCss = read('app/home.module.css');
const topNav = read('app/components/ProductTopNav.js');
const topCss = read('app/components/ProductTopNav.module.css');
const dock = read('app/components/FinancialOSNav.js');
const dockCss = read('app/components/FinancialOSNav.module.css');
const footer = read('app/components/ConsumerFooter.js');
const system = read('app/ui-system.css');
const demo = read('app/demo/page.js');
const propertyRoute = read('app/property/page.js');
const property = read('app/property/PropertyStudioFlow.js');
const propertyCss = read('app/property/PropertyStudio.module.css');
const photoPreview = read('app/property/PhotoReliefModelViewer.js');
const localViewer = read('app/property/LocalVoxelModelViewer.js');
const mintPage = read('app/property/mint/page.js');
const inventory = read('app/vault/property-drafts/page.js');

must(/PROPERTY → COLLECTIBLE/.test(home), 'Homepage must state the focused property collectible product.');
must(/Create a property voxel/.test(home) && /href="\/property"/.test(home), 'Homepage must have a clear property-creation CTA.');
must(/Open Inventory/.test(home), 'Homepage must keep Inventory reachable without entering creation.');
must(/confirm the address/i.test(home) && /voxel image/i.test(home) && /saved to Inventory first/i.test(home), 'Homepage must explain the guided photo-to-Inventory path.');
must(/Mint if you want|Minting optional/i.test(home), 'Homepage must keep minting explicitly optional.');
must(/This collectible is digital only\./.test(home) && /does not create or transfer deed, title/i.test(home), 'Homepage must keep the digital-only property-rights boundary visible.');
must(!/\$4\.99/.test(home), 'Homepage must not place legacy per-property checkout pricing in the core flow.');
must(!/BUY PIECE|BUY WHOLE|guaranteed returns|guaranteed yield|risk[- ]free/i.test(home), 'Homepage must not make physical-property purchase or return claims.');
must(/#6f42f5/i.test(homeCss) && /#c9ff55/i.test(homeCss), 'Homepage must use the new playful Voxel Vault color system.');
must(/@media\(max-width:620px\)/.test(homeCss), 'Homepage must retain a dedicated mobile layout.');

must(/label: 'Create'/.test(topNav) && /label: 'Inventory'/.test(topNav), 'Legacy shared product nav must remain focused where it is still used.');
must(!/\$4\.99/.test(topNav), 'Shared product nav must not insert checkout pricing.');
must(!/label: 'World'/.test(topNav) && !/className=\{styles\.demo\}/.test(topNav), 'World and Demo must not compete in the shared product header.');
must(/focusedFunnel/.test(topNav) && /mobileDocked/.test(topNav) && /isOrganizedUserRoute/.test(topNav), 'Shared top nav must distinguish focused and organized routes.');
must(/\.mobileDocked \.links\{display:none\}/.test(topCss), 'Organized mobile routes must let the bottom dock own navigation.');
must(/usesPropertyStudioNavigation/.test(dock), 'The old mobile dock must stay out of the redesigned Home/Create/Mint/Inventory experience.');
must(/const DOCK = \[[\s\S]*id: 'home'[\s\S]*id: 'create'[\s\S]*id: 'vault'/.test(dock), 'Mobile dock must remain Home, Create, and Vault on legacy organized routes.');
must(!/id: 'world'/.test(dock) && !/id: 'more'/.test(dock), 'World and More must not compete in the legacy mobile dock.');
must(/@media\(max-width:720px\)/.test(dockCss) && /\.nav\{display:none\}/.test(dockCss), 'Bottom dock must stay mobile-only.');

must(!/fontSize:\s*7\.8/.test(footer), 'Shared footer must not use unreadable 7.8px legal text.');
must(/\/demo/.test(footer) && /\/privacy/.test(footer) && /\/about/.test(footer), 'Shared footer must cover demo and trust surfaces.');
must(/\.vvConsumerFooterTruth\{[^}]*font-size:10\.5px/.test(system), 'Shared legal footer text must remain readable.');
must(/\[role="button"\]:focus-visible/.test(system), 'Custom interactive controls must receive visible keyboard focus.');
must(/prefers-reduced-motion:reduce/.test(system), 'UI system must respect reduced motion.');

must(/ProductTopNav/.test(demo), 'Public demo must keep its shared product chrome.');
must(/role="tablist"/.test(demo) && /aria-selected/.test(demo), 'Public demo stage switcher must expose tab semantics.');
for (const file of ['app/privacy/page.js','app/terms/page.js','app/about/page.js']) {
  const source = read(file);
  must(/ProductTopNav/.test(source), `${file}: trust surface must use shared product chrome`);
  must(!/styles\.top/.test(source), `${file}: trust surface must not own a competing local top nav`);
  must(!/styles\.footer/.test(source), `${file}: trust surface must not own a duplicate footer`);
}

must(/PropertyStudioFlow/.test(propertyRoute), 'Live /property route must use the redesigned guided property studio.');
must(/const PROGRESS = \[[\s\S]*PHOTO[\s\S]*ADDRESS[\s\S]*VOXEL[\s\S]*BUILD[\s\S]*VAULT/.test(property), 'Creator must expose the requested five-stage property journey.');
must(/Start with one great photo\./.test(property), 'Creator must start with one obvious photo page.');
must(/Confirm the address\./.test(property), 'Address confirmation must be the second page.');
must(/\/api\/property-generation\/confirm/.test(property), 'Creator must use the duplicate-safe address confirmation endpoint.');
must(!/\/api\/property-generation\/checkout|Pay \$|Stripe/i.test(property), 'Live creator must not contain a per-property checkout step.');
must(/PhotoReliefModelViewer/.test(property), 'Creator must include a real voxel preview page.');
must(/Build the 3D voxel/.test(property) && /setStage\('build'\)/.test(property), 'Voxel preview must require the requested explicit page-by-page continue action.');
must(/LocalVoxelModelViewer/.test(property) && /\/api\/property-local-voxel/.test(property), 'Creator must build and persist a real movable voxel.');
must(/\/api\/property-generation\/finalize/.test(property), 'Creator must finalize the one-property lock after the 3D voxel exists.');
must(/savePropertyDraft\(finishedDraft\)/.test(property) && /savePropertyDraftToAccount/.test(property), 'Completion must save locally and to signed-in Inventory.');
must(/Mint this voxel/.test(property) && /Keep in Inventory/.test(property), 'Completion must offer both mint and keep-in-inventory outcomes.');
must(/modelUrl=\$\{encodeURIComponent\(final3d\.modelUrl\)\}/.test(property), 'Completion must carry the saved 3D model into Mint.');
must(/does not create rights in the physical property/i.test(property), 'Completion must preserve the physical-property rights boundary.');
must(!/PropertyWorldMap|Add to My World/.test(property), 'World/map controls must stay out of the core creation funnel.');
must(/aria-label="Property address"/.test(property), 'Address field must have an accessible label.');
must(/role="status"/.test(property), 'Dynamic creation status must be announced.');
must(/normalizeIphonePhoto/.test(property) && /\.heic,\.heif/.test(property), 'Creator must remain iPhone-photo friendly.');
must(/#6f42f5/i.test(propertyCss) && /#c9ff55/i.test(propertyCss), 'Creator, Mint and Inventory must share the new color system.');
must(/safe-area-inset-bottom/.test(propertyCss), 'Shared property studio styles must respect iPhone safe areas.');
must(/new THREE\.InstancedMesh/.test(photoPreview), 'Voxel preview stage must use real voxel instances.');
must(/InstancedMesh/.test(localViewer), 'Movable 3D result must use real voxel geometry.');
must(/readPropertyDrafts/.test(mintPage), 'Mint must recover model continuity from saved Inventory when needed.');
must(/Keep in Inventory/i.test(mintPage), 'Mint must preserve the no-mint Inventory choice.');
must(/directMintHref/.test(inventory) && /encodeURIComponent\(modelUrl\)/.test(inventory), 'Inventory must send the exact saved model into Mint.');

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
  console.log('\nUI system invariants passed: photo -> address -> voxel preview -> explicit 3D build -> Inventory -> optional one-property mint, with consistent navigation, trust boundaries, accessibility, and responsive behavior.');
}
