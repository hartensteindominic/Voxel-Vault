export const LEGAL_LAUNCH_POLICY_VERSION = '2026-08-authority-evidence-v2';

// These constants can only change in a reviewed release after the corresponding
// production integrations actually exist. Environment variables are evidence
// inputs, never authority to make the implementation live by themselves.
export const LIVE_INVESTMENT_IMPLEMENTATION_READY = false;
export const LIVE_AUTO_REINVESTMENT_IMPLEMENTATION_READY = false;
export const LEGAL_EVIDENCE_VERIFIER_IMPLEMENTATION_READY = false;

export const legalEvidenceRecordFields = [
  'gateId',
  'decision',
  'authorityRole',
  'reviewedAt',
  'nextReviewAt',
  'scope',
  'jurisdictions',
  'controlledRecordId',
  'documentSha256',
  'registryReference',
  'revokedAt',
];

export const legalEvidenceRequirements = [
  {
    gate: 'registeredIntermediaryAgreementActive',
    label: 'Registered intermediary agreement',
    assertionEnvKey: 'REAL_ESTATE_REGISTERED_INTERMEDIARY_ACTIVE',
    authority: 'SEC/FINRA-registered intermediary + securities counsel',
    requiredEvidence: ['Official registration record', 'Executed agreement', 'Written regulated-services scope'],
  },
  {
    gate: 'offeringAuthorizationApproved',
    label: 'Offering authorization',
    assertionEnvKey: 'REAL_ESTATE_OFFERING_AUTHORIZED',
    authority: 'Securities counsel + registered intermediary',
    requiredEvidence: ['Approved exemption path', 'Required filing record', 'Approved disclosures and marketing controls'],
  },
  {
    gate: 'securitiesCounselApproved',
    label: 'Securities counsel approval',
    assertionEnvKey: 'REAL_ESTATE_SECURITIES_COUNSEL_APPROVED',
    authority: 'Licensed securities counsel',
    requiredEvidence: ['Written structure approval', 'Token-rights analysis', 'Investor-flow and communications approval'],
  },
  {
    gate: 'titleCounselApproved',
    label: 'Property and title approval',
    assertionEnvKey: 'REAL_ESTATE_TITLE_COUNSEL_APPROVED',
    authority: 'Property/title counsel + title company',
    requiredEvidence: ['Title review', 'Lien and parcel review', 'Approved property/entity linkage'],
  },
  {
    gate: 'issuerPropertyEntityVerified',
    label: 'Issuer and property entity',
    assertionEnvKey: 'REAL_ESTATE_ISSUER_ENTITY_VERIFIED',
    authority: 'Issuer counsel + property/title counsel',
    requiredEvidence: ['Entity good-standing record', 'Operating agreement and authority', 'Capitalization and property-control evidence'],
  },
  {
    gate: 'kycAmlInvestorEligibilityConfigured',
    label: 'Investor identity and eligibility',
    assertionEnvKey: 'REAL_ESTATE_KYC_AML_CONFIGURED',
    authority: 'Registered intermediary + approved identity/compliance provider',
    requiredEvidence: ['KYC/AML and sanctions workflow', 'Investor-limit or accreditation workflow', 'Jurisdiction eligibility rules'],
  },
  {
    gate: 'escrowSettlementConfigured',
    label: 'Escrow and settlement',
    assertionEnvKey: 'REAL_ESTATE_ESCROW_SETTLEMENT_CONFIGURED',
    authority: 'Registered intermediary + escrow/payment provider',
    requiredEvidence: ['Executed escrow arrangement', 'Closing and refund rules', 'Provider-authoritative settlement states'],
  },
  {
    gate: 'custodyRailsConfigured',
    label: 'Custody and wallet rails',
    assertionEnvKey: 'REAL_ESTATE_CUSTODY_RAILS_CONFIGURED',
    authority: 'Counsel + approved custody/wallet provider',
    requiredEvidence: ['Approved custody model', 'Wallet-account binding rules', 'Key recovery and account-control procedures'],
  },
  {
    gate: 'capTableTransferControlsConfigured',
    label: 'Recordkeeping and transfer controls',
    assertionEnvKey: 'REAL_ESTATE_CAP_TABLE_TRANSFER_CONFIGURED',
    authority: 'Counsel + authoritative recordkeeper/transfer provider',
    requiredEvidence: ['Securityholder record authority', 'Transfer restrictions', 'Cap-table and on-chain reconciliation procedure'],
  },
  {
    gate: 'propertyAccountingConfigured',
    label: 'Property accounting',
    assertionEnvKey: 'REAL_ESTATE_PROPERTY_ACCOUNTING_CONFIGURED',
    authority: 'Property manager + approved accounting reviewer',
    requiredEvidence: ['Operating-account controls', 'Rent, expense and reserve policy', 'Distribution statement approval process'],
  },
  {
    gate: 'taxReportingConfigured',
    label: 'Tax reporting',
    assertionEnvKey: 'REAL_ESTATE_TAX_REPORTING_CONFIGURED',
    authority: 'Qualified tax counsel/accounting provider',
    requiredEvidence: ['Issuer tax treatment', 'Investor reporting workflow', 'Digital-asset recordkeeping procedure'],
  },
  {
    gate: 'smartContractsAudited',
    label: 'Smart-contract audit',
    assertionEnvKey: 'REAL_ESTATE_CONTRACTS_AUDITED',
    authority: 'Independent smart-contract/security reviewer',
    requiredEvidence: ['Final deployment-scope audit', 'Resolved findings', 'Reviewed production bytecode and authority controls'],
  },
  {
    gate: 'privacySecurityApproved',
    label: 'Privacy and security approval',
    assertionEnvKey: 'REAL_ESTATE_PRIVACY_SECURITY_APPROVED',
    authority: 'Privacy counsel + independent security reviewer',
    requiredEvidence: ['Data-flow and retention review', 'Access-control review', 'Approved privacy and security notices'],
  },
  {
    gate: 'publicTermsDisclosuresApproved',
    label: 'Terms, disclosures and communications',
    assertionEnvKey: 'REAL_ESTATE_PUBLIC_TERMS_DISCLOSURES_APPROVED',
    authority: 'Securities/privacy counsel + registered intermediary',
    requiredEvidence: ['Approved public terms', 'Approved risk disclosures', 'Approved marketing and investor communications'],
  },
  {
    gate: 'incidentResponseApproved',
    label: 'Incident and pause response',
    assertionEnvKey: 'REAL_ESTATE_INCIDENT_RESPONSE_APPROVED',
    authority: 'Provider owners + counsel + security reviewer',
    requiredEvidence: ['Pause authority map', 'Incident runbook', 'Investor support and notification procedure'],
  },
  {
    gate: 'providerIntegrationVerified',
    label: 'Provider integration verification',
    assertionEnvKey: 'REAL_ESTATE_PROVIDER_INTEGRATION_VERIFIED',
    authority: 'Registered intermediary + each production provider',
    requiredEvidence: ['End-to-end sandbox evidence', 'Signed webhook/reconciliation proof', 'Provider production acceptance'],
  },
];

