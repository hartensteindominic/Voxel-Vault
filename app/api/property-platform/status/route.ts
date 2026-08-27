import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gates = {
    securitiesCounselApproved: process.env.REAL_ESTATE_SECURITIES_COUNSEL_APPROVED === 'true',
    titleCounselApproved: process.env.REAL_ESTATE_TITLE_COUNSEL_APPROVED === 'true',
    kycAmlProviderConfigured: process.env.REAL_ESTATE_KYC_AML_CONFIGURED === 'true',
    custodyRailsConfigured: process.env.REAL_ESTATE_CUSTODY_RAILS_CONFIGURED === 'true',
    smartContractsAudited: process.env.REAL_ESTATE_CONTRACTS_AUDITED === 'true',
  };

  const allExternalGatesSatisfied = Object.values(gates).every(Boolean);
  const explicitLiveFlag = process.env.REAL_ESTATE_LIVE_INVESTING_ENABLED === 'true';

  // Deliberately false in this pilot. A later production integration must replace
  // this constant only after real provider-backed investment, custody and transfer
  // workflows exist end-to-end. Environment variables alone cannot unlock money movement.
  const productionInvestmentImplementationReady = false;
  const liveInvestingEnabled = explicitLiveFlag && allExternalGatesSatisfied && productionInvestmentImplementationReady;

  return NextResponse.json({
    product: 'Voxel Vault Real Property Pilot',
    mode: liveInvestingEnabled ? 'controlled-live' : 'pilot',
    network: 'Base Sepolia',
    chainId: 84532,
    liveInvestingEnabled,
    productionInvestmentImplementationReady,
    gates,
    allExternalGatesSatisfied,
    capabilities: {
      threeDimensionalPropertyTwin: true,
      legalEntityLinkageModel: true,
      permissionedInterestTokenContracts: true,
      merkleDistributionVaultContract: true,
      liveInvestmentCheckout: false,
      mainnetPropertyTokenDeployment: false,
    },
    note: liveInvestingEnabled
      ? 'Controlled live mode is active.'
      : 'Fail-closed pilot: no live property investment or public security-token sale is enabled.',
  });
}
