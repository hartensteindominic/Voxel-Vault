import fs from 'node:fs';
import assert from 'node:assert/strict';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`${label}: missing required safety marker: ${text}`);
}

function requireMarkers(source, label, required) {
  for (const marker of required) requireText(source, marker, label);
}

const status = read('app/api/property-platform/status/route.ts');
const launch = read('lib/real-estate/legal-launch.js');
const launchPage = read('app/real-estate/launch/page.js');
const deploy = read('scripts/deploy-property-pilot.js');
const token = read('contracts/PropertyInterestToken.sol');
const passport = read('contracts/PropertyPassport.sol');
const distribution = read('contracts/PropertyDistributionVault.sol');
const root = read('app/page.js');
const productMap = read('lib/product-map.js');
const home = read('app/real-estate/page.js');
const vault = read('app/real-estate/property/[propertyId]/page.js');
const invest = read('app/real-estate/invest/page.js');
const wallet = read('app/real-estate/invest/AutoCompoundWallet.js');
const legalPlan = read('docs/LEGAL_LAUNCH_PLAN.md');
const launchPacket = read('docs/REGULATED_LAUNCH_PACKET.md');
const dataRoom = read('docs/LEGAL_REVIEW_DATA_ROOM.md');
const evidenceSpec = read('docs/LEGAL_APPROVAL_EVIDENCE_SPEC.md');

function loadLaunchPolicyForTest(source) {
  const executable = source
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ');
  return Function(`${executable}\nreturn { evaluateLegalLaunch, launchGateDefinitions, legalEvidenceRecordFields, legalEvidenceRequirements, officialRegulatoryReferences, legalReadinessWorkstreams, regulatedLaunchPacket, partnerDiligenceChecklist, reviewReadyWorkItems };`)();
}

requireMarkers(launch, 'legal launch engine', [
  'LIVE_INVESTMENT_IMPLEMENTATION_READY = false',
  'LIVE_AUTO_REINVESTMENT_IMPLEMENTATION_READY = false',
  'LEGAL_EVIDENCE_VERIFIER_IMPLEMENTATION_READY = false',
  'REAL_ESTATE_REGISTERED_INTERMEDIARY_ACTIVE',
  'REAL_ESTATE_OFFERING_AUTHORIZED',
  'REAL_ESTATE_ESCROW_SETTLEMENT_CONFIGURED',
  'REAL_ESTATE_PROVIDER_INTEGRATION_VERIFIED',
  'REAL_ESTATE_PUBLIC_TERMS_DISCLOSURES_APPROVED',
  'Regulation Crowdfunding through a registered intermediary',
  'officialRegulatoryReferences',
  'productionDecisionAuthorities',
  'regulatedLaunchPacket',
  'partnerDiligenceChecklist',
  'reviewReadyWorkItems',
  'Funding portals we regulate',
  'founder-provider-review-needed',
  'Accept investor funds directly into Voxel Vault-controlled accounts.',
  'New York-facing virtual-currency activity',
  'environmentVariablesAreNotAuthority: true',
  'asserted-unverified',
  'authority-evidence-not-verified',
]);

requireMarkers(status, 'property status route', [
  'liveSecuritiesImplementationReady = DINARI_LIVE_TRADING_IMPLEMENTATION_READY === true',
  'liveSecuritiesProviderActivated = dinari.productionTradingEnabled === true',
  'liveInvestmentCheckout: liveSecuritiesProviderActivated',
  'liveDigitalReitTradingImplementationReady: liveSecuritiesImplementationReady',
  'liveDigitalReitTrading: liveSecuritiesProviderActivated',
  'directSpecificProperty',
  'providerActivated: directPropertyInvestingActivated',
  'automatedAcquisitionEnabled: false',
  'pooledPublicInvestingEnabled: false',
  'automatedLiveAcquisition: false',
  'liveAutomaticReinvestment: false',
  'pooledPublicRentInvesting: false',
  'mainnetPropertyTokenDeployment: false',
  'evaluateLegalLaunch(process.env)',
  'legalReadiness',
  'officialReferences',
  'regulatedLaunchPacket',
  'partnerDiligenceChecklist',
  'reviewReadyWorkItems',
  'gateAssertions',
  'allExternalGatesAsserted',
  'evidenceVerifierImplementationReady',
  'evidenceRegister',
  'authorityEvidenceVerification: false',
]);

