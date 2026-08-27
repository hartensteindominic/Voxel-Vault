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
    liveInvestingEnabled,
    liveAutomaticReinvestmentEnabled,
    reinvestmentMode: liveAutomaticReinvestmentEnabled ? 'provider-approved-instruction' : 'confirm-each-or-cash',
  };
}