export const launchGateDefinitions = legalEvidenceRequirements.map(
  ({ gate, assertionEnvKey }) => [gate, assertionEnvKey]
);

export const officialRegulatoryReferences = [
  {
    agency: 'SEC',
    name: 'Regulation Crowdfunding',
    url: 'https://www.sec.gov/resources-small-businesses/exempt-offerings/regulation-crowdfunding',
    productImpact: 'Retail-accessible securities offerings require issuer disclosures, investor limits and an SEC-registered intermediary.',
  },
  {
    agency: 'SEC',
    name: 'Reg CF issuer guidance',
    url: 'https://www.sec.gov/resources-small-businesses/small-business-compliance-guides/regulation-crowdfunding-guidance-issuers',
    productImpact: 'Offering documents, marketing, filing obligations and bad-actor checks need counsel/intermediary review before any capital raise.',
  },
  {
    agency: 'FINRA',
    name: 'Funding portal registration',
    url: 'https://www.finra.org/registration-exams-ce/funding-portals',
    productImpact: 'A funding portal must be SEC-registered and a FINRA member; Voxel Vault should integrate a qualified intermediary rather than act as one.',
  },
  {
    agency: 'FINRA',
    name: 'Funding portals we regulate',
    url: 'https://www.finra.org/about/entities-we-regulate/funding-portals-we-regulate',
    productImpact: 'Partner diligence should verify the intermediary on an official registry instead of relying on marketing claims.',
  },
  {
    agency: 'SEC',
    name: 'Digital asset investment-contract framework',
    url: 'https://www.sec.gov/files/dlt-framework.pdf',
    productImpact: 'A token tied to expected profit from real-estate operations can implicate securities analysis even when it uses blockchain rails.',
  },
  {
    agency: 'FinCEN',
    name: 'Convertible virtual currency guidance',
    url: 'https://www.fincen.gov/system/files/2019-05/FinCEN%20CVC%20Guidance%20FINAL.pdf',
    productImpact: 'Fiat, stablecoin, wallet, custody and transfer flows need MSB/BSA review before production money movement.',
  },
  {
    agency: 'NY DFS',
    name: 'Virtual Currency Business Activity',
    url: 'https://www.dfs.ny.gov/apps_and_licensing/virtual_currency_businesses',
    productImpact: 'New York-facing virtual-currency activity can require separate state licensing or an approved exemption path.',
  },
  {
    agency: 'IRS',
    name: 'Digital assets',
    url: 'https://www.irs.gov/filing/digital-assets',
    productImpact: 'Tax reporting, investor statements and digital-asset records must be designed before distributions or transfers are enabled.',
  },
];