requireMarkers(deploy, 'property deploy script', [
  'network.chainId !== 84532n',
  'Base Sepolia only',
  'PROPERTY_PASSPORT_ADDRESS',
  'Property Passport is NOT minted at deployment',
]);
requireMarkers(token, 'interest token', [
  'mapping(address account => bool allowed) public isAllowed',
  'RecipientNotAllowed',
]);
requireMarkers(passport, 'property passport', [
  'NOT the deed and NOT the investment security',
  'PropertyNotVerified',
  'PassportNonTransferable',
  'propertyRegistry.getProperty(propertyId)',
]);
requireMarkers(distribution, 'distribution vault', [
  'ClaimantNotAllowed',
  'interestToken.isAllowed(msg.sender)',
  'InvalidStatementHash',
]);

// The public root is intentionally focused on the shipping property-voxel product.
// Regulated property/investment disclosures belong on their advanced surfaces,
// while the front door must still preserve optional minting and the digital-only
// physical-property rights boundary.
requireMarkers(root, 'simple root homepage', [
  'PROPERTY → COLLECTIBLE',
  'Create a property voxel',
  'confirm the address',
  'saved to Inventory first',
  'Mint if you want',
  'This collectible is digital only.',
  'does not create or transfer deed, title',
]);
assert.doesNotMatch(root, /Create mine · \$4\.99|Create · \$4\.99/, 'the live property creator must not reintroduce the legacy checkout CTA');
requireMarkers(productMap, 'advanced product directory', [
  "href: '/real-estate/reits'",
  'Provider-backed securities may appear only when an approved provider, offering and eligibility path are actually active.',
  "href: '/real-estate/acquire'",
  'A token or VoxelPop item is never the deed.',
  "href: '/vault/properties/claim'",
]);

requireMarkers(home, 'property homepage', [
  'Demo data only',
  'Live investing is locked',
  '/real-estate/property/',
]);
requireMarkers(vault, 'property vault', [
  'PROPERTY_RIGHT_TYPES.REFERENCE_ONLY',
  'geometry not yet verified',
  'No deed transfer occurs on-chain',
  'Public hashes, private source documents',
]);
requireMarkers(invest, 'investment wallet page', [
  '/real-estate/launch',
  'registered intermediary',
]);
requireMarkers(wallet, 'auto-compound wallet', [
  'LIVE INVEST · LOCKED',
  'LIVE AUTO-REINVEST · LOCKED',
  'Confirm each',
]);
requireMarkers(launchPage, 'legal launch page', [
  'Regulation Crowdfunding + registered partner',
  'REAL-MONEY EXECUTION · LOCKED',
  'One real property. One real closing. One reconciled rent distribution.',
  'FOUNDER + CODEX WORKROOM',
  'REGULATED LAUNCH PACKET',
  'REVIEW-READY GITHUB QUEUE',
  'AUTHORITY EVIDENCE REGISTER',
  'LEGAL STATUS · NOT CLEARED',
  'EVIDENCE VERIFIER · NOT CONNECTED',
  'MONEY MOVEMENT ·',
  'Build around primary sources.',
]);
requireMarkers(legalPlan, 'legal launch plan', [
  'Shared Founder + Codex workroom',
  'Regulated Launch Packet',
  'Legal Review Data Room',
  'Legal Approval Evidence Specification',
  'SEC Regulation Crowdfunding',
  'New York DFS Virtual Currency Business Activity',
]);
requireMarkers(launchPacket, 'regulated launch packet', [
  'Voxel Vault is not currently:',
  'registered broker-dealer',
  'First outreach note',
  'Environment variables, admin toggles, screenshots or founder approval do not satisfy legal authority by themselves.',
]);
requireMarkers(dataRoom, 'legal review data room', [
  'Do not commit private legal, identity, banking, tenant, title, wallet-key, tax or property documents',
  'Launch gate mapping',
  'Public-safe implementation pattern',
  'publicTermsDisclosuresApproved',
]);
requireMarkers(evidenceSpec, 'legal approval evidence spec', [
  'No repository commit, founder decision, admin toggle, screenshot or environment variable can make an offering legal.',
  'asserted-unverified',
  'Production activation boundary',
  'The current repository deliberately cannot satisfy this formula.',
]);

