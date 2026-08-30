export const BANKING_LAUNCH_POLICY_VERSION = '2026-08-bank-fintech-v1';

// A production provider contract, reviewed implementation and verified control
// evidence are required before Galactic Trust may move real customer money.
// Environment variables are inputs for readiness reporting, never legal authority
// by themselves. This constant only changes in a reviewed release after the
// sponsor-bank/provider integration exists and has passed production acceptance.
export const LIVE_BANKING_IMPLEMENTATION_READY = false;

// Crypto remains a separate regulated product and cannot become live merely
// because the banking program is approved.
export const LIVE_CRYPTO_IMPLEMENTATION_READY = false;

export const bankingEvidenceRequirements = [
  {
    gate: 'sponsorBankAgreementActive',
    label: 'Sponsor bank agreement',
    assertionEnvKey: 'GALACTIC_SPONSOR_BANK_AGREEMENT_ACTIVE',
    authority: 'Sponsor bank + Galactic Trust',
    requiredEvidence: [
      'Executed program agreement',
      'Written scope of banking services',
      'Approved public bank-partner attribution',
    ],
  },
  {
    gate: 'programComplianceApproved',
    label: 'Banking program compliance approval',
    assertionEnvKey: 'GALACTIC_PROGRAM_COMPLIANCE_APPROVED',
    authority: 'Sponsor bank compliance + qualified counsel/compliance reviewer',
    requiredEvidence: [
      'Approved compliance responsibility matrix',
      'Approved customer flow',
      'Approved marketing and disclosure review process',
    ],
  },
  {
    gate: 'kycCipAmlSanctionsApproved',
    label: 'KYC / CIP / AML / sanctions',
    assertionEnvKey: 'GALACTIC_KYC_CIP_AML_APPROVED',
    authority: 'Sponsor bank + approved identity/compliance provider',
    requiredEvidence: [
      'Customer identification workflow',
      'KYC and sanctions decision states',
      'Manual-review and escalation procedure',
    ],
  },
  {
    gate: 'depositAccountAgreementApproved',
    label: 'Account agreement and disclosures',
    assertionEnvKey: 'GALACTIC_ACCOUNT_DISCLOSURES_APPROVED',
    authority: 'Sponsor bank + counsel/compliance',
    requiredEvidence: [
      'Approved deposit/account agreement',
      'Fee and limit schedule',
      'Required account-opening disclosures',
    ],
  },
  {
    gate: 'regEControlsApproved',
    label: 'Regulation E controls',
    assertionEnvKey: 'GALACTIC_REG_E_APPROVED',
    authority: 'Sponsor bank + consumer-compliance reviewer',
    requiredEvidence: [
      'Initial EFT disclosures',
      'Unauthorized-transfer/error-resolution workflow',
      'Receipts, statements and preauthorized-transfer controls',
    ],
  },
  {
    gate: 'moneyMovementRailsApproved',
    label: 'ACH / payment rails',
    assertionEnvKey: 'GALACTIC_MONEY_MOVEMENT_APPROVED',
    authority: 'Sponsor bank + banking platform',
    requiredEvidence: [
      'Approved ACH/transfer use cases',
      'Limits and risk controls',
      'Returns, reversals and settlement-state handling',
    ],
  },
  {
    gate: 'cardProgramApproved',
    label: 'Debit card program',
    assertionEnvKey: 'GALACTIC_CARD_PROGRAM_APPROVED',
    authority: 'Sponsor bank + card program/network providers',
    requiredEvidence: [
      'Approved cardholder agreement',
      'Card issuance and authorization controls',
      'Dispute, lost-card and fraud procedures',
    ],
  },
  {
    gate: 'ledgerReconciliationApproved',
    label: 'Ledger and reconciliation',
    assertionEnvKey: 'GALACTIC_LEDGER_RECONCILIATION_APPROVED',
    authority: 'Sponsor bank + banking platform + finance/operations',
    requiredEvidence: [
      'Bank-authoritative account mapping',
      'Daily reconciliation procedure',
      'Exception queue and break-resolution SLA',
    ],
  },
  {
    gate: 'depositInsuranceDisclosureApproved',
    label: 'Deposit-insurance disclosure',
    assertionEnvKey: 'GALACTIC_DEPOSIT_INSURANCE_DISCLOSURE_APPROVED',
    authority: 'Sponsor bank + compliance reviewer',
    requiredEvidence: [
      'Approved nonbank disclosure',
      'Approved sponsor-bank naming',
      'Approved pass-through insurance language if applicable',
    ],
  },
  {
    gate: 'privacySecurityApproved',
    label: 'Privacy and security program',
    assertionEnvKey: 'GALACTIC_PRIVACY_SECURITY_APPROVED',
    authority: 'Sponsor bank + privacy/security reviewer',
    requiredEvidence: [
      'Data inventory and retention schedule',
      'Access-control and encryption review',
      'Vendor/security-risk review',
    ],
  },
  {
    gate: 'complaintsDisputesApproved',
    label: 'Complaints, disputes and support',
    assertionEnvKey: 'GALACTIC_COMPLAINTS_DISPUTES_APPROVED',
    authority: 'Sponsor bank + operations/compliance',
    requiredEvidence: [
      'Customer complaint procedure',
      'Regulatory escalation path',
      'Dispute and error-resolution service levels',
    ],
  },
  {
    gate: 'incidentResponseApproved',
    label: 'Incident response and continuity',
    assertionEnvKey: 'GALACTIC_INCIDENT_RESPONSE_APPROVED',
    authority: 'Sponsor bank + security/operations owners',
    requiredEvidence: [
      'Incident response plan',
      'Business continuity and recovery procedure',
      'Customer and bank notification matrix',
    ],
  },
  {
    gate: 'providerProductionAccepted',
    label: 'Production provider acceptance',
    assertionEnvKey: 'GALACTIC_PROVIDER_PRODUCTION_ACCEPTED',
    authority: 'Sponsor bank + banking platform',
    requiredEvidence: [
      'End-to-end sandbox certification',
      'Signed webhook and reconciliation test evidence',
      'Written production go-live acceptance',
    ],
  },
];