export const productionDecisionAuthorities = [
  'Licensed securities counsel',
  'Property/title counsel and title company',
  'SEC/FINRA-registered intermediary or otherwise approved regulated partner',
  'KYC/AML, custody, payment/escrow and tax-reporting providers',
  'Independent smart-contract/security reviewer',
];

export const regulatedLaunchPacket = {
  status: 'founder-provider-review-needed',
  liveMoneyMovement: 'blocked',
  liveOwnershipMinting: 'blocked',
  immediateNextAction: 'Choose securities counsel and a registered intermediary candidate before building any production investment checkout.',
  reviewDocuments: [
    { name: 'Legal launch plan', path: 'docs/LEGAL_LAUNCH_PLAN.md' },
    { name: 'Regulated launch packet', path: 'docs/REGULATED_LAUNCH_PACKET.md' },
    { name: 'Legal review data room', path: 'docs/LEGAL_REVIEW_DATA_ROOM.md' },
    { name: 'Legal approval evidence specification', path: 'docs/LEGAL_APPROVAL_EVIDENCE_SPEC.md' },
  ],
  founderCanDoNow: [
    'Pick one first-property thesis and budget range.',
    'Contact licensed securities counsel about the first offering path.',
    'Shortlist SEC/FINRA-registered broker-dealer or funding portal candidates.',
    'Collect property, issuer, title, insurance and property-manager evidence for review.',
    'Approve only counsel-reviewed public copy about investing, rent or yield.',
  ],
  codexCanDoNow: [
    'Keep all regulated money movement fail-closed.',
    'Expose review state, missing evidence and provider requirements in the UI/API.',
    'Build sandbox-only provider adapters until a real provider contract exists.',
    'Separate non-economic Property Passport data from economic property-interest units.',
    'Preserve audit logs, reconciliation records and provider-authoritative state transitions.',
    'Treat environment flags as unverified assertions until authority evidence is independently verified.',
  ],
  prohibitedUntilApproved: [
    'Accept investor funds directly into Voxel Vault-controlled accounts.',
    'Market a token, NFT or Property Passport as a deed.',
    'Show pending payment as ownership.',
    'Offer automatic reinvestment without counsel/intermediary approval.',
    'Enable unrestricted peer-to-peer trading of property-interest tokens.',
    'Use a founder toggle, admin setting or environment variable as legal approval.',
  ],
};