const {
  evaluateLegalLaunch,
  launchGateDefinitions,
  legalEvidenceRecordFields,
  legalEvidenceRequirements,
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
assert.equal(evaluatedLaunch.allExternalGatesAsserted, true, 'test env should assert every external gate');
assert.equal(evaluatedLaunch.allExternalGatesSatisfied, false, 'environment assertions must not satisfy authority evidence gates');
assert.equal(evaluatedLaunch.liveInvestingEnabled, false, 'implementation constant must keep direct-property live investing fail-closed');
assert.equal(evaluatedLaunch.liveAutomaticReinvestmentEnabled, false, 'implementation constant must keep auto-reinvestment fail-closed');
assert.equal(evaluatedLaunch.environmentVariablesAreNotAuthority, true, 'env vars are evidence inputs, not legal authority');
assert.equal(evaluatedLaunch.legalEvidenceVerifierImplementationReady, false, 'authority evidence verifier must remain code-locked');
assert.equal(evaluatedLaunch.unverifiedAssertions.length, launchGateDefinitions.length, 'every true env flag should remain an unverified assertion');
assert.ok(Object.values(evaluatedLaunch.gates).every((passed) => passed === false), 'no environment assertion may satisfy a launch gate');
assert.ok(evaluatedLaunch.legalEvidenceRegister.every((record) => record.launchSatisfied === false), 'evidence register must remain unsatisfied without a verifier');
assert.ok(evaluatedLaunch.legalEvidenceRegister.every((record) => record.authorityEvidenceStatus === 'not-connected'), 'authority evidence must report the disconnected verifier');
assert.ok(evaluatedLaunch.activationBlockers.includes('legal-evidence-verifier-not-implemented'), 'activation blockers should expose missing evidence verifier');
assert.ok(evaluatedLaunch.activationBlockers.includes('authority-evidence-not-verified'), 'activation blockers should expose unverified authority evidence');
assert.equal(evaluatedLaunch.readinessSummary.legalClearanceClaimed, false, 'status must never claim legal clearance');
assert.equal(evaluatedLaunch.readinessSummary.verifiedGateCount, 0, 'no authority gates should be reported verified');
assert.equal(evaluatedLaunch.readinessSummary.canAcceptInvestorFunds, false, 'direct-property investor funds must remain blocked');
assert.equal(evaluatedLaunch.readinessSummary.canIssueEconomicInterests, false, 'direct-property economic-interest issuance must remain blocked');
assert.equal(evaluatedLaunch.legalEvidenceRecordFields, legalEvidenceRecordFields, 'policy should return shared evidence record fields');
assert.equal(evaluatedLaunch.legalEvidenceRequirements, legalEvidenceRequirements, 'policy should return shared evidence requirements');
assert.equal(evaluatedLaunch.officialRegulatoryReferences, officialRegulatoryReferences, 'policy should return the shared official references');
assert.equal(evaluatedLaunch.legalReadinessWorkstreams, legalReadinessWorkstreams, 'policy should return the shared workstreams');
assert.equal(evaluatedLaunch.regulatedLaunchPacket, regulatedLaunchPacket, 'policy should return the regulated launch packet');
assert.equal(evaluatedLaunch.partnerDiligenceChecklist, partnerDiligenceChecklist, 'policy should return the partner diligence checklist');
assert.equal(evaluatedLaunch.reviewReadyWorkItems, reviewReadyWorkItems, 'policy should return the GitHub work queue');
assert.ok(officialRegulatoryReferences.length >= 6, 'official regulatory references should stay visible');
assert.ok(legalReadinessWorkstreams.length >= 6, 'shared workstreams should stay visible');
assert.ok(partnerDiligenceChecklist.length >= 6, 'partner diligence checklist should stay visible');
assert.ok(reviewReadyWorkItems.length >= 6, 'GitHub work queue should stay visible');
assert.ok(legalEvidenceRecordFields.includes('documentSha256'), 'evidence records should require a public-safe document digest');
assert.ok(legalEvidenceRequirements.length >= 16, 'every regulated workstream should have an authority evidence gate');
assert.equal(regulatedLaunchPacket.liveMoneyMovement, 'blocked', 'direct-property money movement must remain blocked');
assert.equal(regulatedLaunchPacket.liveOwnershipMinting, 'blocked', 'direct-property ownership minting must remain blocked');
assert.ok(regulatedLaunchPacket.reviewDocuments.some((doc) => doc.path === 'docs/REGULATED_LAUNCH_PACKET.md'), 'launch packet doc should be listed for review');

console.log('Property-platform safety checks passed: the live photo → confirmed address → voxel image → movable 3D voxel → Inventory → optional mint flow remains separate from regulated rails; provider-backed investment routes remain gated, legal clearance is never claimed, Property Passport cannot act as a transferable deed proxy, direct-property investing and auto-reinvestment remain fail-closed, and property deployment remains Base Sepolia-only.');
