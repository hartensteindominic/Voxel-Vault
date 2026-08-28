import { NextResponse } from 'next/server';
import { evaluateLegalLaunch } from '../../../../lib/real-estate/legal-launch';
import { getDinariConfig } from '../../../../lib/real-estate/dinari';

export const dynamic = 'force-dynamic';

export async function GET() {
  const launch = evaluateLegalLaunch(process.env);
  const dinari = getDinariConfig(process.env);

  return NextResponse.json({
    product: 'Voxel Vault Real Property Investment Platform',
    mode: launch.liveInvestingEnabled ? 'controlled-live' : 'regulated-launch-build',
    pilotNetwork: 'Base Sepolia',
    pilotChainId: 84532,
    targetOfferingPath: launch.targetOfferingPath,
    liveInvestingEnabled: launch.liveInvestingEnabled,
    liveAutomaticReinvestmentEnabled: launch.liveAutomaticReinvestmentEnabled,
    productionInvestmentImplementationReady: launch.productionInvestmentImplementationReady,
    productionAutoReinvestmentImplementationReady: launch.productionAutoReinvestmentImplementationReady,
    launchPolicyVersion: launch.policyVersion,
    gates: launch.gates,
    gateAssertions: launch.gateAssertions,
    missingGateAssertions: launch.missingAssertions,
    unverifiedGateAssertions: launch.unverifiedAssertions,
    missingGates: launch.missing,
    allExternalGatesAsserted: launch.allExternalGatesAsserted,
    allExternalGatesSatisfied: launch.allExternalGatesSatisfied,
    activationBlockers: launch.activationBlockers,
    readinessSummary: launch.readinessSummary,
    reinvestmentMode: launch.reinvestmentMode,
    legalReadiness: {
      environmentVariablesAreNotAuthority: launch.environmentVariablesAreNotAuthority,
      evidenceRequiredBeforeLive: launch.evidenceRequiredBeforeLive,
      evidenceVerifierImplementationReady: launch.legalEvidenceVerifierImplementationReady,
      evidenceRecordFields: launch.legalEvidenceRecordFields,
      evidenceRequirements: launch.legalEvidenceRequirements,
      evidenceRegister: launch.legalEvidenceRegister,
      productionDecisionAuthorities: launch.productionDecisionAuthorities,
      regulatedLaunchPacket: launch.regulatedLaunchPacket,
      partnerDiligenceChecklist: launch.partnerDiligenceChecklist,
      reviewReadyWorkItems: launch.reviewReadyWorkItems,
      workstreams: launch.legalReadinessWorkstreams,
      officialReferences: launch.officialRegulatoryReferences,
    },
    digitalReits: {
      provider: dinari.provider,
      environment: dinari.environment,
      credentialsConfigured: dinari.credentialsConfigured,
      accountConfigured: dinari.accountConfigured,
      sandboxFaucetEnabled: dinari.sandboxFaucetEnabled,
      sandboxTradingEnabled: dinari.sandboxTradingEnabled,
      productionTradingEnabled: dinari.productionTradingEnabled,
      symbols: dinari.symbols,
    },
    capabilities: {
      threeDimensionalPropertyTwin: true,
      legalEntityLinkageModel: true,
      permissionedInterestTokenContracts: true,
      merkleDistributionVaultContract: true,
      globalAssetAllocationSimulation: true,
      fractionalPropertySimulation: true,
      acquisitionResearchEngine: true,
      cheapestProfitableVerifiedRanking: true,
      tokenizedRealEstateProviderModel: true,
      dinariDigitalReitProviderAdapter: true,
      providerBackedReitCatalog: true,
      providerBackedPortfolioRead: true,
      providerBackedCashRead: true,
      providerBackedDividendRead: true,
      sandboxMockFunding: true,
      cappedSandboxSecurityOrders: true,
      jurisdictionAcquisitionGate: true,
      regulatedLaunchGateEngine: true,
      authorityEvidenceRegister: true,
      authorityEvidenceVerification: false,
      crossAssetAdapterModel: true,
      rentReinvestmentSimulation: true,
      liveInvestmentCheckout: false,
      automatedLiveAcquisition: false,
      liveAutomaticReinvestment: false,
      liveDigitalReitTrading: false,
      pooledPublicRentInvesting: false,
      mainnetPropertyTokenDeployment: false,
    },
    routes: {
      acquisitionEngine: '/real-estate/acquire',
      acquisitionStatus: '/api/property-platform/acquisition',
      digitalReitVault: '/real-estate/reits',
      digitalReitStatus: '/api/digital-reits',
      digitalReitSandboxFunding: '/api/digital-reits/sandbox-fund',
    },
    note: launch.liveInvestingEnabled
      ? 'Controlled live mode is active through the approved production integration.'
      : 'Fail-closed regulated launch build: environment settings are unverified assertions, no authority evidence verifier is connected, and no live investor funds, live securities purchase, automated property acquisition or public security-token sale can execute from this code.',
  });
}