export const partnerDiligenceChecklist = [
  {
    area: 'Registration and authority',
    owner: 'Founder + securities counsel',
    checks: [
      'Verify the intermediary on SEC/FINRA records before relying on it.',
      'Confirm whether the partner is a funding portal, broker-dealer, ATS, transfer agent, custody provider or a combination.',
      'Confirm which regulated functions the partner contractually performs and which remain Voxel Vault responsibilities.',
    ],
    evidence: ['Official registration links', 'Executed agreement', 'Written scope of regulated services'],
  },
  {
    area: 'Offering and issuer workflow',
    owner: 'Securities counsel + intermediary',
    checks: [
      'Confirm Reg CF, Reg D or Reg A path before writing production checkout code.',
      'Map Form C or other required filing/disclosure responsibilities.',
      'Confirm advertising, solicitation, cancellation, refund and resale restriction rules.',
    ],
    evidence: ['Counsel memo', 'Offering document checklist', 'Marketing review approval'],
  },
  {
    area: 'Investor onboarding',
    owner: 'Intermediary + KYC/AML provider',
    checks: [
      'Confirm identity, sanctions, investor-limit, accreditation and jurisdiction checks.',
      'Decide whether wallets bind to a verified provider account or provider custody account.',
      'Confirm privacy, retention, support and adverse-action procedures.',
    ],
    evidence: ['Provider workflow spec', 'Sandbox test account results', 'Privacy/security approval'],
  },
  {
    area: 'Funds, custody and settlement',
    owner: 'Escrow/payment/custody provider',
    checks: [
      'Confirm who is legally allowed to hold funds before closing.',
      'Confirm when funds are cleared, cancellable, refundable, failed or settled.',
      'Confirm how closing allocations become authoritative investment units.',
    ],
    evidence: ['Escrow agreement', 'Settlement webhook spec', 'Reconciliation report format'],
  },
  {
    area: 'Property, title and operations',
    owner: 'Property/title counsel + property manager',
    checks: [
      'Confirm deed, parcel, title, liens, insurance, issuer entity and operating agreement.',
      'Separate private title/tenant documents from public metadata and on-chain hashes.',
      'Confirm rent, expense, reserve and distribution accounting process.',
    ],
    evidence: ['Title packet', 'Issuer records', 'Insurance/property-manager records', 'Approved accounting statement'],
  },
  {
    area: 'Token and transfer controls',
    owner: 'Securities counsel + contract reviewer',
    checks: [
      'Confirm exactly what the token represents and what it does not represent.',
      'Confirm transfer restrictions, cap-table reconciliation and recordkeeping authority.',
      'Audit the smart contracts before any production deployment or mint authority.',
    ],
    evidence: ['Token-rights memo', 'Transfer rules', 'Contract audit', 'Cap-table reconciliation procedure'],
  },
];

export const reviewReadyWorkItems = [
  {
    issue: '#339',
    name: 'Offering path + intermediary',
    url: 'https://github.com/hartensteindominic/Voxel-Vault/issues/339',
    firstFounderAction: 'Ask counsel which exemption/intermediary path can fit the first property.',
    firstCodexAction: 'Keep production checkout blocked and prepare provider-neutral integration fields.',
  },
  {
    issue: '#340',
    name: 'Property issuer + title evidence',
    url: 'https://github.com/hartensteindominic/Voxel-Vault/issues/340',
    firstFounderAction: 'Choose one property candidate and collect title/entity diligence.',
    firstCodexAction: 'Model evidence states without exposing private property documents publicly.',
  },
  {
    issue: '#341',
    name: 'Investor onboarding + eligibility',
    url: 'https://github.com/hartensteindominic/Voxel-Vault/issues/341',
    firstFounderAction: 'Pick KYC/AML and investor eligibility provider candidates.',
    firstCodexAction: 'Build provider-confirmed onboarding state, never local self-approval.',
  },
  {
    issue: '#342',
    name: 'Funds, escrow, custody + settlement',
    url: 'https://github.com/hartensteindominic/Voxel-Vault/issues/342',
    firstFounderAction: 'Confirm who can hold money and issue refunds before closing.',
    firstCodexAction: 'Require provider-authoritative settled funds before ownership records.',
  },
  {
    issue: '#343',
    name: 'Token recordkeeping + transfer controls',
    url: 'https://github.com/hartensteindominic/Voxel-Vault/issues/343',
    firstFounderAction: 'Get counsel approval for token rights and transfer limits.',
    firstCodexAction: 'Keep economic tokens permissioned and separate from Property Passports.',
  },
  {
    issue: '#344',
    name: 'Rent distributions + reinvestment rules',
    url: 'https://github.com/hartensteindominic/Voxel-Vault/issues/344',
    firstFounderAction: 'Confirm accounting, reserves, tax records and reinvestment permissions.',
    firstCodexAction: 'Keep auto-reinvestment locked and build confirm-each/cash behavior first.',
  },
];

