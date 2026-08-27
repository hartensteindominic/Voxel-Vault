import { NextResponse } from 'next/server';
import { evaluateLegalLaunch } from '../../../../lib/real-estate/legal-launch';

export const dynamic = 'force-dynamic';

export async function GET() {
  const launch = evaluateLegalLaunch(process.env);

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
    missingGates: launch.missing,
    allExternalGatesSatisfied: launch.allExternalGatesSatisfied,
    reinvestmentMode: launch.reinvestmentMode,
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
      jurisdictionAcquisitionGate: true,
      regulatedLaunchGateEngine: true,
      crossAssetAdapterModel: true,
      rentReinvestmentSimulation: true,
      liveInvestmentCheckout: false,
      automatedLiveAcquisition: false,
      liveAutomaticReinvestment: false,
      pooledPublicRentInvesting: false,
      mainnetPropertyTokenDeployment: false,
    },
    routes: {
      acquisitionEngine: '/real-estate/acquire',
      acquisitionStatus: '/api/property-platform/acquisition',
    },
    note: launch.liveInvestingEnabled
      ? 'Controlled live mode is active through the approved production integration.'
      : 'Fail-closed regulated launch build: no investor funds, live securities purchase, automated acquisition or public security-token sale can execute from this code.',
  });
}
