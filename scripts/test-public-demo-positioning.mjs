import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const home = read('app/page.js');
const homeCss = read('app/home.module.css');
const homePreview = read('app/components/HomeProductPreview.js');
const bankGate = read('app/bank/GalacticBankGate.js');
const bank = read('app/bank/BankClient.js');
const bankCss = read('app/bank/galactic-trust.css');
const bankEnhancements = read('app/bank/GalacticDashboardEnhancements.js');
const bankEnhancementCss = read('app/bank/enhancements.css');
const photoViewer = read('app/property/PhotoReliefModelViewer.js');
const photoViewerStyles = read('app/property/PhotoReliefModelViewer.module.css');
const demo = read('app/demo/page.js');
const layout = read('app/layout.js');
const privacy = read('app/privacy/page.js');
const terms = read('app/terms/page.js');
const about = read('app/about/page.js');
const legacyPrivacy = read('privacy.html');
const legacyTerms = read('terms.html');
const readme = read('README.md');
const og = read('app/opengraph-image.js');
const galacticHome = /GalacticBankGate/.test(home);

if (galacticHome) {
  assert.match(home, /GalacticBankGate/, 'home must render the Galactic Trust account/banking experience');
  assert.match(home, /galactic-trust\.css/, 'home must load the approved Galactic Trust visual system');
  assert.match(home, /enhancements\.css/, 'home must load the Galactic Trust interaction layer');
  assert.match(bankGate, /Continue with Google/, 'Galactic Trust onboarding must keep Google sign-in');
  assert.match(bankGate, /signInWithOtp/, 'Galactic Trust onboarding must keep passwordless email sign-in');
  assert.match(bankGate, /Explore the Stars demo/, 'Galactic Trust onboarding must keep a low-friction demo path');
  assert.match(bankGate, /simulated banking experience/i, 'Galactic Trust onboarding must identify the simulated banking boundary');
  assert.match(bankGate, /financial technology product, not a bank/i, 'Galactic Trust onboarding must identify the nonbank boundary');
  assert.match(bank, /DEMO BANKING/, 'dashboard must label demo banking visibly');
  assert.match(bank, /No real deposits are held and no real money moves in this build\./, 'dashboard must never imply that demo balances are real deposits');
  assert.match(bank, /Recent Activity/, 'dashboard must keep clear transaction history visible');
  assert.match(bank, /Security & Privacy/, 'dashboard must keep trust and privacy controls visible');
  assert.match(bankEnhancements, /Deposit/, 'dashboard must surface Deposit as a primary action');
  assert.match(bankEnhancements, /Send/, 'dashboard must surface Send as a primary action');
  assert.match(bankEnhancements, /Swap/, 'dashboard must surface Swap as a primary action');
  assert.match(bankEnhancements, /1W[\s\S]*1M[\s\S]*3M/, 'balance card must expose interactive demo trend ranges');
  assert.match(bankEnhancements, /Explore the Stars/, 'dashboard must include the guided Explore the Stars tour');
  assert.match(bankEnhancements, /metaKey \|\| event\.ctrlKey/, 'dashboard must include the command palette shortcut');
  assert.match(bankEnhancements, /visualViewport/, 'dashboard must respond to mobile soft-keyboard viewport changes');
  assert.match(bankEnhancements, /\/bank\/readiness/, 'dashboard must expose regulated launch status');
  assert.match(bankEnhancementCss, /safe-area-inset-bottom/, 'dashboard must respect mobile safe areas');
  assert.match(bankEnhancementCss, /pointer:coarse/, 'dashboard must provide coarse-pointer mobile/VR behavior');
  assert.match(bankEnhancementCss, /gt-priority-actions/, 'priority actions must receive a dedicated responsive treatment');
  assert.match(bankCss, /#07103d|#10163d|#2d45ff|#6b38ff/i, 'dashboard must retain the approved cosmic banking palette');
  assert.doesNotMatch(home, /BUY PIECE|BUY WHOLE|guaranteed returns|guaranteed yield|risk[- ]free/i, 'front door must not make investment purchase or return claims');
} else {
  assert.match(home, /PROPERTY → COLLECTIBLE/, 'home must communicate the focused property collectible product immediately');
  assert.match(home, /Create a property voxel/, 'home must keep a clear creation CTA');
  assert.match(home, /Open Inventory/, 'home must keep the saved collection reachable from the front door');
  assert.match(home, /confirm the address/i, 'home must include the property confirmation step');
  assert.match(home, /voxel image/i, 'home must explain the voxel-preview stage');
  assert.match(home, /saved to Inventory first/i, 'home must make the automatic saved result clear');
  assert.match(home, /Mint if you want|Minting optional/i, 'home must keep minting explicitly optional');
  assert.doesNotMatch(home, /Create mine · \$4\.99|Create · \$4\.99/, 'home must not insert legacy per-property checkout copy into the guided studio');
  assert.match(home, /heroVisual/, 'home hero must use the new branded voxel-house visual system');
  assert.match(homeCss, /#6f42f5/i, 'home must use the new Voxel Vault purple');
  assert.match(homeCss, /#c9ff55/i, 'home must use the playful lime accent');
  assert.match(homeCss, /@media\(max-width:620px\)/, 'home must include a dedicated phone layout');
  assert.match(home, /This collectible is digital only\./, 'home must identify the collectible as digital');
  assert.match(home, /does not create or transfer deed, title/i, 'home must preserve the physical-property rights boundary');
  assert.match(home, /Privacy/, 'home footer must expose Privacy');
  assert.match(home, /Terms/, 'home footer must expose Terms');
  assert.match(home, /About/, 'home footer must expose About/contact information');
}

// Keep the production viewer proof component healthy for demo/secondary surfaces even though
// the current public front door may be Galactic Trust.
assert.match(homePreview, /LocalVoxelModelViewer/, 'production proof component must keep the real movable-voxel viewer');
assert.doesNotMatch(homePreview, /PhotoReliefModelViewer/, 'production proof component must not force users through a stage switcher');
assert.match(homePreview, />Address</, 'production proof component must disclose address confirmation');
assert.match(homePreview, />Inventory</, 'production proof component must disclose where the finished voxel is saved');
assert.match(homePreview, /MOVABLE 3D VOXEL/, 'production proof component must identify the interactive final result');
assert.doesNotMatch(homePreview, /\$4\.99/, 'production proof component must not show stale checkout pricing');

assert.match(photoViewer, /getImageData\(0, 0, columns, rows\)/, 'voxel-photo stage must sample visible source-image colors');
assert.match(photoViewer, /new THREE\.InstancedMesh/, 'voxel-photo stage must render actual voxel instances');
assert.match(photoViewer, /new THREE\.BoxGeometry\(1, 1, 1\)/, 'voxel-photo stage must use real block geometry');
assert.match(photoViewer, /const columns = compact \? 52 : 64/, 'voxel-photo stage must keep enough source detail for roofs, doors and windows to remain recognizable');
assert.match(photoViewer, /const baseDepth = 0\.10/, 'voxel-photo geometry must stay shallow enough to preserve the photographed likeness');
assert.match(photoViewer, /edge \* 0\.055/, 'voxel depth may respond gently to visible image structure without turning into a thick relief');
assert.doesNotMatch(photoViewer, /backingGeometry|plinthGeometry/, 'the voxel photo must be the geometry itself, not a backed picture or display plaque');
assert.match(photoViewer, /ORIGINAL PHOTO/, 'voxel-photo preview must keep the original source visible for comparison');
assert.match(photoViewer, /HIGH-FIDELITY PHOTO MATCH/, 'viewer must identify the source-faithful output as a likeness review');
assert.match(photoViewer, /targetY = clamp\(targetY \+ dx \* 0\.0034, -0\.28, 0\.28\)/, 'single-photo rotation must stay tightly bounded around the known front view');
assert.match(photoViewer, /ArrowLeft|ArrowRight/, '3D voxel photo must support keyboard inspection as well as drag input');
assert.match(photoViewerStyles, /focus-visible/, '3D viewer must keep a visible keyboard focus treatment');
assert.match(photoViewerStyles, /width:132px/, 'desktop likeness review must keep a large original-photo comparison card');

assert.match(demo, /FREE SAMPLE · NO LOGIN · NO PAYMENT/, 'demo route must remain public and free to inspect even though it is no longer a competing hero CTA');
assert.match(demo, /built-in demo artwork/i, 'demo must identify its built-in artwork');
assert.match(demo, /3D VOXEL PHOTO/, 'demo must present the intermediate voxel-photo state');
assert.match(demo, /MOVABLE 3D VOXEL/, 'demo must present the separate movable voxel state');
assert.match(demo, /not a fake reconstruction of unseen walls/i, 'demo must explain the single-photo reconstruction boundary');
assert.match(demo, /cannot prove hidden sides/i, 'demo must state what a single photo cannot establish');
assert.doesNotMatch(demo, /getSupabaseBrowserAsync|signInWithOAuth|checkout\.sessions|\/api\/property-generation\/checkout/, 'public demo must not hide an auth or payment gate');

if (galacticHome) {
  assert.match(layout, /Galactic Trust \| Financial App/, 'site metadata must identify Galactic Trust as a financial app');
  assert.match(layout, /financial technology interface/i, 'site metadata must describe the current financial interface');
  assert.match(layout, /Galactic Trust is not a bank/, 'metadata must preserve the nonbank boundary');
  assert.match(layout, /approved sponsor-bank program/, 'metadata must preserve the provider-backed launch boundary');
  assert.doesNotMatch(layout, /Member FDIC|FDIC[- ]insured bank|bank charter/i, 'metadata must not imply unverified banking protections or charter status');
  assert.match(og, /Galactic Trust/, 'social preview must match the Galactic Trust public front door');
  assert.match(og, /Your money/, 'social preview must use the Galactic Trust product story');
  assert.match(og, /SIMULATED BANKING/, 'social preview must preserve the demo-money boundary');
  assert.match(og, /DEPOSIT[\s\S]*SEND[\s\S]*SWAP/, 'social preview must reflect the fast-action dashboard');
} else {
  assert.match(layout, /Turn Property Photos into 3D Voxel Collectibles/, 'site metadata must use the redesigned current promise');
  assert.match(layout, /confirm the address, build a 3D voxel collectible/i, 'metadata must describe the property-photo creation journey');
  assert.match(layout, /mint it when you want/i, 'metadata must keep minting optional and downstream');
  assert.doesNotMatch(layout, /real estate digital twin|NFT vault/i, 'metadata must not revive broad legacy positioning');
  assert.match(og, /house photo into a movable 3D voxel/i, 'social preview may retain the detailed product story');
  assert.match(og, /3D VOXEL PHOTO/, 'social preview steps must name the voxel-photo stage');
  assert.match(og, /MOVABLE VOXEL/, 'social preview steps must name the movable-voxel stage');
}

for (const page of [privacy, terms, about]) {
  assert.match(page, /Voxel Vault|VOXEL VAULT/, 'legacy trust pages must identify the repository/operator surface');
  assert.doesNotMatch(page, /ToolMint/, 'trust pages must not expose the unrelated legacy ToolMint brand');
}
assert.doesNotMatch(legacyPrivacy, /ToolMint/, 'root privacy HTML must no longer expose ToolMint');
assert.doesNotMatch(legacyTerms, /ToolMint/, 'root terms HTML must no longer expose ToolMint');
assert.match(privacy, /source photo/i, 'privacy page must explain source-photo handling');
assert.match(terms, /\$4\.99 DIGITAL/, 'terms must retain the existing paid-product disclosure until commercial terms are revised separately');
assert.match(about, /Contact and feedback/, 'about page must provide a real feedback/contact route');

assert.match(readme, /What this repo currently ships/, 'README must lead with the shipping product');
assert.match(readme, /Architecture at a glance/, 'README must document the architecture');
assert.match(readme, /Repo scope/, 'README must separate experimental systems from the public product');
assert.match(readme, /CONTRIBUTING\.md/, 'README must expose contribution guidance');

console.log(`Public positioning checks passed: ${galacticHome ? 'Galactic Trust nonbank financial app, production-gated banking, fast dashboard actions, interactive trend, command navigation, mobile/VR handling and visible trust boundaries' : 'branded property-collectible home'} plus high-fidelity voxel geometry and current trust surfaces remain aligned.`);
await import('./test-public-surface-coherence.mjs');