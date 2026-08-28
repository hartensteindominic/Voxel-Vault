import fs from 'node:fs';
import assert from 'node:assert/strict';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`${label}: missing required safety marker: ${text}`);
}

const status = read('app/api/property-platform/status/route.ts');
const launch = read('lib/real-estate/legal-launch.js');
const launchPage = read('app/real-estate/launch/page.js');
const deploy = read('scripts/deploy-property-pilot.js');
const token = read('contracts/PropertyInterestToken.sol');
const passport = read('contracts/PropertyPassport.sol');
const distribution = read('contracts/PropertyDistributionVault.sol');
const root = read('app/page.js');
const home = read('app/real-estate/page.js');
const vault = read('app/real-estate/property/[propertyId]/page.js');
const invest = read('app/real-estate/invest/page.js');
const wallet = read('app/real-estate/invest/AutoCompoundWallet.js');
const legalPlan = read('docs/LEGAL_LAUNCH_PLAN.md');
const launchPacket = read('docs/REGULATED_LAUNCH_PACKET.md');
const dataRoom = read('docs/LEGAL_REVIEW_DATA_ROOM.md');

function loadLaunchPolicyForTest(source) {
  const executable = source
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ');
  return Function(`${executable}\nreturn { evaluateLegalLaunch, launchGateDefinitions, officialRegulatoryReferences, legalReadinessWorkstreams, regulatedLaunchPacket, partnerDiligenceChecklist, reviewReadyWorkItems };`)();
}

requireText(launch, 'LIVE_INVESTMENT_IMPLEMENTATION_READY = false', 'legal launch engine');
requireText(launch, 'LIVE_AUTO_REINVESTMENT_IMPLEMENTATION_READY = false', 'legal launch engine');
requireText(launch, 'REAL_ESTATE_REGISTERED_INTERMEDIARY_ACTIVE', 'legal launch engine');
requireText(launch, 'REAL_ESTATE_OFFERING_AUTHORIZED', 'legal launch engine');
requireText(launch, 'REAL_ESTATE_ESCROW_SETTLEMENT_CONFIGURED', 'legal launch engine');
requireText(launch, 'REAL_ESTATE_PROVIDER_INTEGRATION_VERIFIED', 'legal launch engine');
requireText(launch, 'Regulation Crowdfunding through a registered intermediary', 'legal launch engine');
requireText(launch, 'officialRegulatoryReferences', 'legal launch engine');
requireText(launch, 'productionDecisionAuthorities', 'legal launch engine');
requireText(launch, 'regulatedLaunchPacket', 'legal launch engine');
requireText(launch, 'partnerDiligenceChecklist', 'legal launch engine');
requireText(launch, 'reviewReadyWorkItems', 'legal launch engine');
requireText(launch, 'Funding portals we regulate', 'legal launch engine');
requireText(launch, 'founder-provider-review-needed', 'legal launch engine');
requireText(launch, 'Accept investor funds directly into Voxel Vault-controlled accounts.', 'legal launch engine');
requireText(launch, 'New York-facing virtual-currency activity', 'legal launch engine');
requireText(launch, 'environmentVariablesAreNotAuthority: true', 'legal launch engine');
requireText(status, 'liveInvestmentCheckout: false', 'property status route');
requireText(status, 'liveAutomaticReinvestment: false', 'property status route');
requireText(status, 'mainnetPropertyTokenDeployment: false', 'property status route');
requireText(status, 'evaluateLegalLaunch(process.env)', 'property status route');
requireText(status, 'legalReadiness', 'property status route');
requireText(status, 'officialReferences', 'property status route');
requireText(status, 'regulatedLaunchPacket', 'property status route');
requireText(status, 'partnerDiligenceChecklist', 'property status route');
requireText(status, 'reviewReadyWorkItems', 'property status route');
requireText(deploy, 'network.chainId !== 84532n', 'property deploy script');
requireText(deploy, 'Base Sepolia only', 'property deploy script');
requireText(deploy, 'PROPERTY_PASSPORT_ADDRESS', 'property deploy script');
requireText(deploy, 'Property Passport is NOT minted at deployment', 'property deploy script');
requireText(token, 'mapping(address account => bool allowed) public isAllowed', 'interest token');
requireText(token, 'RecipientNotAllowed', 'interest token');
requireText(passport, 'NOT the deed and NOT the investment security', 'property passport');
requireText(passport, 'PropertyNotVerified', 'property passport');
requireText(passport, 'PassportNonTransferable', 'property passport');
requireText(passport, 'propertyRegistry.getProperty(propertyId)', 'property passport');
requireText(distribution, 'ClaimantNotAllowed', 'distribution vault');
requireText(distribution, 'interestToken.isAllowed(msg.sender)', 'distribution vault');
requireText(distribution, 'InvalidStatementHash', 'distribution vault');
requireText(root, "import RealEstatePlatformPage from './real-estate/page'", 'root homepage');
requireText(home, 'Demo data only', 'property homepage');
requireText(home, 'Live investing is locked', 'property homepage');
requireText(home, '/real-estate/property/', 'property homepage');
requireText(vault, 'No investment checkout', 'property vault');
requireText(vault, 'No deed transfer occurs on-chain', 'property vault');
requireText(vault, 'Public hashes, private source documents', 'property vault');
requireText(invest, '/real-estate/launch', 'investment wallet page');
requireText(invest, 'registered intermediary', 'investment wallet page');
requireText(wallet, 'LIVE INVEST · LOCKED', 'auto-compound wallet');
requireText(wallet, 'LIVE AUTO-REINVEST · LOCKED', 'auto-compound wallet');
requireText(wallet, 'Confirm each', 'auto-compound wallet');
requireText(launchPage, 'Regulation Crowdfunding + registered partner', 'legal launch page');
requireText(launchPage, 'REAL-MONEY EXECUTION · LOCKED', 'legal launch page');
requireText(launchPage, 'One real property. One real closing. One reconciled rent distribution.', 'legal launch page');
requireText(launchPage, 'FOUNDER + CODEX WORKROOM', 'legal launch page');
requireText(launchPage, 'REGULATED LAUNCH PACKET', 'legal launch page');
requireText(launchPage, 'REVIEW-READY GITHUB QUEUE', 'legal launch page');
requireText(launchPage, 'MONEY MOVEMENT ·', 'legal launch page');
requireText(launchPage, 'Build around primary sources.', 'legal launch page');
requireText(legalPlan, 'Shared Founder + Codex workroom', 'legal launch plan');
requireText(legalPlan, 'Regulated Launch Packet', 'legal launch plan');
requireText(legalPlan, 'Legal Review Data Room', 'legal launch plan');
requireText(legalPlan, 'SEC Regulation Crowdfunding', 'legal launch plan');
requireText(legalPlan, 'New York DFS Virtual Currency Business Activity', 'legal launch plan');
requireText(launchPacket, 'Voxel Vault is not currently:', 'regulated launch packet');
requireText(launchPacket, 'registered broker-dealer', 'regulated launch packet');
requireText(launchPacket, 'First outreach note', 'regulated launch packet');
requireText(launchPacket, 'Environment variables, admin toggles, screenshots or founder approval do not satisfy legal authority by themselves.', 'regulated launch packet');
requireText(dataRoom, 'Do not commit private legal, identity, banking, tenant, title, wallet-key, tax or property documents', 'legal review data room');
requireText(dataRoom, 'Launch gate mapping', 'legal review data room');
requireText(dataRoom, 'Public-safe implementation pattern', 'legal review data room');

