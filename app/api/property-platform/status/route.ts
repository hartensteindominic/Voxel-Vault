import { NextResponse } from 'next/server';
import { evaluateLegalLaunch } from '../../../../lib/real-estate/legal-launch';
import {
  DINARI_LIVE_TRADING_IMPLEMENTATION_READY,
  getDinariConfig,
} from '../../../../lib/real-estate/dinari';

export const dynamic = 'force-dynamic';

export async function GET() {
  const launch = evaluateLegalLaunch(process.env);
  const dinari = getDinariConfig(process.env);

  const liveSecuritiesImplementationReady = DINARI_LIVE_TRADING_IMPLEMENTATION_READY === true;
  const liveSecuritiesProviderActivated = dinari.productionTradingEnabled === true;
  const directPropertyImplementationReady = launch.productionInvestmentImplementationReady === true;
  const directPropertyInvestingActivated = launch.liveInvestingEnabled === true;

  return NextResponse.json({
    product: 'Voxel Vault Spatial Real Estate Financial Platform',
    mode: directPropertyInvestingActivated || liveSecuritiesProviderActivated
      ? 'controlled-live'
      : 'regulated-launch-build',
    pilotNetwork: 'Base Sepolia',
    pilotChainId: 84532,
    targetOfferingPath: launch.targetOfferingPath,
    liveInvestingEnabled: directPropertyInvestingActivated,
    liveAutomaticReinvestmentEnabled: launch.liveAutomaticReinvestmentEnabled,
    productionInvestmentImplementationReady: directPropertyImplementationReady,
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
    investmentRails: {
      realEstateSecurities: {
        provider: dinari.provider,
        environment: dinari.environment,
        implementationReady: liveSecuritiesImplementationReady,
        providerActivated: liveSecuritiesProviderActivated,
        credentialsConfigured: dinari.credentialsConfigured,
        accountConfigured: dinari.accountConfigured,
        productionReadinessBlockers: dinari.productionReadinessBlockers,
        liveOrderMaxUsd: 700,
        rightsType: 'security/economic exposure; not a deed to a specific parcel',
      },
      directSpecificProperty: {
        implementationReady: directPropertyImplementationReady,
        providerActivated: directPropertyInvestingActivated,
        automatedAcquisitionEnabled: false,
        pooledPublicInvestingEnabled: false,
        rightsType: 'future deed/entity-linked property rights after title and legal closing',
      },
    },
    digitalReits: {
      provider: dinari.provider,
      environment: dinari.environment,
      credentialsConfigured: dinari.credentialsConfigured,
      accountConfigured: dinari.accountConfigured,
      sandboxFaucetEnabled: dinari.sandboxFaucetEnabled,
      sandboxTradingEnabled: dinari.sandboxTradingEnabled,
      liveTradingImplementationReady: liveSecuritiesImplementationReady,
      productionTradingEnabled: liveSecuritiesProviderActivated,
      symbols: dinari.symbols,
    },
    capabilities: {
      threeDimensionalPropertyTwin: true,
      verifiedSpatialTruthModel: true,
      geographicParcelVerificationGate: true,
      physicalBuildingVerificationGate: true,
      explicitPropertyRightsClassification: true,
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
      liveInvestmentCheckout: liveSecuritiesProviderActivated,
      liveDigitalReitTradingImplementationReady: liveSecuritiesImplementationReady,
      liveDigitalReitTrading: liveSecuritiesProviderActivated,
      automatedLiveAcquisition: false,
      liveAutomaticReinvestment: false,
      pooledPublicRentInvesting: false,
      mainnetPropertyTokenDeployment: false,
    },
    routes: {
      acquisitionEngine: '/real-estate/acquire',
      acquisitionStatus: '/api/property-platform/acquisition',
      digitalReitVault: '/real-estate/reits',
      digitalReitStatus: '/api/digital-reits',
      digitalReitSandboxFunding: '/api/digital-reits/sandbox-fund',
      ownerLiveDigitalReitConsole: '/admin/digital-reits/live',
      propertyVault: '/real-estate/property/[propertyId]',
    },
    note: liveSecuritiesProviderActivated
      ? 'The approved owner-only real-estate securities rail is activated. This does not activate direct deed-linked property investing.'
      : directPropertyInvestingActivated
        ? 'A controlled direct-property launch is active under its separate approved legal/provider gates.'
        : 'Fail-closed regulated launch build: the real-estate securities execution implementation exists, but provider activation remains separate from direct property ownership. Direct deed-linked investing, automated property acquisition, public pooled investing and mainnet property-token issuance remain disabled until their own verified launch gates pass.',
  });
}