function asserted(env, key) {
  return String(env?.[key] || '').trim().toLowerCase() === 'true';
}

export function bankingLaunchSnapshot(env = process.env) {
  const gates = bankingEvidenceRequirements.map((requirement) => ({
    ...requirement,
    asserted: asserted(env, requirement.assertionEnvKey),
  }));

  const allRequiredAssertionsPresent = gates.every((gate) => gate.asserted);
  const liveSwitchRequested = asserted(env, 'GALACTIC_LIVE_BANKING_ENABLED');
  const liveBankingEnabled = Boolean(
    LIVE_BANKING_IMPLEMENTATION_READY &&
    allRequiredAssertionsPresent &&
    liveSwitchRequested
  );

  const cryptoSwitchRequested = asserted(env, 'GALACTIC_LIVE_CRYPTO_ENABLED');
  const liveCryptoEnabled = Boolean(
    LIVE_CRYPTO_IMPLEMENTATION_READY &&
    cryptoSwitchRequested
  );

  return {
    policyVersion: BANKING_LAUNCH_POLICY_VERSION,
    status: liveBankingEnabled ? 'live-provider-backed' : 'production-gated',
    liveBankingEnabled,
    liveCryptoEnabled,
    implementationReady: LIVE_BANKING_IMPLEMENTATION_READY,
    cryptoImplementationReady: LIVE_CRYPTO_IMPLEMENTATION_READY,
    liveSwitchRequested,
    allRequiredAssertionsPresent,
    providerConfigured: Boolean(String(env?.GALACTIC_BANKING_PLATFORM || '').trim()),
    sponsorBankNamed: Boolean(String(env?.GALACTIC_SPONSOR_BANK_LEGAL_NAME || '').trim()),
    gates,
  };
}

export const galacticTrustPublicBoundary = {
  nonBankDisclosure: 'Galactic Trust is a financial technology product, not a bank. Galactic Trust does not currently accept or hold real customer deposits.',
  liveProgramDisclosure: 'If live banking launches, banking services and any deposit product must be provided by and attributed to the approved sponsor bank under bank-approved terms and disclosures.',
  fdicBoundary: 'Do not use the FDIC name, logo, Member FDIC language, or deposit-insurance claims for Galactic Trust unless the exact sponsor-bank relationship and wording have been approved for the live program.',
  cryptoBoundary: 'Crypto trading and custody are separate regulated services and remain disabled until separately approved and integrated.',
};

export const bankingRegulatoryReferences = [
  {
    agency: 'FDIC',
    name: 'Bank arrangements with third parties to deliver deposit products',
    url: 'https://www.fdic.gov/news/financial-institution-letters/2024/agencies-issue-statement-bank-arrangements-third-parties',
  },
  {
    agency: 'FDIC',
    name: 'Official signs, advertising and deposit-insurance misrepresentation rules',
    url: 'https://www.fdic.gov/news/financial-institution-letters/2023/fil23065.html',
  },
  {
    agency: 'CFPB',
    name: 'Regulation E — Electronic Fund Transfers',
    url: 'https://www.consumerfinance.gov/rules-policy/regulations/1005/',
  },
  {
    agency: 'FinCEN',
    name: 'Money Services Business registration',
    url: 'https://www.fincen.gov/resources/money-services-business-msb-registration',
  },
  {
    agency: 'FTC',
    name: 'Safeguards Rule',
    url: 'https://www.ftc.gov/legal-library/browse/rules/safeguards-rule',
  },
];
