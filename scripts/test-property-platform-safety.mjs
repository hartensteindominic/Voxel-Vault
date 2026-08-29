import fs from 'node:fs';
import assert from 'node:assert/strict';

function read(path) { return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'); }
function requireText(source, text, label) { if (!source.includes(text)) throw new Error(`${label}: missing required safety marker: ${text}`); }
function requireMarkers(source, label, required) { for (const marker of required) requireText(source, marker, label); }

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
  const executable = source.replace(/export const /g, 'const ').replace(/export function /g, 'function ');
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

requireMarkers(deploy, 'property deploy script', ['network.chainId !== 84532n', 'Base Sepolia only', 'PROPERTY_PASSPORT_ADDRESS', 'Property Passport is NOT minted at deployment']);
requireMarkers(token, 'interest token', ['mapping(address account => bool allowed) public isAllowed', 'RecipientNotAllowed']);
requireMarkers(passport, 'property passport', ['NOT the deed and NOT the investment security', 'PropertyNotVerified', 'PassportNonTransferable', 'propertyRegistry.getProperty(propertyId)']);
requireMarkers(distribution, 'distribution vault', ['ClaimantNotAllowed', 'interestToken.isAllowed(msg.sender)', 'InvalidStatementHash']);

requireMarkers(root, 'simple root homepage', [
  'START → SIGN IN + UPLOAD PHOTO',
  'Nothing is uploaded, generated, or charged before sign-in.',
  'After an authorized photo is chosen, $4.99 buys one digital VoxelPop creation',
  'Real-property investment or purchase controls only activate when a verified provider/offering and required legal path exist.',
  'A 3D model, payment, map marker, Property Passport, or NFT is not a deed',
  'href="/more"',
]);
requireMarkers(productMap, 'advanced product directory', [
  "href: '/real-estate/reits'",
  'Browse provider-backed real-estate securities and sandbox/live states.',
  'Live execution stays provider- and eligibility-gated.',
  "href: '/real-estate/acquire'",
  "href: '/vault/properties/claim'",
]);
requireMarkers(home, 'property homepage', [
  'LIVE DIGITAL', 'DEMO', 'PARTNER REQUIRED', 'TITLE REQUIRED',
  'Map ≠ collectible ≠ investment ≠ deed',
  'Voxel Vault is not itself a bank, broker, exchange, custodian, escrow service, or deed registry.',
  '/real-estate/reits', '/real-estate/acquire',
]);
requireMarkers(vault, 'property vault', ['PROPERTY_RIGHT_TYPES.REFERENCE_ONLY', 'geometry not yet verified', 'No deed transfer occurs on-chain', 'Public hashes, private source documents']);
requireMarkers(invest, 'investment wallet page', ['/real-estate/launch', 'registered intermediary']);
requireMarkers(wallet, 'auto-compound wallet', ['LIVE INVEST · LOCKED', 'LIVE AUTO-REINVEST · LOCKED', 'Confirm each']);
requireMarkers(launchPage, 'legal launch page', ['Regulation Crowdfunding + registered partner', 'REAL-MONEY EXECUTION · LOCKED', 'One real property. One real closing. One reconciled rent distribution.', 'FOUNDER + CODEX WORKROOM', 'REGULATED LAUNCH PACKET', 'REVIEW-READY GITHUB QUEUE', 'AUTHORITY EVIDENCE REGISTER', 'LEGAL STATUS · NOT CLEARED', 'EVIDENCE VERIFIER · NOT CONNECTED', 'MONEY MOVEMENT ·', 'Build around primary sources.']);
requireMarkers(legalPlan, 'legal launch plan', ['Shared Founder + Codex workroom', 'Regulated Launch Packet', 'Legal Review Data Room', 'Legal Approval Evidence Specification', 'SEC Regulation Crowdfunding', 'New York DFS Virtual Currency Business Activity']);
requireMarkers(launchPacket, 'regulated launch packet', ['Voxel Vault is not currently:', 'registered broker-dealer', 'First outreach note', 'Environment variables, admin toggles, screenshots or founder approval do not satisfy legal authority by themselves.']);
requireMarkers(dataRoom, 'legal review data room', ['Do not commit private legal, identity, banking, tenant, title, wallet-key, tax or property documents', 'Launch gate mapping', 'Public-safe implementation pattern', 'publicTermsDisclosuresApproved']);
requireMarkers(evidenceSpec, 'legal approval evidence spec', ['No repository commit, founder decision, admin toggle, screenshot or environment variable can make an offering legal.', 'asserted-unverified', 'Production activation boundary', 'The current repository deliberately cannot satisfy this formula.']);

const { evaluateLegalLaunch, launchGateDefinitions, legalEvidenceRecordFields, legalEvidenceRequirements, officialRegulatoryReferences, legalReadinessWorkstreams, regulatedLaunchPacket, partnerDiligenceChecklist, reviewReadyWorkItems } = loadLaunchPolicyForTest(launch);
const allExternalGatesTrueEnv = Object.fromEntries(launchGateDefinitions.map(([, envKey]) => [envKey, 'true']));
allExternalGatesTrueEnv.REAL_ESTATE_LIVE_INVESTING_ENABLED = 'true';
allExternalGatesTrueEnv.REAL_ESTATE_LIVE_AUTO_REINVESTMENT_ENABLED = 'true';
const evaluatedLaunch = evaluateLegalLaunch(allExternalGatesTrueEnv);

assert.equal(evaluatedLaunch.allExternalGatesAsserted, true);
assert.equal(evaluatedLaunch.allExternalGatesSatisfied, false);
assert.equal(evaluatedLaunch.liveInvestingEnabled, false);
assert.equal(evaluatedLaunch.liveAutomaticReinvestmentEnabled, false);
assert.equal(evaluatedLaunch.environmentVariablesAreNotAuthority, true);
assert.equal(evaluatedLaunch.legalEvidenceVerifierImplementationReady, false);
assert.equal(evaluatedLaunch.unverifiedAssertions.length, launchGateDefinitions.length);
assert.ok(Object.values(evaluatedLaunch.gates).every((passed) => passed === false));
assert.ok(evaluatedLaunch.legalEvidenceRegister.every((record) => record.launchSatisfied === false));
assert.ok(evaluatedLaunch.legalEvidenceRegister.every((record) => record.authorityEvidenceStatus === 'not-connected'));
assert.ok(evaluatedLaunch.activationBlockers.includes('legal-evidence-verifier-not-implemented'));
assert.ok(evaluatedLaunch.activationBlockers.includes('authority-evidence-not-verified'));
assert.equal(evaluatedLaunch.readinessSummary.legalClearanceClaimed, false);
assert.equal(evaluatedLaunch.readinessSummary.verifiedGateCount, 0);
assert.equal(evaluatedLaunch.readinessSummary.canAcceptInvestorFunds, false);
assert.equal(evaluatedLaunch.readinessSummary.canIssueEconomicInterests, false);
assert.equal(evaluatedLaunch.legalEvidenceRecordFields, legalEvidenceRecordFields);
assert.equal(evaluatedLaunch.legalEvidenceRequirements, legalEvidenceRequirements);
assert.equal(evaluatedLaunch.officialRegulatoryReferences, officialRegulatoryReferences);
assert.equal(evaluatedLaunch.legalReadinessWorkstreams, legalReadinessWorkstreams);
assert.equal(evaluatedLaunch.regulatedLaunchPacket, regulatedLaunchPacket);
assert.equal(evaluatedLaunch.partnerDiligenceChecklist, partnerDiligenceChecklist);
assert.equal(evaluatedLaunch.reviewReadyWorkItems, reviewReadyWorkItems);
assert.ok(officialRegulatoryReferences.length >= 6);
assert.ok(legalReadinessWorkstreams.length >= 6);
assert.ok(partnerDiligenceChecklist.length >= 6);
assert.ok(reviewReadyWorkItems.length >= 6);
assert.ok(legalEvidenceRecordFields.includes('documentSha256'));
assert.ok(legalEvidenceRequirements.length >= 16);
assert.equal(regulatedLaunchPacket.liveMoneyMovement, 'blocked');
assert.equal(regulatedLaunchPacket.liveOwnershipMinting, 'blocked');
assert.ok(regulatedLaunchPacket.reviewDocuments.some((doc) => doc.path === 'docs/REGULATED_LAUNCH_PACKET.md'));

console.log('Property-platform safety checks passed: the sign-in-first paid digital home stays fail-closed, provider-backed investment routes remain discoverable, authority evidence cannot be faked by env flags, direct-property investing and auto-reinvestment remain locked, and property deployment remains Base Sepolia-only.');