export const legalReadinessWorkstreams = [
  {
    name: 'Offering path',
    accountable: 'Securities counsel + registered intermediary',
    founderLane: 'Choose the first property/offering goal, collect business facts and approve only counsel-reviewed marketing.',
    codexLane: 'Keep investing disabled, document gates, expose provider status and prevent any client-side payment from creating ownership.',
    evidence: ['Counsel memo', 'Intermediary acceptance', 'Approved Form C or selected offering filing path', 'Marketing review record'],
  },
  {
    name: 'Property and issuer',
    accountable: 'Property/title counsel + title company',
    founderLane: 'Identify one real property, collect parcel/title/entity documents and confirm the operator/property manager.',
    codexLane: 'Store only public hashes/references on-chain and keep private title, lease, tenant and identity documents out of public metadata.',
    evidence: ['Title commitment/search', 'Issuer or property LLC records', 'Insurance confirmation', 'Property-management agreement'],
  },
  {
    name: 'Investor onboarding',
    accountable: 'Registered intermediary + KYC/AML provider',
    founderLane: 'Select the provider workflow and avoid accepting money outside the approved subscription path.',
    codexLane: 'Bind wallet/account state only to provider-confirmed identity, eligibility and subscription status.',
    evidence: ['KYC/AML/sanctions configuration', 'Investor-limit or accreditation workflow', 'Subscription document flow', 'Jurisdiction rules'],
  },
  {
    name: 'Funds, custody and settlement',
    accountable: 'Escrow/payment/custody provider + intermediary',
    founderLane: 'Select where investor funds legally sit before closing and who controls refunds/cancellations.',
    codexLane: 'Require provider-authoritative settled funds and closing allocations before minting or recording investment units.',
    evidence: ['Escrow agreement', 'Custody/on-ramp review', 'Settlement reconciliation', 'Refund/cancellation procedure'],
  },
  {
    name: 'Token recordkeeping',
    accountable: 'Securities counsel + transfer/cap-table provider',
    founderLane: 'Approve exactly what the token represents and whether transfers are allowed.',
    codexLane: 'Keep tokens permissioned, capped and separated from the non-economic Property Passport.',
    evidence: ['Executed operating/subscription rights map', 'Transfer restriction rules', 'Cap-table reconciliation plan', 'Audit-reviewed contracts'],
  },
  {
    name: 'Rent distributions',
    accountable: 'Property manager + accounting/tax provider',
    founderLane: 'Confirm rent, expenses, reserves and distributable net income before any investor statement.',
    codexLane: 'Distribute only from approved net-income statements and record-date/cap-table snapshots.',
    evidence: ['Property operating account records', 'Expense/reserve policy', 'Approved accounting statement', 'Tax-reporting workflow'],
  },
];

