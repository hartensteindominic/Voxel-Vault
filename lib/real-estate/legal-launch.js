export const LEGAL_LAUNCH_POLICY_VERSION = '2026-08-regulated-intermediary-v1';

// These constants can only change in a reviewed release after the corresponding
// production integrations actually exist. Environment variables are evidence
// inputs, never authority to make the implementation live by themselves.
export const LIVE_INVESTMENT_IMPLEMENTATION_READY = false;
export const LIVE_AUTO_REINVESTMENT_IMPLEMENTATION_READY = false;

export const launchGateDefinitions = [
  ['registeredIntermediaryAgreementActive', 'REAL_ESTATE_REGISTERED_INTERMEDIARY_ACTIVE'],
  ['offeringAuthorizationApproved', 'REAL_ESTATE_OFFERING_AUTHORIZED'],
  ['securitiesCounselApproved', 'REAL_ESTATE_SECURITIES_COUNSEL_APPROVED'],
  ['titleCounselApproved', 'REAL_ESTATE_TITLE_COUNSEL_APPROVED'],
  ['issuerPropertyEntityVerified', 'REAL_ESTATE_ISSUER_ENTITY_VERIFIED'],
  ['kycAmlInvestorEligibilityConfigured', 'REAL_ESTATE_KYC_AML_CONFIGURED'],
  ['escrowSettlementConfigured', 'REAL_ESTATE_ESCROW_SETTLEMENT_CONFIGURED'],
  ['custodyRailsConfigured', 'REAL_ESTATE_CUSTODY_RAILS_CONFIGURED'],
  ['capTableTransferControlsConfigured', 'REAL_ESTATE_CAP_TABLE_TRANSFER_CONFIGURED'],
  ['propertyAccountingConfigured', 'REAL_ESTATE_PROPERTY_ACCOUNTING_CONFIGURED'],
  ['taxReportingConfigured', 'REAL_ESTATE_TAX_REPORTING_CONFIGURED'],
  ['smartContractsAudited', 'REAL_ESTATE_CONTRACTS_AUDITED'],
  ['privacySecurityApproved', 'REAL_ESTATE_PRIVACY_SECURITY_APPROVED'],
  ['incidentResponseApproved', 'REAL_ESTATE_INCIDENT_RESPONSE_APPROVED'],
  ['providerIntegrationVerified', 'REAL_ESTATE_PROVIDER_INTEGRATION_VERIFIED'],
];

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
  const gates = Object.fromEntries(
    launchGateDefinitions.map(([name, envKey]) => [name, env[envKey] === 'true'])
  );
  const missing = Object.entries(gates).filter(([, passed]) => !passed).map(([name]) => name);
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

  return {
    policyVersion: LEGAL_LAUNCH_POLICY_VERSION,
    targetOfferingPath: 'Regulation Crowdfunding through a registered intermediary',
    gates,
    missing,
    allExternalGatesSatisfied,
    explicitLiveFlag,
    explicitAutoReinvestmentFlag,
    productionInvestmentImplementationReady: LIVE_INVESTMENT_IMPLEMENTATION_READY,
    productionAutoReinvestmentImplementationReady: LIVE_AUTO_REINVESTMENT_IMPLEMENTATION_READY,
    environmentVariablesAreNotAuthority: true,
    evidenceRequiredBeforeLive: true,
    productionDecisionAuthorities,
    officialRegulatoryReferences,
    legalReadinessWorkstreams,
    liveInvestingEnabled,
    liveAutomaticReinvestmentEnabled,
    reinvestmentMode: liveAutomaticReinvestmentEnabled ? 'provider-approved-instruction' : 'confirm-each-or-cash',
  };
}