const {
  evaluateLegalLaunch,
  launchGateDefinitions,
  officialRegulatoryReferences,
  legalReadinessWorkstreams,
  regulatedLaunchPacket,
  partnerDiligenceChecklist,
  reviewReadyWorkItems,
} = loadLaunchPolicyForTest(launch);

const allExternalGatesTrueEnv = Object.fromEntries(
  launchGateDefinitions.map(([, envKey]) => [envKey, 'true'])
);
allExternalGatesTrueEnv.REAL_ESTATE_LIVE_INVESTING_ENABLED = 'true';
allExternalGatesTrueEnv.REAL_ESTATE_LIVE_AUTO_REINVESTMENT_ENABLED = 'true';

const evaluatedLaunch = evaluateLegalLaunch(allExternalGatesTrueEnv);
assert.equal(evaluatedLaunch.allExternalGatesSatisfied, true, 'test env should satisfy every external gate');
assert.equal(evaluatedLaunch.liveInvestingEnabled, false, 'implementation constant must keep live investing fail-closed');
assert.equal(evaluatedLaunch.liveAutomaticReinvestmentEnabled, false, 'implementation constant must keep auto-reinvestment fail-closed');
assert.equal(evaluatedLaunch.environmentVariablesAreNotAuthority, true, 'env vars are evidence inputs, not legal authority');
assert.equal(evaluatedLaunch.officialRegulatoryReferences, officialRegulatoryReferences, 'policy should return the shared official references');
assert.equal(evaluatedLaunch.legalReadinessWorkstreams, legalReadinessWorkstreams, 'policy should return the shared workstreams');
assert.equal(evaluatedLaunch.regulatedLaunchPacket, regulatedLaunchPacket, 'policy should return the regulated launch packet');
assert.equal(evaluatedLaunch.partnerDiligenceChecklist, partnerDiligenceChecklist, 'policy should return the partner diligence checklist');
assert.equal(evaluatedLaunch.reviewReadyWorkItems, reviewReadyWorkItems, 'policy should return the GitHub work queue');
assert.ok(officialRegulatoryReferences.length >= 6, 'official regulatory references should stay visible');
assert.ok(legalReadinessWorkstreams.length >= 6, 'shared workstreams should stay visible');
assert.ok(partnerDiligenceChecklist.length >= 6, 'partner diligence checklist should stay visible');
assert.ok(reviewReadyWorkItems.length >= 6, 'GitHub work queue should stay visible');
assert.equal(regulatedLaunchPacket.liveMoneyMovement, 'blocked', 'money movement must remain blocked');
assert.equal(regulatedLaunchPacket.liveOwnershipMinting, 'blocked', 'ownership minting must remain blocked');
assert.ok(regulatedLaunchPacket.reviewDocuments.some((doc) => doc.path === 'docs/REGULATED_LAUNCH_PACKET.md'), 'launch packet doc should be listed for review');

console.log('Property-platform safety checks passed: regulated launch gates are explicit, the verified Property Passport cannot be used as a transferable deed proxy, live investing and auto-reinvestment remain fail-closed, distribution claims remain permissioned, and property deployment is Base Sepolia-only.');