export function evaluateLegalLaunch(env = {}) {
  const gateAssertions = Object.fromEntries(
    launchGateDefinitions.map(([name, envKey]) => [name, env[envKey] === 'true'])
  );
  const legalEvidenceRegister = legalEvidenceRequirements.map((requirement) => {
    const asserted = gateAssertions[requirement.gate];

    return {
      gate: requirement.gate,
      label: requirement.label,
      authority: requirement.authority,
      assertionStatus: asserted ? 'asserted-unverified' : 'not-asserted',
      authorityEvidenceStatus: 'not-connected',
      launchSatisfied: false,
      requiredEvidence: requirement.requiredEvidence,
      reason: asserted
        ? 'An environment assertion exists, but no controlled authority evidence has been independently verified.'
        : 'No controlled authority evidence has been independently verified.',
    };
  });
  const gates = Object.fromEntries(
    legalEvidenceRegister.map(({ gate, launchSatisfied }) => [gate, launchSatisfied])
  );
  const missingAssertions = Object.entries(gateAssertions)
    .filter(([, asserted]) => !asserted)
    .map(([name]) => name);
  const unverifiedAssertions = Object.entries(gateAssertions)
    .filter(([, asserted]) => asserted)
    .map(([name]) => name);
  const missing = legalEvidenceRegister
    .filter(({ launchSatisfied }) => !launchSatisfied)
    .map(({ gate }) => gate);
  const allExternalGatesAsserted = missingAssertions.length === 0;
  const allExternalGatesSatisfied = missing.length === 0;
  const explicitLiveFlag = env.REAL_ESTATE_LIVE_INVESTING_ENABLED === 'true';
  const explicitAutoReinvestmentFlag = env.REAL_ESTATE_LIVE_AUTO_REINVESTMENT_ENABLED === 'true';

  const liveInvestingEnabled = Boolean(
    explicitLiveFlag &&
    allExternalGatesSatisfied &&
    LIVE_INVESTMENT_IMPLEMENTATION_READY
  );

  const liveAutomaticReinvestmentEnabled = Boolean(
    liveInvestingEnabled &&
    explicitAutoReinvestmentFlag &&
    LIVE_AUTO_REINVESTMENT_IMPLEMENTATION_READY
  );

  const activationBlockers = [
    !LEGAL_EVIDENCE_VERIFIER_IMPLEMENTATION_READY && 'legal-evidence-verifier-not-implemented',
    !allExternalGatesSatisfied && 'authority-evidence-not-verified',
    !LIVE_INVESTMENT_IMPLEMENTATION_READY && 'live-investment-integration-not-reviewed',
  ].filter(Boolean);

  return {
    policyVersion: LEGAL_LAUNCH_POLICY_VERSION,
    targetOfferingPath: 'Regulation Crowdfunding through a registered intermediary',
    gates,
    gateAssertions,
    missingAssertions,
    unverifiedAssertions,
    missing,
    allExternalGatesAsserted,
    allExternalGatesSatisfied,
    explicitLiveFlag,
    explicitAutoReinvestmentFlag,
    productionInvestmentImplementationReady: LIVE_INVESTMENT_IMPLEMENTATION_READY,
    productionAutoReinvestmentImplementationReady: LIVE_AUTO_REINVESTMENT_IMPLEMENTATION_READY,
    legalEvidenceVerifierImplementationReady: LEGAL_EVIDENCE_VERIFIER_IMPLEMENTATION_READY,
    environmentVariablesAreNotAuthority: true,
    evidenceRequiredBeforeLive: true,
    legalEvidenceRecordFields,
    legalEvidenceRequirements,
    legalEvidenceRegister,
    activationBlockers,
    readinessSummary: {
      stage: 'external-legal-approval-needed',
      legalClearanceClaimed: false,
      verifiedGateCount: legalEvidenceRegister.filter(({ launchSatisfied }) => launchSatisfied).length,
      requiredGateCount: legalEvidenceRegister.length,
      canAcceptInvestorFunds: false,
      canIssueEconomicInterests: false,
      nextActor: 'Founder + licensed counsel + registered intermediary',
    },
    productionDecisionAuthorities,
    officialRegulatoryReferences,
    regulatedLaunchPacket,
    partnerDiligenceChecklist,
    reviewReadyWorkItems,
    legalReadinessWorkstreams,
    liveInvestingEnabled,
    liveAutomaticReinvestmentEnabled,
    reinvestmentMode: liveAutomaticReinvestmentEnabled ? 'provider-approved-instruction' : 'confirm-each-or-cash',
  };
}
